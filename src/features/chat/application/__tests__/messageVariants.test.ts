import { describe, expect, it } from 'vitest';
import {
  applyVariantContent,
  beginNewVariant,
  getActiveVariantIndex,
  getMessageVariants,
  hasVariantSwitcher,
  resolveSwitchedVariantIndex,
  revertLastVariant,
  setActiveVariant,
} from '../messageVariants';
import type { Message } from '@/types';

const legacyMessage = (content = 'first'): Message => ({
  id: 'm1',
  type: 'assistant',
  content,
  timestamp: 1,
});

const variantMessage = (variants: string[], activeVariantIndex = 0): Message => ({
  id: 'm1',
  type: 'assistant',
  content: variants[activeVariantIndex] ?? '',
  timestamp: 1,
  variants,
  activeVariantIndex,
});

describe('messageVariants', () => {
  it('把没有 variants 的旧数据视为只有一条变体', () => {
    expect(getMessageVariants(legacyMessage('旧的回复'))).toEqual(['旧的回复']);
    expect(getActiveVariantIndex(legacyMessage())).toBe(0);
    expect(hasVariantSwitcher(legacyMessage())).toBe(false);
  });

  it('越界或非法的 activeVariantIndex 会被钳制', () => {
    expect(getActiveVariantIndex(variantMessage(['a', 'b'], 5))).toBe(1);
    expect(getActiveVariantIndex(variantMessage(['a', 'b'], -3))).toBe(0);
    expect(getActiveVariantIndex({ ...variantMessage(['a', 'b']), activeVariantIndex: Number.NaN })).toBe(0);
  });

  it('左右切换是环绕的', () => {
    expect(resolveSwitchedVariantIndex(0, 1, 3)).toBe(1);
    expect(resolveSwitchedVariantIndex(2, 1, 3)).toBe(0);
    expect(resolveSwitchedVariantIndex(0, -1, 3)).toBe(2);
    expect(resolveSwitchedVariantIndex(0, 1, 0)).toBe(0);
  });

  it('setActiveVariant 同步 content，切换后上下文输入跟着变', () => {
    const message = variantMessage(['a', 'b', 'c'], 0);
    setActiveVariant(message, 2);
    expect(message.activeVariantIndex).toBe(2);
    expect(message.content).toBe('c');

    setActiveVariant(message, 99);
    expect(message.activeVariantIndex).toBe(2);
    expect(message.content).toBe('c');
  });

  it('applyVariantContent 只改当前变体，旧数据只改 content', () => {
    const variant = variantMessage(['a', 'b'], 1);
    applyVariantContent(variant, 'b-edited');
    expect(variant.content).toBe('b-edited');
    expect(variant.variants).toEqual(['a', 'b-edited']);

    const legacy = legacyMessage('a');
    applyVariantContent(legacy, 'a-edited');
    expect(legacy.content).toBe('a-edited');
    expect(legacy.variants).toBeUndefined();
  });

  it('beginNewVariant 固化当前内容并追加空槽位', () => {
    const message = legacyMessage('first');
    const previousIndex = beginNewVariant(message);

    expect(previousIndex).toBe(0);
    expect(message.variants).toEqual(['first', '']);
    expect(message.activeVariantIndex).toBe(1);
    expect(message.content).toBe('');
  });

  it('revertLastVariant 丢掉空槽位；只剩一条时清掉 variants', () => {
    const message = legacyMessage('first');
    const previousIndex = beginNewVariant(message);

    applyVariantContent(message, 'second');
    revertLastVariant(message, previousIndex);
    // 有新内容时不回滚
    expect(message.variants).toEqual(['first', 'second']);

    const cancelled = legacyMessage('first');
    const cancelledPreviousIndex = beginNewVariant(cancelled);
    revertLastVariant(cancelled, cancelledPreviousIndex);

    expect(cancelled.content).toBe('first');
    expect(cancelled.variants).toBeUndefined();
    expect(cancelled.activeVariantIndex).toBeUndefined();
  });

  it('revertLastVariant 不会误伤已经切走的变体', () => {
    const message = variantMessage(['a', 'b', 'c'], 1);
    // 当前不在最后那个槽位，回滚应当被忽略
    revertLastVariant(message, 0);
    expect(message.variants).toEqual(['a', 'b', 'c']);
    expect(message.content).toBe('b');
  });
});
