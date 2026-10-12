/**
 * 覆盖层返回键守卫
 *
 * 问题：弹窗 / 全屏编辑页如果只是页内状态（不占路由），
 * 安卓的系统返回键会直接走浏览器历史，把用户带回上一页（通常是主页），
 * 而不是先关掉当前覆盖层。
 *
 * 做法：覆盖层打开时压入一条「占位历史记录」，返回键先被它消费掉；
 * 每次消费后立刻补回一条，保证覆盖层打开期间始终有一条可回退的占位记录。
 * 覆盖层关闭时（无论是返回键还是 UI 按钮触发）再把这条件占位记录丢掉。
 *
 * 多个覆盖层嵌套时用全局栈区分层级：一次返回只关最上层那个。
 */

import { nextTick, onUnmounted, watch, type Ref } from 'vue';

/** 写入 history.state 的标记，便于调试与测试 */
export const BACK_GUARD_STATE_KEY = '__conexionBackGuard';

interface BackGuardEntry {
  close: () => void;
}

/** 后打开的在上层；返回键只关最上层 */
const guardStack: BackGuardEntry[] = [];

function pushSentinel(): void {
  // 保留 vue-router 自己写在 state 里的字段（如滚动位置）
  window.history.pushState({ ...window.history.state, [BACK_GUARD_STATE_KEY]: true }, '');
}

/**
 * 待忽略的 popstate 数量
 *
 * 我们自己调 history.back() 丢占位记录时也会触发 popstate，
 * 不记数的话它会被当成用户按了返回，进而关掉下一层覆盖层。
 */
let selfInitiatedBacks = 0;
const pendingCleanup: Array<{ promise: Promise<void>; resolve: () => void }> = [];

/** Close the overlay first, then await its asynchronous history.back before routing. */
export async function waitForBackGuardCleanup(): Promise<void> {
  await nextTick();
  await Promise.all(pendingCleanup.map(entry => entry.promise));
}

function discardSentinel(): void {
  selfInitiatedBacks += 1;
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  pendingCleanup.push({ promise, resolve });
  window.history.back();
}

function handlePopState(): void {
  if (selfInitiatedBacks > 0) {
    selfInitiatedBacks -= 1;
    pendingCleanup.shift()?.resolve();
    return;
  }

  const top = guardStack[guardStack.length - 1];

  // 没有覆盖层：不干预，交给浏览器 / 路由正常返回
  if (!top) return;

  // 这条占位记录刚被消费掉，补一条回来，
  // 这样即使 close() 没有真的关闭（例如被未保存确认拦下），层级也不会错乱
  pushSentinel();
  top.close();
}

let isListening = false;

function ensureListening(): void {
  if (isListening) return;

  window.addEventListener('popstate', handlePopState);
  isListening = true;
}

export interface BackGuardOptions {
  /** 覆盖层是否打开 */
  isOpen: Ref<boolean> | (() => boolean);
  /** 返回键按下时要执行的关闭动作 */
  onBack: () => void;
}

export function useBackGuard(options: BackGuardOptions): void {
  const isOpen = (): boolean =>
    typeof options.isOpen === 'function' ? options.isOpen() : options.isOpen.value;

  const entry: BackGuardEntry = { close: options.onBack };
  let pushed = false;

  const handleOpen = () => {
    if (pushed) return;

    pushSentinel();
    pushed = true;
    guardStack.push(entry);
    ensureListening();
  };

  const handleClose = () => {
    const index = guardStack.lastIndexOf(entry);
    if (index !== -1) {
      guardStack.splice(index, 1);
    }

    if (!pushed) return;
    pushed = false;

    // 丢掉占位记录。返回键触发时这里退掉的是刚补回来的那条，
    // 因此净效果仍是「一次返回只关一层，且不离开当前页面」。
    discardSentinel();
  };

  watch(
    isOpen,
    (open) => {
      if (open) {
        handleOpen();
      } else {
        handleClose();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    const index = guardStack.lastIndexOf(entry);
    if (index !== -1) {
      guardStack.splice(index, 1);
    }
    // 不动历史：组件可能是在前进导航中卸载的，这里回退反而会走错
    pushed = false;
    entry.close = () => {};
  });
}
