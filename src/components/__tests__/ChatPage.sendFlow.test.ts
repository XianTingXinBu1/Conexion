// @vitest-environment happy-dom
/**
 * ChatPage 页面级发送链路测试。
 *
 * 覆盖三条路径：
 * - 成功：输入 -> 发送 -> 流式内容落进消息列表 -> 会话写入后端
 * - 取消：请求中取消 -> 占位消息标记「已停止生成」
 * - 失败：上游返回 5xx -> 占位消息标记「错误: ...」
 *
 * 设计约束：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   ChatPage -> useChatPageViewModel -> useChatSendFlow -> SendMessageUseCase
 *   -> ChatApi -> fetch 这条链路。
 * - 断言只看用户可见行为与发往上游的请求内容，不锁内部实现细节。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import ChatPage from '@/components/ChatPage.vue';
import type { Message } from '@/types';

const CHARACTER = {
  id: 'char-1',
  name: '测试角色',
  description: '用于测试的角色描述',
  personality: '稳定',
  createdAt: 1,
};

const PRESET = {
  id: 'default',
  name: '测试预设',
  url: 'https://upstream.example.com/v1',
  apiKey: 'test-key',
  model: 'test-model',
  streamEnabled: true,
  temperature: 0.7,
  contextLength: 8192,
  maxOutputTokens: 4096,
  createdAt: 1,
  updatedAt: 1,
};

interface StreamPlan {
  /** 依次推给前端的增量文本 */
  chunks?: string[];
  /** true 时推送完 chunks 后保持连接不关闭，用于取消测试 */
  holdOpen?: boolean;
  /** true 时 /api/chat/completions 直接返回 500 */
  fail?: boolean;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

let streamPlan: StreamPlan = {};
let pushStreamContent: ((content: string) => void) | null = null;
let chatCompletionBodies: Record<string, unknown>[] = [];
let conversationMutations: string[] = [];
let storedMessages: Message[] = [];
let messageMutationFails = false;

/** 用于卡住 /api/api-presets 的闸门，测试「预设加载期间取消」这个窗口 */
let presetGate: Promise<void> | null = null;
let openPresetGate: (() => void) | null = null;

const armPresetGate = () => {
  presetGate = new Promise<void>(resolve => {
    openPresetGate = resolve;
  });
};

const releasePresetGate = () => {
  openPresetGate?.();
  presetGate = null;
  openPresetGate = null;
};

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const sseChunk = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

/**
 * 构造一个可控的 SSE 响应体。
 * 当调用方 abort 时会主动 error 流，模拟真实 fetch 的取消行为。
 */
const sseResponse = (plan: StreamPlan, signal: AbortSignal | null): Response => {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let settled = false;

      const failWithAbort = () => {
        if (settled) return;
        settled = true;
        controller.error(new DOMException('请求已取消', 'AbortError'));
      };

      signal?.addEventListener('abort', failWithAbort, { once: true });

      for (const chunk of plan.chunks ?? []) {
        if (settled) return;
        controller.enqueue(encoder.encode(sseChunk(chunk)));
      }

      if (plan.holdOpen) {
        pushStreamContent = (content) => {
          if (!settled) controller.enqueue(encoder.encode(sseChunk(content)));
        };
        return;
      }

      settled = true;
      if (plan.usage) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [], usage: plan.usage })}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
};

const getUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const url = getUrl(input);
  const method = (init.method ?? 'GET').toUpperCase();

  // 预设加载可以在测试里被挂住，用来制造「请求尚未发出但用户已看到停止按钮」的窗口
  if (url.includes('/api/api-presets') && presetGate) {
    await presetGate;
  }

  if (url.includes('/api/chat/completions')) {
    chatCompletionBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);

    if (streamPlan.fail) {
      return jsonResponse({ error: { message: '上游炸了' } }, 500);
    }

    return sseResponse(streamPlan, init.signal ?? null);
  }

  if (url.includes('/api/conversations')) {
    conversationMutations.push(`${method} ${url.replace(/^.*\/api/, '/api')}`);

    if (method === 'POST') {
      const payload = JSON.parse(String(init.body)) as {
        firstMessage: unknown;
        character?: { id: string; name: string };
      };

      return jsonResponse({
        id: 'conv-1',
        title: '测试会话',
        characterId: payload.character?.id,
        characterName: payload.character?.name,
        messages: [payload.firstMessage],
        createdAt: 1,
        updatedAt: 1,
      });
    }

    if ((method === 'PATCH' || method === 'DELETE') && url.includes('/messages/')) {
      if (messageMutationFails) return jsonResponse({ error: '消息操作失败' }, 500);
      const messageId = decodeURIComponent(url.split('/').pop()!);
      if (method === 'DELETE') {
        storedMessages = storedMessages.filter(message => message.id !== messageId);
      } else {
        const payload = JSON.parse(String(init.body)) as { content: string };
        storedMessages = storedMessages.map(message => {
          if (message.id !== messageId) return message;
          const updated = { ...message, content: payload.content };
          if (message.variants) {
            updated.variants = [...message.variants];
            updated.variants[message.activeVariantIndex ?? 0] = payload.content;
          }
          return updated;
        });
      }
      return jsonResponse({
        id: 'conv-1', title: '测试会话', messages: storedMessages,
        characterId: CHARACTER.id, characterName: CHARACTER.name, createdAt: 1, updatedAt: 2,
      });
    }

    if (method === 'PUT') {
      const payload = JSON.parse(String(init.body)) as { messages: Message[] };
      storedMessages = payload.messages;
      return jsonResponse({
        id: 'conv-1',
        title: '测试会话',
        characterId: CHARACTER.id,
        characterName: CHARACTER.name,
        messages: payload.messages,
        createdAt: 1,
        updatedAt: 2,
      });
    }

    return jsonResponse([]);
  }

  if (url.includes('/api/characters/ai/')) return jsonResponse(CHARACTER);
  if (url.includes('/api/characters/ai')) return jsonResponse([CHARACTER]);
  if (url.includes('/api/characters/users')) return jsonResponse([]);
  if (url.includes('/api/settings')) return jsonResponse({ value: null });

  // api-presets / prompt-presets / knowledge-bases / regex-rules 等
  if (url.includes('/api/api-presets')) return jsonResponse([PRESET]);

  return jsonResponse([]);
});

const renderChatPage = async (temporary = false) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });

  const view = render(ChatPage, {
    props: temporary ? {} : { characterId: CHARACTER.id },
    global: { plugins: [router] },
  });

  // 等角色加载完成，确认挂载期异步初始化已经落定
  await waitFor(() => {
    expect(view.container.querySelector('.chat-title')?.textContent).toBe(temporary ? '临时会话' : CHARACTER.name);
  });

  return view;
};

const getInput = (container: Element): HTMLTextAreaElement => {
  const input = container.querySelector<HTMLTextAreaElement>('.message-input');
  if (!input) throw new Error('未找到消息输入框');
  return input;
};

const getSendButton = (container: Element): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('.send-btn:not(.stop-btn)');
  if (!button) throw new Error('未找到发送按钮');
  return button;
};

const getStopButton = (container: Element): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('.send-btn.stop-btn');
  if (!button) throw new Error('未找到停止按钮');
  return button;
};

const sendMessage = async (container: Element, content: string) => {
  await fireEvent.update(getInput(container), content);
  await fireEvent.click(getSendButton(container));
};

beforeEach(() => {
  streamPlan = {};
  pushStreamContent = null;
  chatCompletionBodies = [];
  conversationMutations = [];
  storedMessages = [];
  messageMutationFails = false;
  presetGate = null;
  openPresetGate = null;
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatPage 发送链路', () => {
  const prepareRetry = async () => {
    streamPlan = { chunks: ['原回复'] };
    const view = await renderChatPage();
    await sendMessage(view.container, '测试内容');
    await waitFor(() => {
      expect(view.container.querySelector('button[title="重新生成"]')).toBeTruthy();
      expect(view.container.querySelector('.message-assistant')?.textContent).toContain('原回复');
    });
    return view;
  };

  const getSavedMessages = () => {
    const saves = fetchMock.mock.calls.filter(([input, init]) =>
      getUrl(input).includes('/api/conversations/conv-1/messages') && init?.method === 'PUT',
    );
    return JSON.parse(String(saves[saves.length - 1]?.[1]?.body)).messages;
  };

  it('上下文以 API 输入为基准，输出推理用量不计入上下文，编辑后回退估算', async () => {
    streamPlan = { chunks: ['你好'], usage: { prompt_tokens: 100, completion_tokens: 5000, total_tokens: 5100 } };
    const { container, getByRole, getByLabelText } = await renderChatPage();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) =>
      getUrl(input).includes('conexion_selected_user'))).toBe(true));
    await sendMessage(container, '测试内容');
    await waitFor(() => {
      expect(container.querySelector('button[title="重新生成"]')).toBeTruthy();
      expect(container.querySelector('.context-ring')?.getAttribute('title')).toBe('API 实际输入 + 新增内容估算');
    });
    // 5100 / 8192 会超过 60%，这里只应是约 100 / 8192。
    expect(container.querySelector('.percentage-text')?.textContent?.trim()).toBe('1%');
    await fireEvent.click(container.querySelector('.context-ring')!);
    await waitFor(() => expect(container.textContent).toContain('最近一次聊天请求 · API 用量'));
    expect(container.querySelector('.token-source-note')?.textContent).toContain('API 实际输入 + 新增内容估算');
    await fireEvent.click(container.querySelector('.context-ring')!);
    await fireEvent.click(container.querySelector('.message-user button[title="编辑"]')!);
    const input = await waitFor(() => getByLabelText('消息内容'));
    await fireEvent.update(input, '已经修改的输入');
    await fireEvent.click(getByRole('button', { name: '保存' }));
    await waitFor(() => expect(container.querySelector('.context-ring')?.getAttribute('title')).toBe('本地估算'));
  });

  it('编辑用户消息会保存内容，并在下一轮请求中使用修改后的消息', async () => {
    const { container, getByRole, getByLabelText } = await prepareRetry();
    await fireEvent.click(container.querySelector('.message-user button[title="编辑"]')!);
    const input = await waitFor(() => getByLabelText('消息内容'));
    expect((input as HTMLTextAreaElement).value).toBe('测试内容');
    await fireEvent.update(input, '修改后的用户消息');
    await fireEvent.click(getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(container.querySelector('.message-user')?.textContent).toContain('修改后的用户消息');
      expect(container.querySelector('.edit-message-modal')).toBeNull();
      expect(storedMessages[0]?.content).toBe('修改后的用户消息');
    });
    await sendMessage(container, '继续');
    await waitFor(() => expect(chatCompletionBodies).toHaveLength(2));
    expect(chatCompletionBodies[1]!.messages).toContainEqual({ role: 'user', content: '修改后的用户消息' });
  });

  it('编辑 AI 当前回复版本，不会覆盖其他版本', async () => {
    const { container, getByTitle, getByRole, getByLabelText } = await prepareRetry();
    streamPlan = { chunks: ['新回复'] };
    await fireEvent.click(getByTitle('重新生成'));
    await waitFor(() => {
      expect(container.querySelector('.variant-indicator')?.textContent).toBe('2/2');
      expect((getByTitle('下一条回复') as HTMLButtonElement).disabled).toBe(false);
    });
    await fireEvent.click(container.querySelector('.message-assistant button[title="编辑"]')!);
    const input = await waitFor(() => getByLabelText('消息内容'));
    await fireEvent.update(input, '编辑后的回复');
    await fireEvent.click(getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(storedMessages[1]?.variants).toEqual(['原回复', '编辑后的回复']);
      expect((getByTitle('上一条回复') as HTMLButtonElement).disabled).toBe(false);
    });
    await fireEvent.click(getByTitle('上一条回复'));
    await waitFor(() => expect(container.querySelector('.message-assistant')?.textContent).toContain('原回复'));
    await fireEvent.click(getByTitle('下一条回复'));
    await waitFor(() => expect(container.querySelector('.message-assistant')?.textContent).toContain('编辑后的回复'));
  });

  it('编辑保存失败保留输入，空白不能保存，取消保留原消息', async () => {
    const { container, getByRole, getByLabelText } = await prepareRetry();
    await fireEvent.click(container.querySelector('.message-assistant button[title="编辑"]')!);
    const input = await waitFor(() => getByLabelText('消息内容'));
    await fireEvent.update(input, '   ');
    expect((getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.update(input, '未保存的修改');
    messageMutationFails = true;
    await fireEvent.click(getByRole('button', { name: '保存' }));
    await waitFor(() => expect(container.querySelector('[role="alert"]')).toBeTruthy());
    expect((input as HTMLTextAreaElement).value).toBe('未保存的修改');
    expect(container.querySelector('.message-assistant')?.textContent).toContain('原回复');
    await fireEvent.click(getByRole('button', { name: '取消' }));
    await waitFor(() => expect(container.querySelector('.edit-message-modal')).toBeNull());
  });

  it('删除需要确认，失败保留消息，成功删除整条回复及所有版本', async () => {
    const { container, getByTitle, getByRole } = await prepareRetry();
    streamPlan = { chunks: ['新回复'] };
    await fireEvent.click(getByTitle('重新生成'));
    await waitFor(() => {
      expect(container.querySelector('.variant-indicator')?.textContent).toBe('2/2');
      expect(container.querySelector('button[title="重新生成"]')).toBeTruthy();
    });
    const openDelete = () => fireEvent.click(container.querySelector('.message-assistant button[title="删除"]')!);
    await openDelete();
    await fireEvent.click(getByRole('button', { name: '取消' }));
    expect(container.querySelectorAll('.message-item')).toHaveLength(2);
    messageMutationFails = true;
    await openDelete();
    await fireEvent.click(getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect((container.querySelector('button[title="删除"]') as HTMLButtonElement).disabled).toBe(false));
    expect(container.querySelectorAll('.message-item')).toHaveLength(2);
    messageMutationFails = false;
    await openDelete();
    await fireEvent.click(getByRole('button', { name: '确认删除' }));
    await waitFor(() => {
      expect(container.querySelector('.message-assistant')).toBeNull();
      expect(storedMessages).toHaveLength(1);
    });
    await fireEvent.click(container.querySelector('.message-user button[title="删除"]')!);
    await fireEvent.click(getByRole('button', { name: '确认删除' }));
    await waitFor(() => {
      expect(container.querySelectorAll('.message-item')).toHaveLength(0);
      expect(storedMessages).toHaveLength(0);
    });
  });

  it('临时会话可编辑和删除，生成期间禁用两个入口', async () => {
    streamPlan = { chunks: ['临时回复'], holdOpen: true };
    const { container, getByRole, getByLabelText } = await renderChatPage(true);
    await sendMessage(container, '临时消息');
    await waitFor(() => expect(chatCompletionBodies).toHaveLength(1));
    expect((container.querySelector('button[title="编辑"]') as HTMLButtonElement).disabled).toBe(true);
    expect((container.querySelector('button[title="删除"]') as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(getStopButton(container));
    await waitFor(() => expect((container.querySelector('button[title="编辑"]') as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(container.querySelector('.message-user button[title="编辑"]')!);
    const input = await waitFor(() => getByLabelText('消息内容'));
    await fireEvent.update(input, '修改临时消息');
    await fireEvent.click(getByRole('button', { name: '保存' }));
    await waitFor(() => expect(container.querySelector('.message-user')?.textContent).toContain('修改临时消息'));
    await fireEvent.click(container.querySelector('.message-user button[title="删除"]')!);
    await fireEvent.click(getByRole('button', { name: '确认删除' }));
    await waitFor(() => expect(container.querySelector('.message-user')).toBeNull());
    expect(conversationMutations).toHaveLength(0);
  });

  it('重试保留原回复，切换后保存选中版本，下一轮使用选中的内容', async () => {
    const { container, getByTitle } = await prepareRetry();
    streamPlan = { chunks: ['新回复'] };
    await fireEvent.click(getByTitle('重新生成'));

    await waitFor(() => {
      expect(container.querySelector('.variant-indicator')?.textContent).toBe('2/2');
      expect(container.querySelector('.message-assistant')?.textContent).toContain('新回复');
      expect(getSavedMessages().at(-1)).toMatchObject({
        content: '新回复', variants: ['原回复', '新回复'], activeVariantIndex: 1,
      });
      expect((getByTitle('上一条回复') as HTMLButtonElement).disabled).toBe(false);
    });
    expect(container.querySelectorAll('.message-item')).toHaveLength(2);
    expect(chatCompletionBodies[1]!.messages).toContainEqual({ role: 'user', content: '测试内容' });
    expect(chatCompletionBodies[1]!.messages).not.toContainEqual({ role: 'assistant', content: '原回复' });

    await fireEvent.click(getByTitle('上一条回复'));
    await waitFor(() => {
      expect(container.querySelector('.message-assistant')?.textContent).toContain('原回复');
      expect(getSavedMessages().at(-1)).toMatchObject({ content: '原回复', activeVariantIndex: 0 });
    });

    streamPlan = { chunks: ['下一轮回复'] };
    await sendMessage(container, '继续');
    await waitFor(() => expect(chatCompletionBodies).toHaveLength(3));
    expect(chatCompletionBodies[2]!.messages).toContainEqual({ role: 'assistant', content: '原回复' });
    expect(chatCompletionBodies[2]!.messages).not.toContainEqual({ role: 'assistant', content: '新回复' });
  });

  it('重试期间禁止按钮与滑动切换，取消后保留部分回复且不覆盖原版本', async () => {
    const { container, getByTitle } = await prepareRetry();
    streamPlan = { chunks: ['部分回复'], holdOpen: true };
    await fireEvent.click(getByTitle('重新生成'));
    await waitFor(() => {
      expect(container.querySelector('.message-assistant')?.textContent).toContain('部分回复');
    });
    expect((getByTitle('上一条回复') as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(getByTitle('上一条回复'));
    const reply = container.querySelector('.message-assistant')!;
    await fireEvent.touchStart(reply, { touches: [{ clientX: 20, clientY: 20 }] });
    await fireEvent.touchEnd(reply, { changedTouches: [{ clientX: 120, clientY: 20 }] });
    expect(container.querySelector('.variant-indicator')?.textContent).toBe('2/2');
    await fireEvent.click(getStopButton(container));
    await waitFor(() => {
      expect(getSavedMessages().at(-1)).toMatchObject({
        variants: ['原回复', '部分回复'], content: '部分回复', activeVariantIndex: 1,
      });
      expect((getByTitle('上一条回复') as HTMLButtonElement).disabled).toBe(false);
    });
    await fireEvent.click(getByTitle('上一条回复'));
    await waitFor(() => expect(reply.textContent).toContain('原回复'));
  });

  it('重试在预设加载期间取消时恢复原回复，不留下空版本', async () => {
    const { container, getByTitle } = await prepareRetry();
    armPresetGate();
    await fireEvent.click(getByTitle('重新生成'));
    await waitFor(() => expect(container.querySelector('.send-btn.stop-btn')).toBeTruthy());
    await fireEvent.click(getStopButton(container));
    releasePresetGate();
    await waitFor(() => {
      expect(container.querySelector('.message-assistant')?.textContent).toContain('原回复');
      expect(container.querySelector('.variant-switcher')).toBeNull();
      expect(getSavedMessages().at(-1)).toMatchObject({ content: '原回复' });
    });
    expect(chatCompletionBodies).toHaveLength(1);
    expect(getSavedMessages().at(-1).variants).toBeUndefined();
  });

  it('成功路径：发送后把用户消息与字符角色带进请求，并渲染流式回复', async () => {
    streamPlan = { chunks: ['你好', '，世界'] };

    const { container } = await renderChatPage();
    await sendMessage(container, '测试内容');

    await waitFor(() => {
      expect(chatCompletionBodies).toHaveLength(1);
    });

    const requestBody = chatCompletionBodies[0]!;

    // 发往上游的请求带上了预设模型，且用户输入作为 user 消息出现
    expect(requestBody.model).toBe(PRESET.model);
    expect(requestBody.stream).toBe(true);
    expect(requestBody.messages).toContainEqual({ role: 'user', content: '测试内容' });

    // 用户消息与流式拼接出的完整回复都渲染出来了
    await waitFor(() => {
      expect(container.textContent).toContain('测试内容');
      expect(container.textContent).toContain('你好，世界');
    });
  });

  it('成功路径：首条消息会创建持久化会话', async () => {
    streamPlan = { chunks: ['收到'] };

    const { container } = await renderChatPage();
    await sendMessage(container, '测试内容');

    await waitFor(() => {
      expect(conversationMutations.some(call => call.startsWith('POST /api/conversations'))).toBe(true);
    });

    // 流式结束后应把最终消息写回同一会话
    await waitFor(() => {
      expect(conversationMutations.some(call => call.startsWith('PUT /api/conversations/conv-1/messages'))).toBe(true);
    });
  });

  it('等待首段输出时不显示空白 AI 消息，真正输出后才显示', async () => {
    streamPlan = { chunks: [], holdOpen: true };
    const { container } = await renderChatPage();
    await sendMessage(container, '测试内容');
    await waitFor(() => expect(chatCompletionBodies).toHaveLength(1));
    expect(container.querySelector('.message-assistant')).toBeNull();
    expect(container.querySelector('.message-user')).toBeTruthy();
    expect(container.querySelector('.send-btn.stop-btn')).toBeTruthy();
    pushStreamContent?.('   ');
    expect(container.querySelector('.message-assistant')).toBeNull();
    pushStreamContent?.('实际回复');
    await waitFor(() => expect(container.querySelector('.message-assistant')?.textContent).toContain('实际回复'));
    await fireEvent.click(getStopButton(container));
    await waitFor(() => expect(container.querySelector('.send-btn.stop-btn')).toBeNull());
  });

  it('取消路径：请求中取消会把占位消息标记为已停止生成', async () => {
    streamPlan = { chunks: [], holdOpen: true };

    const { container } = await renderChatPage();
    await sendMessage(container, '测试内容');

    // 注意：停止按钮在 requestStatus 进入 sending 时就会出现，而那时预设还在加载、
    // 上游请求尚未发出。所以必须等请求真正发出后再取消。
    await waitFor(() => {
      expect(chatCompletionBodies).toHaveLength(1);
    });

    await waitFor(() => {
      expect(container.querySelector('.send-btn.stop-btn')).toBeTruthy();
    });

    await fireEvent.click(getStopButton(container));

    await waitFor(() => {
      expect(container.textContent).toContain('已停止生成');
    });

    // 取消不应被当成错误上报
    expect(container.textContent).not.toContain('错误:');
  });

  it('取消路径：预设加载期间取消不应发出上游请求，也不应留下空白占位消息', async () => {
    streamPlan = { chunks: ['不应到达前端'] };

    const { container } = await renderChatPage();

    // 挂住预设加载，制造真实的竞态窗口
    armPresetGate();
    await sendMessage(container, '测试内容');

    // 此时 requestStatus 已是 sending，用户能看到停止按钮，但上游请求还没发出
    await waitFor(() => {
      expect(container.querySelector('.send-btn.stop-btn')).toBeTruthy();
    });
    expect(chatCompletionBodies).toHaveLength(0);

    await fireEvent.click(getStopButton(container));
    releasePresetGate();

    // 取消必须生效：占位消息收尾为已停止生成
    await waitFor(() => {
      expect(container.textContent).toContain('已停止生成');
    });

    // 且上游请求一次都不该发出
    expect(chatCompletionBodies).toHaveLength(0);
    expect(container.textContent).not.toContain('错误:');
  });

  it('失败路径：上游 5xx 会把占位消息标记为错误并带上原因', async () => {
    streamPlan = { fail: true };

    const { container } = await renderChatPage();
    await sendMessage(container, '测试内容');

    await waitFor(() => {
      expect(container.textContent).toContain('错误:');
    });

    expect(container.textContent).toContain('上游炸了');
    expect(container.textContent).not.toContain('已停止生成');
  });
});
