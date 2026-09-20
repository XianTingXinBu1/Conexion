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
  maxTokens: 2048,
  maxOutputTokens: 4096,
  contextLength: 8192,
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
}

let streamPlan: StreamPlan = {};
let chatCompletionBodies: Record<string, unknown>[] = [];
let conversationMutations: string[] = [];

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
        return;
      }

      settled = true;
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

    if (method === 'PUT') {
      const payload = JSON.parse(String(init.body)) as { messages: unknown[] };
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

const renderChatPage = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });

  const view = render(ChatPage, {
    props: { characterId: CHARACTER.id },
    global: { plugins: [router] },
  });

  // 等角色加载完成，确认挂载期异步初始化已经落定
  await waitFor(() => {
    expect(view.container.querySelector('.chat-title')?.textContent).toBe(CHARACTER.name);
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
  chatCompletionBodies = [];
  conversationMutations = [];
  localStorage.clear();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatPage 发送链路', () => {
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
