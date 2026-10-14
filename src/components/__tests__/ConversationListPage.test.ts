// @vitest-environment happy-dom
/**
 * ConversationListPage 页面级测试。
 *
 * 覆盖用户可见链路：
 * - 加载：会话按 updatedAt 倒序渲染（标题 / 预览 / 角色徽标 / 相对时间）与总数
 * - 空状态：没有会话时给出引导文案
 * - 搜索：按标题、角色名、消息预览过滤，展示「搜索结果 x/y」，清空后恢复；无匹配给空结果提示
 * - 打开会话：点击条目跳转 `/chat/<id>`；临时会话入口跳转 `/chat`
 * - 重命名：弹窗预填旧标题 → 确定 → `PATCH /api/conversations/:id` + 列表刷新 + 提示；空名称不提交
 * - 删除：确认框 → `DELETE /api/conversations/:id` + 列表移除 + 提示
 * - 新建会话：角色选择器列出角色（无描述时兜底文案）→ 选中后跳转 `/chat/character/<id>`；没有角色时给空状态
 *
 * 设计约束与其他页面级测试一致：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   ConversationListPage -> useConversations -> conversationRepository
 *   -> requestJson -> fetch 这条链路。
 * - 断言只看用户可见行为、发往本地的请求内容，以及通知内容。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import ConversationListPage from '@/components/ConversationListPage.vue';
import { useNotifications } from '@/modules/notification';
import type { AICharacter, Conversation, Message } from '@/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const message = (id: string, content: string): Message => ({
  id,
  type: 'assistant',
  content,
  timestamp: NOW,
});

const character: AICharacter = {
  id: 'char-1',
  name: '小助手',
  description: '负责答疑',
  personality: '耐心',
  createdAt: 1,
};

const emptyCharacter: AICharacter = {
  id: 'char-2',
  name: '沉默者',
  description: '',
  personality: '',
  createdAt: 1,
};

const recentConversation: Conversation = {
  id: 'conv-1',
  title: '最近的会话',
  characterId: character.id,
  characterName: character.name,
  messages: [message('m1', '你好呀'), message('m2', '这是最后一条消息，用于预览')],
  createdAt: NOW - DAY,
  updatedAt: NOW - 1000,
};

const olderConversation: Conversation = {
  id: 'conv-2',
  title: '昨天的会话',
  characterName: '另一位角色',
  messages: [message('m3', '昨天聊的内容')],
  createdAt: NOW - 2 * DAY,
  updatedAt: NOW - DAY,
};

const emptyConversation: Conversation = {
  id: 'conv-3',
  title: '没有消息的会话',
  messages: [],
  createdAt: NOW - 3 * DAY,
  updatedAt: NOW - 2 * DAY,
};

/** 后端数据（每个用例重置） */
let store: Conversation[] = [];
let characters: AICharacter[] = [];

/** 观测到的请求 */
let requests: { method: string; url: string; body?: unknown }[] = [];

const { notifications, clearAll } = useNotifications();

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const getUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const handleRequest = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const url = getUrl(input);
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
  requests.push({ method, url, body });

  if (url.includes('/api/characters/ai')) {
    return jsonResponse(characters);
  }

  if (url.includes('/api/conversations')) {
    const id = url.split('/api/conversations/')[1];
    const conversationId = id ? decodeURIComponent(id.split('?')[0]!) : undefined;

    if (method === 'DELETE' && conversationId) {
      store = store.filter(item => item.id !== conversationId);
      return jsonResponse({ deleted: true });
    }

    if (method === 'PATCH' && conversationId) {
      const updates = (body?.updates ?? {}) as Partial<Conversation>;
      const index = store.findIndex(item => item.id === conversationId);
      if (index === -1) {
        return jsonResponse({ message: '会话不存在' }, 404);
      }
      store[index] = { ...store[index]!, ...updates };
      return jsonResponse(store[index]);
    }

    return jsonResponse(store);
  }

  return jsonResponse({});
};

const fetchMock = vi.fn(handleRequest);

// ==================== 选择器 ====================

const q = <T extends Element>(root: ParentNode, selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`未找到元素：${selector}`);
  return element;
};

const byText = <T extends HTMLElement>(root: ParentNode, selector: string, text: string): T => {
  const found = Array.from(root.querySelectorAll<T>(selector))
    .find(element => element.textContent?.trim() === text);
  if (!found) throw new Error(`未找到文本为「${text}」的 ${selector}`);
  return found;
};

const getItems = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('.conversation-item'));

const getItemTitles = (root: ParentNode): (string | undefined)[] =>
  getItems(root).map(item => item.querySelector('.conversation-name')?.textContent?.trim());

const getItem = (root: ParentNode, title: string): HTMLElement => {
  const item = getItems(root).find(el => el.querySelector('.conversation-name')?.textContent?.trim() === title);
  if (!item) throw new Error(`未找到会话条目：${title}`);
  return item;
};

/** 确认框通过 Teleport 挂到 body */
const getConfirmButton = (): HTMLButtonElement => q<HTMLButtonElement>(document.body, '.btn-confirm');

const toastTitles = (): string[] => notifications.value.map(item => item.title);

const toastMessage = (title: string): string | undefined =>
  notifications.value.find(item => item.title === title)?.message;

/** 重命名弹窗（Modal 不 Teleport） */
const getRenameModal = (root: ParentNode): HTMLElement => {
  const modal = Array.from(root.querySelectorAll<HTMLElement>('.modal-content'))
    .find(el => el.querySelector('.modal-title')?.textContent?.trim() === '重命名会话');
  if (!modal) throw new Error('未找到重命名会话弹窗');
  return modal;
};

const requestsOf = (method: string): { method: string; url: string; body?: unknown }[] =>
  requests.filter(entry => entry.method === method);

/** 页头右侧的「+」按钮（第一个 .nav-btn 是返回键） */
const getAddButton = (root: ParentNode): HTMLElement => {
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('.page-header .nav-btn'));
  return buttons[buttons.length - 1]!;
};

const renderPage = async (): Promise<{ view: RenderResult; router: Router }> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/chat', component: { template: '<div class="chat-stub" />' } },
      { path: '/chat/:id', component: { template: '<div class="chat-stub" />' } },
      { path: '/chat/character/:id', component: { template: '<div class="chat-stub" />' } },
    ],
  });
  await router.push('/');
  await router.isReady();

  const view = render(ConversationListPage, { global: { plugins: [router] } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  // 列表渲染完成：有会话时至少出现一个条目
  await waitFor(() => expect(store.length === 0 || view.container.querySelector('.conversation-item')).not.toBeNull());
  return { view, router };
};

beforeEach(() => {
  store = [structuredClone(recentConversation), structuredClone(olderConversation), structuredClone(emptyConversation)];
  characters = [structuredClone(character), structuredClone(emptyCharacter)];
  requests = [];
  clearAll();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  clearAll();
  cleanup();
  vi.unstubAllGlobals();
});

describe('ConversationListPage 列表与搜索', () => {
  it('按 updatedAt 倒序渲染，并展示预览、角色徽标与总数', async () => {
    const { view } = await renderPage();

    expect(getItemTitles(view.container)).toEqual(['最近的会话', '昨天的会话', '没有消息的会话']);
    expect(q(view.container, '.conversation-count').textContent?.trim()).toBe('3');

    const recent = getItem(view.container, '最近的会话');
    expect(q(recent, '.conversation-preview').textContent?.trim()).toBe('这是最后一条消息，用于预览');
    expect(q(recent, '.conversation-character').textContent?.trim()).toBe(character.name);
    // 今天更新的会话显示「今天」
    expect(q(recent, '.conversation-time').textContent?.trim()).toBe('今天');

    // 昨天更新的会话显示「昨天」并带自己的角色徽标
    const older = getItem(view.container, '昨天的会话');
    expect(q(older, '.conversation-time').textContent?.trim()).toBe('昨天');
    expect(q(older, '.conversation-character').textContent?.trim()).toBe('另一位角色');

    // 无消息的会话给出兜底预览，没有角色名时不渲染徽标
    const noMessage = getItem(view.container, '没有消息的会话');
    expect(q(noMessage, '.conversation-preview').textContent?.trim()).toBe('暂无消息');
    expect(noMessage.querySelector('.conversation-character')).toBeNull();
  });

  it('没有会话时给出空状态引导', async () => {
    store = [];

    const { view } = await renderPage();

    expect(view.getByText('暂无角色会话')).toBeTruthy();
    expect(view.getByText('点击上方临时会话开始对话')).toBeTruthy();
    // 没有会话时不渲染搜索框
    expect(view.container.querySelector('.search-input')).toBeNull();
  });

  it('搜索按标题、角色名与消息预览过滤，并展示计数', async () => {
    const { view } = await renderPage();
    const search = q<HTMLInputElement>(view.container, '.search-input');

    await fireEvent.update(search, '昨天聊的');
    await waitFor(() => expect(getItemTitles(view.container)).toEqual(['昨天的会话']));
    expect(q(view.container, '.search-result-count').textContent?.trim()).toBe('搜索结果 1/3');

    // 角色名命中的也要出现
    await fireEvent.update(search, '小助手');
    await waitFor(() => expect(getItemTitles(view.container)).toEqual(['最近的会话']));

    // 无匹配：给出空结果提示
    await fireEvent.update(search, '根本不存在的关键词');
    await waitFor(() => expect(view.getByText('未找到匹配的会话')).toBeTruthy());
    expect(view.getByText('请尝试其他关键词：根本不存在的关键词')).toBeTruthy();

    // 点清空图标恢复全部
    await fireEvent.click(q(view.container, '.clear-icon'));
    await waitFor(() => expect(getItemTitles(view.container)).toHaveLength(3));
    expect(view.container.querySelector('.search-result-count')).toBeNull();
    expect(search.value).toBe('');
  });
});

describe('ConversationListPage 跳转', () => {
  it('点击会话进入对应会话，点击临时会话进入临时会话', async () => {
    const { view, router } = await renderPage();

    await fireEvent.click(getItem(view.container, '最近的会话'));
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe(`/chat/${recentConversation.id}`));

    await fireEvent.click(q(view.container, '.temp-chat-banner'));
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/chat'));
  });

  it('角色选择器列出角色并跳转到该角色的会话', async () => {
    const { view, router } = await renderPage();

    await fireEvent.click(getAddButton(view.container));
    await waitFor(() => expect(view.getByText('选择AI角色')).toBeTruthy());

    const options = view.container.querySelectorAll<HTMLElement>('.character-option');
    expect(options).toHaveLength(2);
    expect(q(options[0]!, '.character-option-name').textContent?.trim()).toBe(character.name);
    expect(q(options[0]!, '.character-option-desc').textContent?.trim()).toBe(character.description);
    // 没有描述时兜底
    expect(q(options[1]!, '.character-option-desc').textContent?.trim()).toBe('暂无描述');

    await fireEvent.click(options[0]!);
    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe(`/chat/character/${character.id}`));
  });

  it('后端没有AI角色时，选择器兜底到内置默认角色', async () => {
    characters = [];

    const { view } = await renderPage();
    await fireEvent.click(getAddButton(view.container));

    // loadAICharacters 在拿到空数组时会回落 DEFAULT_AI_CHARACTERS，所以不会出现空状态
    await waitFor(() => expect(view.getByText('选择AI角色')).toBeTruthy());
    const names = Array.from(view.container.querySelectorAll('.character-option-name'))
      .map(el => el.textContent?.trim());
    expect(names).toEqual(['助手']);
  });
});

describe('ConversationListPage 重命名与删除', () => {
  it('重命名：弹窗预填旧名称，确定后写入并提示', async () => {
    const { view } = await renderPage();

    await fireEvent.click(q(getItem(view.container, '最近的会话'), '.edit-btn'));
    const modal = getRenameModal(view.container);
    const input = q<HTMLInputElement>(modal, '.form-input');
    expect(input.value).toBe('最近的会话');

    await fireEvent.update(input, '改名后的会话');
    await fireEvent.click(byText<HTMLButtonElement>(modal, '.modal-btn', '确定'));

    await waitFor(() => expect(requestsOf('PATCH')).toHaveLength(1));
    expect(requestsOf('PATCH')[0]!.url).toContain(`/api/conversations/${recentConversation.id}`);
    expect(requestsOf('PATCH')[0]!.body).toEqual({ updates: { title: '改名后的会话' } });
    await waitFor(() => expect(getItemTitles(view.container)).toContain('改名后的会话'));
    await waitFor(() => expect(toastTitles()).toContain('会话已重命名'));
    expect(toastMessage('会话已重命名')).toContain('改名后的会话');
  });

  it('重命名：名称为空或纯空格时不提交', async () => {
    const { view } = await renderPage();

    await fireEvent.click(q(getItem(view.container, '最近的会话'), '.edit-btn'));
    const modal = getRenameModal(view.container);
    await fireEvent.update(q<HTMLInputElement>(modal, '.form-input'), '   ');
    await fireEvent.click(byText<HTMLButtonElement>(modal, '.modal-btn', '确定'));

    await waitFor(() => expect(getRenameModal(view.container)).not.toBeNull());
    expect(requestsOf('PATCH')).toHaveLength(0);
    expect(getItemTitles(view.container)).toContain('最近的会话');
  });

  it('删除：确认后调用 DELETE、从列表移除并提示', async () => {
    const { view } = await renderPage();

    await fireEvent.click(q(getItem(view.container, '昨天的会话'), '.delete-btn'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(requestsOf('DELETE')).toHaveLength(1));
    expect(requestsOf('DELETE')[0]!.url).toContain(`/api/conversations/${olderConversation.id}`);
    await waitFor(() => expect(getItemTitles(view.container)).toEqual(['最近的会话', '没有消息的会话']));
    expect(q(view.container, '.conversation-count').textContent?.trim()).toBe('2');
    await waitFor(() => expect(toastTitles()).toContain('会话已删除'));
  });
});
