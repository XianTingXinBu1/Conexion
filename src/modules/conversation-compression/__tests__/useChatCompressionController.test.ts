/**
 * 压缩交互的失败处理测试。
 *
 * 重点：用户主动取消压缩时，不应弹「压缩失败」错误提示。
 * 取消是用户的意图，不是异常；把它当失败上报会误导用户。
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { Conversation, Message } from '@/types';
import { REQUEST_CANCELLED_MESSAGE } from '@/api/errors';
import { useChatCompressionController } from '../presentation/useChatCompressionController';

const createMessages = (): Message[] => [
  { id: 'm1', type: 'user', content: '第一轮', timestamp: 1 },
  { id: 'm2', type: 'assistant', content: '回复一', timestamp: 2 },
];

const createController = (sendChatRequest: (messages: unknown[]) => Promise<string>) => {
  const showInfo = vi.fn();
  const showSuccess = vi.fn();
  const showError = vi.fn();

  const controller = useChatCompressionController({
    messages: ref<Message[]>(createMessages()),
    currentConversation: ref<Conversation | undefined>({
      id: 'conv-1',
      title: 't',
      messages: createMessages(),
      createdAt: 1,
      updatedAt: 1,
    }),
    canUseConversationCompression: ref(true),
    saveConversation: vi.fn(async () => undefined),
    sendChatRequest: sendChatRequest as never,
    showInfo,
    showSuccess,
    showError,
  });

  return { controller, showInfo, showSuccess, showError };
};

describe('压缩被用户取消', () => {
  it('不弹错误提示，只给一条取消说明', async () => {
    const { controller, showInfo, showSuccess, showError } = createController(
      async () => { throw new Error(REQUEST_CANCELLED_MESSAGE); },
    );

    await controller.handleCompressConversation();

    expect(showError).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith('已取消压缩', expect.any(String));
    // 取消后压缩状态必须复位
    expect(controller.isCompressing.value).toBe(false);
  });

  it('对照：真实失败仍然报错', async () => {
    const { controller, showError, showInfo } = createController(
      async () => { throw new Error('上游炸了'); },
    );

    await controller.handleCompressConversation();

    expect(showError).toHaveBeenCalled();
    expect(showInfo).not.toHaveBeenCalled();
    expect(controller.isCompressing.value).toBe(false);
  });

  it('对照：成功路径给出成功提示', async () => {
    const { controller, showSuccess, showError } = createController(
      async () => '压缩后的摘要',
    );

    await controller.handleCompressConversation();

    expect(showError).not.toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalled();
  });
});
