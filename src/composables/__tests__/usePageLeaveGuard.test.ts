// @vitest-environment happy-dom
/**
 * usePageLeaveGuard 回归测试。
 *
 * 重点覆盖「保存并离开」的两条失败路径：
 * - 保存失败时必须保留确认框与待执行回调（否则用户看不到提示也无法重试）
 * - 保存成功后必须清空待执行回调（否则后续 forceLeave 会把离开回调再跑一次）
 */
import { describe, expect, it, vi } from 'vitest';
import { usePageLeaveGuard } from '../usePageLeaveGuard';

describe('usePageLeaveGuard', () => {
  it('无未保存更改时直接离开并执行回调', () => {
    const guard = usePageLeaveGuard({ enabled: false });
    const onLeave = vi.fn();

    expect(guard.checkBeforeLeave(onLeave)).toBe(true);
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(guard.showLeaveConfirm.value).toBe(false);
  });

  it('有未保存更改时弹确认框，返回 false 且不执行回调', () => {
    const guard = usePageLeaveGuard();
    const onLeave = vi.fn();

    expect(guard.checkBeforeLeave(onLeave)).toBe(false);
    expect(guard.showLeaveConfirm.value).toBe(true);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('保存成功后才关闭确认框并执行离开回调（且回调只跑一次）', async () => {
    const guard = usePageLeaveGuard();
    const onLeave = vi.fn();
    const onSave = vi.fn(async () => undefined);

    guard.checkBeforeLeave(onLeave);
    await guard.handleSaveAndLeave(onSave);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(guard.showLeaveConfirm.value).toBe(false);
    expect(onLeave).toHaveBeenCalledTimes(1);

    // 回调已被清理：强制离开不应再触发一次
    guard.forceLeave();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('保存失败时保留确认框与待执行回调，并向上抛出错误', async () => {
    const guard = usePageLeaveGuard();
    const onLeave = vi.fn();
    const onSave = vi.fn(async () => {
      throw new Error('保存失败');
    });

    guard.checkBeforeLeave(onLeave);

    await expect(guard.handleSaveAndLeave(onSave)).rejects.toThrow('保存失败');

    // 对话框不能提前关掉：用户要看到失败提示并重试
    expect(guard.showLeaveConfirm.value).toBe(true);
    expect(onLeave).not.toHaveBeenCalled();

    // 重试成功后仍能正常离开
    await guard.handleSaveAndLeave(async () => undefined);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('forceLeave 传入回调时不会同时触发 pending 回调', () => {
    const guard = usePageLeaveGuard();
    const pending = vi.fn();
    const explicit = vi.fn();

    guard.checkBeforeLeave(pending);
    guard.forceLeave(explicit);

    expect(explicit).toHaveBeenCalledTimes(1);
    expect(pending).not.toHaveBeenCalled();
  });

  it('取消离开会清空待执行回调', () => {
    const guard = usePageLeaveGuard();
    const onLeave = vi.fn();

    guard.checkBeforeLeave(onLeave);
    guard.handleCancelLeave();
    expect(guard.showLeaveConfirm.value).toBe(false);

    guard.forceLeave();
    expect(onLeave).not.toHaveBeenCalled();
  });
});
