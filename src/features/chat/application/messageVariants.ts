/**
 * AI 回复的「变体」操作（重试 / 左右切换）。
 *
 * 不变量：`message.content` 永远等于 `variants[activeVariantIndex]`。
 * 所有会改动这两者的地方（切换、编辑、流式写回）都必须经过本模块，
 * 否则切换后 `content` 与实际展示会不一致，而 `content` 正是
 * 上下文统计与下一次请求的输入。
 *
 * 兼容旧数据：没有 `variants` 字段的消息视为只有一条变体。
 */
import type { Message } from '@/types';

/**
 * 取消息的全部变体。
 *
 * 无 `variants` 时把 `content` 当成唯一变体，调用方无需区分新旧数据。
 */
export function getMessageVariants(message: Message): string[] {
  if (message.variants && message.variants.length > 0) {
    return message.variants;
  }

  return [message.content];
}

/** 当前变体下标；越界或非数字时钳制到合法范围。 */
export function getActiveVariantIndex(message: Message): number {
  const total = getMessageVariants(message).length;
  const raw = message.activeVariantIndex ?? 0;

  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }

  return Math.min(total - 1, Math.max(0, Math.trunc(raw)));
}

/** 是否有多个变体可供左右切换。 */
export function hasVariantSwitcher(message: Message): boolean {
  return (message.variants?.length ?? 0) > 1;
}

/**
 * 环绕式切换下标：`delta` 为 +1 / -1，到头后回到另一端。
 */
export function resolveSwitchedVariantIndex(current: number, delta: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return ((current + delta) % total + total) % total;
}

/**
 * 写入当前变体的内容，并同步 `content`。
 *
 * 没有 `variants` 的消息（用户消息 / 旧数据）只更新 `content`，
 * 因此这条路径对单条回复的普通发送是完全无副作用的。
 */
export function applyVariantContent(message: Message, content: string): void {
  message.content = content;

  const variants = message.variants;
  if (!variants || variants.length === 0) {
    return;
  }

  const index = getActiveVariantIndex(message);
  variants[index] = content;
}

/** 切换到指定变体，`content` 同步为该变体内容。 */
export function setActiveVariant(message: Message, index: number): void {
  const variants = message.variants;
  if (!variants || variants.length === 0) {
    return;
  }

  const next = Math.min(variants.length - 1, Math.max(0, index));
  message.activeVariantIndex = next;
  message.content = variants[next] ?? '';
}

/**
 * 重试开始：把当前内容固化为变体，再追加一个空槽位作为新变体的落点。
 *
 * 返回追加前的下标，供「取消且没有任何内容」时回滚。
 */
export function beginNewVariant(message: Message): number {
  const previousIndex = getActiveVariantIndex(message);
  const nextVariants = [...getMessageVariants(message), ''];

  message.variants = nextVariants;
  message.activeVariantIndex = nextVariants.length - 1;
  message.content = '';

  return previousIndex;
}

/**
 * 重试取消且没有任何内容：丢掉那个空槽位，回到追加前的变体。
 *
 * 两道守卫都在函数内，避免调用方忘了判空就把已生成的内容删掉：
 * - 当前必须正是最后那个槽位（否则可能已切走）
 * - 当前内容必须为空（生成了哪怕一个字就保留下来）
 *
 * 回滚后只剩一条变体时清掉 `variants`，保持与旧数据相同的形态。
 * 返回是否真的发生了回滚。
 */
export function revertLastVariant(message: Message, previousIndex: number): boolean {
  const variants = message.variants;
  if (!variants || variants.length === 0) {
    return false;
  }

  if (getActiveVariantIndex(message) !== variants.length - 1) {
    return false;
  }

  if (message.content.trim()) {
    return false;
  }

  const remaining = variants.slice(0, -1);
  const restoreIndex = Math.min(remaining.length - 1, Math.max(0, previousIndex));

  if (remaining.length <= 1) {
    message.variants = undefined;
    message.activeVariantIndex = undefined;
    message.content = remaining[0] ?? '';
    return true;
  }

  message.variants = remaining;
  message.activeVariantIndex = restoreIndex;
  message.content = remaining[restoreIndex] ?? '';
  return true;
}
