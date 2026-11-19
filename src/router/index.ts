import { createRouter, createWebHashHistory, type RouteLocationRaw, type RouteRecordRaw } from 'vue-router';

const MainPage = () => import('@/components/MainPage.vue');
const ChatPage = () => import('@/components/ChatPage.vue');
const ApiPresetPage = () => import('@/components/ApiPresetPage.vue');
const SettingsPage = () => import('@/components/SettingsPage.vue');
const ConversationListPage = () => import('@/components/ConversationListPage.vue');
const RegexScriptPage = () => import('@/components/RegexScriptPage.vue');
const RoleManagementPage = () => import('@/components/RoleManagementPage.vue');
const PromptPresetPage = () => import('@/components/PromptPresetPage.vue');
const KnowledgeBasePage = () => import('@/components/KnowledgeBasePage.vue');

const routePrefetchers = {
  main: MainPage,
  'conversation-list': ConversationListPage,
  chat: ChatPage,
  'chat-character': ChatPage,
  'chat-conversation': ChatPage,
  'api-preset': ApiPresetPage,
  settings: SettingsPage,
  'regex-script': RegexScriptPage,
  'role-management': RoleManagementPage,
  'prompt-preset': PromptPresetPage,
  'knowledge-base': KnowledgeBasePage,
} as const;

type PrefetchableRouteName = keyof typeof routePrefetchers;

const prefetchedRouteNames = new Set<PrefetchableRouteName>();

/**
 * 把路径字符串归一成路由名。
 *
 * 动态路由（`/chat/123`、`/chat/character/123`）以前全部落到 default 返回 null，
 * 按路径预取时被静默跳过。这三条实际都是同一个 ChatPage chunk，归一成 'chat' 即可。
 */
const normalizeRoutePath = (rawPath: string): PrefetchableRouteName | null => {
  // 同时剥掉 query 与 hash：`/chat#anchor`、`/chat?foo=1`
  const pathWithoutSuffix = rawPath.split(/[?#]/)[0] || '/';
  // 去掉尾部斜杠（根路径除外）
  const path = pathWithoutSuffix.length > 1
    ? pathWithoutSuffix.replace(/\/+$/, '')
    : pathWithoutSuffix;

  switch (path) {
    case '/':
      return 'main';
    case '/conversation-list':
      return 'conversation-list';
    case '/chat':
      return 'chat';
    case '/api-preset':
      return 'api-preset';
    case '/settings':
      return 'settings';
    case '/regex-script':
      return 'regex-script';
    case '/role-management':
      return 'role-management';
    case '/prompt-preset':
      return 'prompt-preset';
    case '/knowledge-base':
      return 'knowledge-base';
    default:
      break;
  }

  // `/chat/character/:characterId` 与 `/chat/:conversationId`（注意顺序：更具体的先判）
  if (/^\/chat\/character\/[^/]+$/.test(path) || /^\/chat\/[^/]+$/.test(path)) {
    return 'chat';
  }

  return null;
};

const normalizeRouteName = (target: RouteLocationRaw): PrefetchableRouteName | null => {
  if (typeof target === 'string') {
    return normalizeRoutePath(target);
  }

  // 不能直接用 `in`：它会沿原型链查找，'toString' / 'constructor' / 'hasOwnProperty'
  // 都会命中，随后 `routePrefetchers[name]()` 会调用到非预取函数上
  if (
    'name' in target &&
    typeof target.name === 'string' &&
    Object.prototype.hasOwnProperty.call(routePrefetchers, target.name)
  ) {
    return target.name as PrefetchableRouteName;
  }

  if ('path' in target && typeof target.path === 'string') {
    return normalizeRouteName(target.path);
  }

  return null;
};

export const prefetchRouteComponents = async (targets: RouteLocationRaw[]) => {
  const uniqueTargets = targets
    .map(normalizeRouteName)
    .filter((name): name is PrefetchableRouteName => Boolean(name))
    .filter((name, index, names) => names.indexOf(name) === index);

  await Promise.all(
    uniqueTargets.map(async (name) => {
      if (prefetchedRouteNames.has(name)) {
        return;
      }

      prefetchedRouteNames.add(name);

      try {
        await routePrefetchers[name]();
      } catch (error) {
        prefetchedRouteNames.delete(name);
        console.warn(`[router] Failed to prefetch route component for "${name}"`, error);
      }
    }),
  );
};

export const prefetchRouteComponent = async (target: RouteLocationRaw) => {
  await prefetchRouteComponents([target]);
};

// 定义路由
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'main',
    component: MainPage,
    meta: { title: '首页' },
  },
  {
    path: '/conversation-list',
    name: 'conversation-list',
    component: ConversationListPage,
    meta: { title: '会话列表' },
  },
  {
    path: '/chat',
    name: 'chat',
    component: ChatPage,
    meta: { title: '聊天' },
  },
  {
    path: '/chat/character/:characterId',
    name: 'chat-character',
    component: ChatPage,
    meta: { title: '聊天' },
    props: (route) => ({ characterId: route.params.characterId }),
  },
  {
    path: '/chat/:conversationId',
    name: 'chat-conversation',
    component: ChatPage,
    meta: { title: '聊天' },
    props: true,
  },
  {
    path: '/api-preset',
    name: 'api-preset',
    component: ApiPresetPage,
    meta: { title: 'API 预设' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: { title: '设置' },
  },
  {
    path: '/regex-script',
    name: 'regex-script',
    component: RegexScriptPage,
    meta: { title: '正则脚本' },
  },
  {
    path: '/role-management',
    name: 'role-management',
    component: RoleManagementPage,
    meta: { title: '角色管理' },
  },
  {
    path: '/prompt-preset',
    name: 'prompt-preset',
    component: PromptPresetPage,
    meta: { title: '提示词预设' },
  },
  {
    path: '/knowledge-base',
    name: 'knowledge-base',
    component: KnowledgeBasePage,
    meta: { title: '知识库' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// 全局前置守卫 - 设置页面标题
router.beforeEach((to, _from, next) => {
  if (to.name === 'main') {
    document.title = 'Conexion';
  } else if (to.meta.title) {
    document.title = `${to.meta.title} - Conexion`;
  }
  next();
});

// 导出 router
export default router;

// 导出类型
export type Router = typeof router;
