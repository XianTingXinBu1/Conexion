import { ref, nextTick } from 'vue';
import { useNotifications, getNotificationMessage } from '@/modules/notification';
import { STORAGE_KEYS } from '@/constants';
import { getStorage } from '@/utils/storage';
import type { AICharacter, Conversation } from '@/types';

export type PageType = 'main' | 'chat' | 'api-preset' | 'settings' | 'conversation-list' | 'regex-script' | 'role-management' | 'prompt-preset' | 'knowledge-base';

export type TransitionName = 'slide-forward' | 'slide-back';

export function useNavigation() {
  const currentPage = ref<PageType>('main');
  const previousPage = ref<'main' | 'conversation-list'>('main');
  const transitionName = ref<TransitionName>('slide-forward');
  const pageHistory = ref<string[]>(['main']);
  const isNavigating = ref(false); // 防止快速连续导航导致历史栈混乱

  const { showWarning } = useNotifications();

  // 当前选中的AI角色
  const currentCharacter = ref<AICharacter | undefined>();

  // 当前会话ID
  const currentConversationId = ref<string | undefined>();

  /**
   * 进入临时会话
   */
  const navigateToChat = (from: 'main' | 'conversation-list' = 'main') => {
    previousPage.value = from;
    transitionName.value = 'slide-forward';
    currentPage.value = 'chat';
    // 重置角色为临时会话
    currentCharacter.value = undefined;
    // 重置会话ID，确保临时会话不会加载历史会话数据
    currentConversationId.value = undefined;
    // 更新历史栈
    updateHistory('chat');
    // 等待页面加载完毕后再显示警告通知
    nextTick(() => {
      setTimeout(() => {
        const msg = getNotificationMessage('CONVERSATION_TEMP_WARNING');
        showWarning(msg.title, msg.message);
      }, 2000);
    });
  };

  /**
   * 带角色进入会话
   */
  const navigateToChatWithCharacter = (character: AICharacter) => {
    previousPage.value = 'conversation-list';
    transitionName.value = 'slide-forward';
    currentPage.value = 'chat';
    currentCharacter.value = character;
    currentConversationId.value = undefined; // 重置会话ID，创建新会话
    // 更新历史栈
    updateHistory('chat');
  };

  /**
   * 进入指定会话
   */
  const navigateToConversation = async (conversationId: string) => {
    const conversations = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
    const conversation = conversations.find((c: Conversation) => c.id === conversationId);
    if (conversation) {
      previousPage.value = 'conversation-list';
      transitionName.value = 'slide-forward';
      currentPage.value = 'chat';
      currentConversationId.value = conversationId;

      // 如果会话有关联角色，设置当前角色
      if (conversation.characterId) {
        const characters = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, []);
        currentCharacter.value = characters.find((c: AICharacter) => c.id === conversation.characterId);
      } else {
        currentCharacter.value = undefined;
      }

      // 更新历史栈
      updateHistory('chat');
    }
  };

  /**
   * 导航到 API 预设页面
   */
  const navigateToApiPreset = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'api-preset';
    updateHistory('api-preset');
  };

  /**
   * 导航到设置页面
   */
  const navigateToSettings = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'settings';
    updateHistory('settings');
  };

  /**
   * 导航到会话列表页面
   */
  const navigateToConversationList = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'conversation-list';
    updateHistory('conversation-list');
  };

  /**
   * 导航到正则脚本页面
   */
  const navigateToRegexScript = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'regex-script';
    updateHistory('regex-script');
  };

  /**
   * 导航到角色管理页面
   */
  const navigateToRoleManagement = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'role-management';
    updateHistory('role-management');
  };

  /**
   * 导航到提示词预设页面
   */
  const navigateToPromptPreset = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'prompt-preset';
    updateHistory('prompt-preset');
  };

  /**
   * 导航到知识库页面
   */
  const navigateToKnowledgeBase = () => {
    transitionName.value = 'slide-forward';
    currentPage.value = 'knowledge-base';
    updateHistory('knowledge-base');
  };

  /**
   * 返回上一个页面
   */
  const navigateBack = () => {
    transitionName.value = 'slide-back';

    // 从历史栈中移除当前页面，获取上一个页面
    if (pageHistory.value.length > 1) {
      pageHistory.value.pop();
    }

    // 从历史栈获取上一个页面
    const previousPageName = pageHistory.value.length > 0 ? pageHistory.value[pageHistory.value.length - 1] : 'main';
    currentPage.value = previousPageName as any;

    // 更新浏览器历史状态
    history.replaceState({ page: previousPageName }, '', `#${previousPageName}`);

    // 如果是返回到主页，重置会话状态
    if (previousPageName === 'main') {
      currentCharacter.value = undefined;
      currentConversationId.value = undefined;
    }
  };

  /**
   * 返回主页
   */
  const navigateToMain = () => {
    transitionName.value = 'slide-back';
    currentPage.value = 'main';
    // 清空历史栈并重置为 main
    pageHistory.value = ['main'];
    history.replaceState({ page: 'main' }, '', '#main');
  };

  /**
   * 通用导航方法
   */
  const navigateTo = (page: PageType) => {
    transitionName.value = 'slide-forward';
    currentPage.value = page;
    updateHistory(page);
  };

  /**
   * 更新历史栈并添加浏览器历史记录
   */
  const updateHistory = (page: string) => {
    if (isNavigating.value) return;
    isNavigating.value = true;

    // 添加到历史栈
    pageHistory.value.push(page);
    // 添加浏览器历史记录
    history.pushState({ page }, '', `#${page}`);

    // 重置导航锁
    setTimeout(() => {
      isNavigating.value = false;
    }, 100);
  };

  /**
   * 清理会话状态
   */
  const clearConversationState = () => {
    currentCharacter.value = undefined;
    currentConversationId.value = undefined;
  };

  return {
    // 状态
    currentPage,
    previousPage,
    transitionName,
    pageHistory,
    currentCharacter,
    currentConversationId,

    // 导航方法
    navigateTo,
    navigateBack,
    navigateToMain,
    navigateToChat,
    navigateToChatWithCharacter,
    navigateToConversation,
    navigateToApiPreset,
    navigateToSettings,
    navigateToConversationList,
    navigateToRegexScript,
    navigateToRoleManagement,
    navigateToPromptPreset,
    navigateToKnowledgeBase,
    updateHistory,
    clearConversationState,
  };
}