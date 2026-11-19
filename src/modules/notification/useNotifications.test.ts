import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from './useNotifications';

describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const notifications = useNotifications();
    notifications.clearAll();
  });

  it('shows queued notifications when a visible one is removed', () => {
    const notifications = useNotifications();

    const ids = [1, 2, 3, 4].map((index) =>
      notifications.addNotification('info', `title-${index}`, `message-${index}`, { duration: 0 })
    );

    expect(notifications.notifications.value).toHaveLength(3);
    expect(notifications.queue.value).toHaveLength(1);

    const firstId = ids[0];
    const queuedId = ids[3];

    expect(firstId).toBeDefined();
    expect(queuedId).toBeDefined();

    notifications.removeNotification(firstId!);

    expect(notifications.notifications.value).toHaveLength(3);
    expect(notifications.queue.value).toHaveLength(0);
    expect(notifications.notifications.value.some(item => item.id === queuedId)).toBe(true);
  });

  it('resumes auto close using remaining time instead of resetting full duration', () => {
    const notifications = useNotifications();

    const id = notifications.addNotification('success', 'saved', 'done', { duration: 1000 });

    vi.advanceTimersByTime(400);
    notifications.pauseNotification(id);

    vi.advanceTimersByTime(700);
    expect(notifications.notifications.value.some(item => item.id === id)).toBe(true);

    notifications.resumeNotification(id);

    vi.advanceTimersByTime(599);
    expect(notifications.notifications.value.some(item => item.id === id)).toBe(true);

    vi.advanceTimersByTime(2);
    expect(notifications.notifications.value.some(item => item.id === id)).toBe(false);
  });

  it('does not auto close paused notifications until resumed', () => {
    const notifications = useNotifications();

    const id = notifications.addNotification('warning', 'hold', 'paused', { duration: 500 });

    notifications.pauseNotification(id);
    vi.advanceTimersByTime(2000);

    expect(notifications.notifications.value.some(item => item.id === id)).toBe(true);
  });

  it('重复 resume 不会重置倒计时，也不会留下孤儿定时器', () => {
    const notifications = useNotifications();

    const id = notifications.addNotification('info', 'info', 'x', { duration: 1000 });

    vi.advanceTimersByTime(400);
    notifications.pauseNotification(id);

    // 模拟 hover 抖动：未暂停情况下再 resume 一次
    notifications.resumeNotification(id);
    notifications.resumeNotification(id);

    // 剩余 600ms 到点就关，不会被第二次 resume 重新拖到 1000ms
    vi.advanceTimersByTime(601);
    expect(notifications.notifications.value.some(item => item.id === id)).toBe(false);
  });
});
