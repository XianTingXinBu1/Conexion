import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const MainPage = () => import('@/components/MainPage.vue');
const ChatPage = () => import('@/components/ChatPage.vue');
const ApiPresetPage = () => import('@/components/ApiPresetPage.vue');
const SettingsPage = () => import('@/components/SettingsPage.vue');
const ConversationListPage = () => import('@/components/ConversationListPage.vue');
const RegexScriptPage = () => import('@/components/RegexScriptPage.vue');
const RoleManagementPage = () => import('@/components/RoleManagementPage.vue');
const PromptPresetPage = () => import('@/components/PromptPresetPage.vue');
const KnowledgeBasePage = () => import('@/components/KnowledgeBasePage.vue');

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
