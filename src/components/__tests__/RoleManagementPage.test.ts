// @vitest-environment happy-dom
/**
 * RoleManagementPage 页面级测试。
 *
 * 覆盖用户可见链路：
 * - 加载：默认停在用户角色页签，恢复上次选中的用户角色并打上选中态；没有存储值时回落到第一个
 * - 切换页签：AI 角色卡片展示版本 / 作者元信息
 * - 选中用户角色：写入 `conexion_selected_user_character`
 * - 新建用户角色：「+」→ 创建方式弹窗（用户角色不提供导入入口）→ 编辑器名称必填 → 落库 + 提示
 * - 新建 AI 角色：绑定知识库 + 逗号/顿号分隔的标签 → 落库为数组字段
 * - 编辑角色：编辑器预填原值 → 改名落库 + 提示
 * - 删除角色：确认框 → 落库移除 + 提示；删除的是当前用户角色时把选中让给剩下的第一个
 * - 只剩一个用户角色时删除按钮禁用（避免删空）
 * - 导出：下载角色卡并提示
 * - 导入：备份文件新增角色（分配新 id、丢弃指向已不存在知识库的绑定）+ 提示并切到 AI 页签
 * - 导入失败：非法 JSON 给出失败原因
 *
 * 设计约束与其他页面级测试一致：
 * - 只在 fetch 边界打桩，不 mock 业务模块，因此会真实穿过
 *   RoleManagementPage -> characterRepository / settingsRepository
 *   -> requestJson -> fetch 这条链路。
 * - 断言只看用户可见行为、发往本地的请求内容，以及通知内容。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, type RenderResult } from '@testing-library/vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import RoleManagementPage from '@/components/RoleManagementPage.vue';
import { useNotifications } from '@/modules/notification';
import type { AICharacter, KnowledgeBase, UserCharacter } from '@/types';

const SETTING_KEY = 'conexion_selected_user_character';

const userA: UserCharacter = { id: 'user-1', name: '小明', description: '本人', createdAt: 1 };
const userB: UserCharacter = { id: 'user-2', name: '小红', description: '另一个人格', createdAt: 2 };

const aiA: AICharacter = {
  id: 'ai-1',
  name: '助手',
  description: '友好',
  personality: '耐心',
  characterVersion: '1.2',
  creator: '作者甲',
  createdAt: 1,
};

const knowledgeBase: KnowledgeBase = {
  id: 'kb-1',
  name: '设定集',
  description: '',
  entries: [],
  globallyEnabled: false,
  createdAt: 1,
  updatedAt: 1,
};

/** 后端数据（每个用例重置） */
let userStore: UserCharacter[] = [];
let aiStore: AICharacter[] = [];
let knowledgeBaseStore: KnowledgeBase[] = [];
let settingsStore: Record<string, unknown> = {};

/** 观测到的请求 */
let savedUsers: UserCharacter[][] = [];
let savedAIs: AICharacter[][] = [];
let savedSettings: { key: string; value: unknown }[] = [];

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

  if (url.includes('/api/characters/users')) {
    if (method === 'PUT') {
      userStore = structuredClone(body?.characters as UserCharacter[]);
      savedUsers.push(structuredClone(userStore));
      return jsonResponse(userStore);
    }
    return jsonResponse(userStore);
  }

  if (url.endsWith('/api/characters/ai')) {
    if (method === 'PUT') {
      aiStore = structuredClone(body?.characters as AICharacter[]);
      savedAIs.push(structuredClone(aiStore));
      return jsonResponse(aiStore);
    }
    return jsonResponse(aiStore);
  }

  if (url.includes('/api/knowledge-bases')) {
    return jsonResponse(knowledgeBaseStore);
  }

  if (url.includes('/api/settings/')) {
    const key = decodeURIComponent(url.split('/api/settings/')[1]!.split('?')[0]!);
    if (method === 'PUT') {
      settingsStore[key] = body?.value;
      savedSettings.push({ key, value: body?.value });
      return jsonResponse({ value: body?.value });
    }
    return jsonResponse({ value: settingsStore[key] });
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

const getCards = (root: ParentNode): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-testid="character-card"]'));

const getCard = (root: ParentNode, name: string): HTMLElement => {
  const card = getCards(root).find(el => el.querySelector('.character-name')?.textContent?.trim() === name);
  if (!card) throw new Error(`未找到角色卡片：${name}`);
  return card;
};

/** 弹窗（Modal 不 Teleport） */
const getModal = (root: ParentNode, title: string): HTMLElement => {
  const modal = Array.from(root.querySelectorAll<HTMLElement>('.modal-content'))
    .find(el => el.querySelector('.modal-title')?.textContent?.trim() === title);
  if (!modal) throw new Error(`未找到标题为「${title}」的弹窗`);
  return modal;
};

const getEditor = (root: ParentNode): HTMLElement => q<HTMLElement>(root, '[data-testid="character-editor"]');

const getConfirmButton = (): HTMLButtonElement => q<HTMLButtonElement>(document.body, '.btn-confirm');

const toastTitles = (): string[] => notifications.value.map(item => item.title);

const toastMessage = (title: string): string | undefined =>
  notifications.value.find(item => item.title === title)?.message;

/** 页头右侧的动作按钮（第一个 .nav-btn 是返回键） */
const getActionButton = (root: ParentNode): HTMLElement => {
  const buttons = Array.from(root.querySelectorAll<HTMLElement>('.page-header .nav-btn'));
  return buttons[buttons.length - 1]!;
};

/** 打开编辑器：必须先在创建方式弹窗里选「从空白创建」 */
const openCreateEditor = async (view: RenderResult): Promise<HTMLElement> => {
  await fireEvent.click(getActionButton(view.container));
  const modal = getModal(view.container, userTabTitle(view));
  await fireEvent.click(byText<HTMLButtonElement>(modal, '.create-option', '从空白创建'));
  await waitFor(() => expect(view.container.querySelector('[data-testid="character-editor"]')).not.toBeNull());
  return getEditor(view.container);
};

/** 当前页签对应的新建弹窗标题 */
const userTabTitle = (view: RenderResult): string =>
  q(view.container, '.tab-btn.active').textContent?.includes('AI') ? '新建 AI 角色' : '新建用户角色';

const switchTab = async (view: RenderResult, label: '用户角色' | 'AI角色') => {
  await fireEvent.click(byText<HTMLButtonElement>(view.container, '.tab-btn', label));
  await waitFor(() => expect(q(view.container, '.tab-btn.active').textContent).toContain(label));
};

const renderPage = async (): Promise<RenderResult> => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  });
  await router.push('/');
  await router.isReady();

  const view = render(RoleManagementPage, { global: { plugins: [router] } });
  await waitFor(() => expect(getCards(view.container).length).toBeGreaterThan(0));
  // onMounted 里依次加载用户角色 → AI 角色 → 选中的用户角色，
  // 选中态是最后一步落到 DOM 的信号，等它出现再断言才能避免半加载状态。
  await waitFor(() =>
    expect(getCards(view.container).some(card => card.className.includes('character-card--selected'))).toBe(true)
  );
  return view;
};

beforeEach(() => {
  userStore = [structuredClone(userA), structuredClone(userB)];
  aiStore = [structuredClone(aiA)];
  knowledgeBaseStore = [structuredClone(knowledgeBase)];
  settingsStore = { [SETTING_KEY]: userA.id };
  savedUsers = [];
  savedAIs = [];
  savedSettings = [];
  clearAll();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});

afterEach(() => {
  clearAll();
  cleanup();
  vi.unstubAllGlobals();
});

describe('RoleManagementPage 列表与选中', () => {
  it('默认停在用户角色页签，并恢复上次选中的角色', async () => {
    const view = await renderPage();

    expect(q(view.container, '.tab-btn.active').textContent).toContain('用户角色');
    expect(view.getByText('用户角色 (2)')).toBeTruthy();
    expect(getCards(view.container)).toHaveLength(2);
    expect(getCard(view.container, userA.name).className).toContain('character-card--selected');
    expect(getCard(view.container, userB.name).className).not.toContain('character-card--selected');
  });

  it('没有存储过选中值时回落到第一个用户角色', async () => {
    settingsStore = {};

    const view = await renderPage();

    expect(getCard(view.container, userA.name).className).toContain('character-card--selected');
    expect(savedSettings).toEqual([]);
  });

  it('选中另一个用户角色时写回设置', async () => {
    const view = await renderPage();

    await fireEvent.click(q(getCard(view.container, userB.name), '.select-btn'));

    await waitFor(() => expect(savedSettings).toEqual([{ key: SETTING_KEY, value: userB.id }]));
    expect(getCard(view.container, userB.name).className).toContain('character-card--selected');
    expect(getCard(view.container, userA.name).className).not.toContain('character-card--selected');
  });

  it('切到 AI 页签：展示版本 / 作者元信息', async () => {
    const view = await renderPage();

    await switchTab(view, 'AI角色');

    expect(view.getByText('AI角色 (1)')).toBeTruthy();
    expect(q(getCard(view.container, aiA.name), '.character-meta').textContent?.trim()).toBe('版本：1.2 · 作者：作者甲');
  });
});

describe('RoleManagementPage 新建与编辑', () => {
  it('新建用户角色：名称必填，填写后落库并提示（页签里没有导入入口）', async () => {
    const view = await renderPage();

    await fireEvent.click(getActionButton(view.container));
    const modal = getModal(view.container, '新建用户角色');
    const options = Array.from(modal.querySelectorAll('.create-option')).map(el => el.textContent?.trim());
    expect(options).toEqual(['从空白创建']);

    await fireEvent.click(byText<HTMLButtonElement>(modal, '.create-option', '从空白创建'));
    const editor = getEditor(view.container);
    expect(q(editor, '.editor-title').textContent?.trim()).toBe('新建用户角色');

    const saveButton = q<HTMLButtonElement>(editor, '[data-testid="editor-save"]');
    expect(saveButton.disabled).toBe(true);

    await fireEvent.update(q<HTMLInputElement>(editor, '[data-testid="editor-name"]'), '新用户');
    expect(saveButton.disabled).toBe(false);
    await fireEvent.click(saveButton);

    await waitFor(() => expect(savedUsers.length).toBe(1));
    expect(savedUsers[0]!.map(item => item.name)).toEqual(['小明', '小红', '新用户']);
    await waitFor(() => expect(toastTitles()).toContain('角色已添加'));
    expect(toastMessage('角色已添加')).toContain('用户角色 "新用户"');
    await waitFor(() => expect(view.container.querySelector('[data-testid="character-editor"]')).toBeNull());
    expect(getCards(view.container)).toHaveLength(3);
  });

  it('新建 AI 角色：绑定知识库、标签按逗号顿号切分', async () => {
    const view = await renderPage();
    await switchTab(view, 'AI角色');

    const editor = await openCreateEditor(view);
    expect(q(editor, '.editor-title').textContent?.trim()).toBe('新建AI 角色');

    // 编辑器里的 input 顺序：名称、作者、版本、标签
    const inputs = editor.querySelectorAll<HTMLInputElement>('input.form-input');
    await fireEvent.update(inputs[0]!, '新AI角色');
    await fireEvent.update(inputs[3]!, '冒险, 日常、轻松');

    // 知识库下拉：绑定设定集
    const select = q<HTMLSelectElement>(editor, 'select.editor-select');
    await fireEvent.update(select, knowledgeBase.id);

    await fireEvent.click(q<HTMLButtonElement>(editor, '[data-testid="editor-save"]'));

    await waitFor(() => expect(savedAIs.length).toBe(1));
    const created = savedAIs[0]!.find(item => item.name === '新AI角色')!;
    expect(created).toBeTruthy();
    expect(created.knowledgeBaseId).toBe(knowledgeBase.id);
    expect(created.tags).toEqual(['冒险', '日常', '轻松']);
    await waitFor(() => expect(toastTitles()).toContain('角色已添加'));
    expect(toastMessage('角色已添加')).toContain('AI角色 "新AI角色"');
  });

  it('编辑角色：编辑器预填原值，改名后落库并提示', async () => {
    const view = await renderPage();

    await fireEvent.click(q(getCard(view.container, userA.name), '.action-btn'));
    const editor = getEditor(view.container);
    expect(q(editor, '.editor-title').textContent?.trim()).toBe('编辑用户角色');
    const nameInput = q<HTMLInputElement>(editor, '[data-testid="editor-name"]');
    expect(nameInput.value).toBe(userA.name);

    await fireEvent.update(nameInput, '小明改名');
    await fireEvent.click(byText<HTMLButtonElement>(editor, '.form-action-btn', '保存'));

    await waitFor(() => expect(savedUsers.length).toBe(1));
    expect(savedUsers[0]!.map(item => item.name)).toEqual(['小明改名', '小红']);
    await waitFor(() => expect(toastTitles()).toContain('角色已更新'));
    expect(toastMessage('角色已更新')).toContain('用户角色 "小明改名"');
  });
});

describe('RoleManagementPage 删除与导入导出', () => {
  it('删除当前用户角色：确认后落库移除，并把选中让给剩下的第一个', async () => {
    const view = await renderPage();

    await fireEvent.click(q(getCard(view.container, userA.name), '.action-btn--delete'));
    await waitFor(() => expect(document.body.querySelector('.btn-confirm')).not.toBeNull());
    expect(document.body.textContent).toContain(userA.name);
    await fireEvent.click(getConfirmButton());

    await waitFor(() => expect(savedUsers.length).toBe(1));
    expect(savedUsers[0]!.map(item => item.id)).toEqual([userB.id]);
    await waitFor(() => expect(toastTitles()).toContain('角色已删除'));
    await waitFor(() => expect(getCards(view.container)).toHaveLength(1));
    expect(getCard(view.container, userB.name).className).toContain('character-card--selected');
    expect(savedSettings).toContainEqual({ key: SETTING_KEY, value: userB.id });
  });

  it('只剩一个用户角色时删除按钮禁用', async () => {
    userStore = [structuredClone(userA)];

    const view = await renderPage();

    expect(q<HTMLButtonElement>(getCard(view.container, userA.name), '.action-btn--delete').disabled).toBe(true);
  });

  it('导出 AI 角色：触发下载并提示', async () => {
    const view = await renderPage();
    await switchTab(view, 'AI角色');

    // 卡片动作顺序：导出、编辑、删除
    await fireEvent.click(q(getCard(view.container, aiA.name), '.action-btn'));

    await waitFor(() => expect(toastTitles()).toContain('已导出'));
    expect(toastMessage('已导出')).toContain('1');
    expect(savedAIs).toEqual([]);
  });

  it('导入备份：新增角色分配新 id，并丢弃指向已不存在知识库的绑定', async () => {
    const view = await renderPage();
    await switchTab(view, 'AI角色');

    await fireEvent.click(getActionButton(view.container));
    const modal = getModal(view.container, '新建 AI 角色');
    await fireEvent.click(byText<HTMLButtonElement>(modal, '.create-option', '导入角色卡'));

    const payload = {
      spec: 'conexion.characters/v1',
      characters: [
        { name: '导入甲', description: '甲的描述', personality: '甲的性格', knowledgeBaseId: knowledgeBase.id },
        { name: '导入乙', description: '', personality: '', knowledgeBaseId: '已经删掉的库' },
      ],
    };
    const fileInput = q<HTMLInputElement>(view.container, '[data-testid="character-import-input"]');
    const file = new File([JSON.stringify(payload)], 'characters.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    await fireEvent.change(fileInput);

    await waitFor(() => expect(savedAIs.length).toBe(1));
    const imported = savedAIs[0]!.slice(1);
    expect(imported.map(item => item.name)).toEqual(['导入甲', '导入乙']);
    expect(imported.every(item => item.id.startsWith('imported-'))).toBe(true);
    // 有效的知识库绑定保留，失效的丢弃
    expect(imported[0]!.knowledgeBaseId).toBe(knowledgeBase.id);
    expect(imported[1]!.knowledgeBaseId).toBeUndefined();

    await waitFor(() => expect(toastTitles()).toContain('导入完成'));
    expect(toastMessage('导入完成')).toContain('2');
    // 导入后自动切到 AI 页签并列出新角色
    expect(q(view.container, '.tab-btn.active').textContent).toContain('AI角色');
    await waitFor(() => expect(getCards(view.container)).toHaveLength(3));
  });

  it('导入失败：非法 JSON 给出失败原因', async () => {
    const view = await renderPage();
    await switchTab(view, 'AI角色');

    const fileInput = q<HTMLInputElement>(view.container, '[data-testid="character-import-input"]');
    const file = new File(['这不是 JSON'], 'broken.json', { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    await fireEvent.change(fileInput);

    await waitFor(() => expect(toastTitles()).toContain('导入失败'));
    expect(toastMessage('导入失败')).toBe('不是合法的 JSON 文件');
    expect(savedAIs).toEqual([]);
  });
});
