<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ArrowLeft, Plus, Clock, MessageSquare } from 'lucide-vue-next';
import type { Theme, AICharacter, Conversation } from '../types';
import { STORAGE_KEYS, DEFAULT_AI_CHARACTERS } from '../constants';
import { CharacterSelector, ConversationItem } from './conversation';
import ConfirmDialog from './ConfirmDialog.vue';
import Modal from './common/Modal.vue';
import EmptyState from './common/EmptyState.vue';
import PageHeader from './common/PageHeader.vue';
import { useNotifications, getNotificationMessage } from '../modules/notification';
import { getStorage, setStorage } from '@/utils/storage';
import '../styles/conversation-list.css';

interface Props {
  theme: Theme;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  back: [];
  toggleTheme: [];
  navigateChat: [];
  navigateChatWithCharacter: [character: AICharacter];
  navigateToConversation: [conversationId: string];
}>();

// 使用通知 composable
const { showSuccess, showInfo, showError } = useNotifications();

// 角色选择弹窗
const showCharacterSelector = ref(false);
const aiCharacters = ref<AICharacter[]>([]);

// 历史会话列表
const conversations = ref<Conversation[]>([]);

// 删除确认对话框
const showDeleteDialog = ref(false);
const conversationToDelete = ref<Conversation | null>(null);

// 重命名对话框
const showRenameDialog = ref(false);
const conversationToRename = ref<Conversation | null>(null);
const newConversationName = ref('');

// 加载AI角色列表
const loadAICharacters = async () => {
  const stored = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, DEFAULT_AI_CHARACTERS);
  aiCharacters.value = stored.length > 0 ? stored : DEFAULT_AI_CHARACTERS;
};

// 加载历史会话
const loadConversations = async () => {
  const stored = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  conversations.value = stored.sort((a: Conversation, b: Conversation) => b.updatedAt - a.updatedAt);
};

// 删除会话
const handleDeleteConversation = (conversation: Conversation) => {
  conversationToDelete.value = conversation;
  showDeleteDialog.value = true;
};

// 确认删除
const confirmDelete = async () => {
  if (!conversationToDelete.value) return;

  const stored = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  const filtered = stored.filter((c: Conversation) => c.id !== conversationToDelete.value!.id);
  await setStorage(STORAGE_KEYS.CONVERSATIONS, filtered);
  await loadConversations();
  // 显示通知
  const msg = getNotificationMessage('CONVERSATION_DELETE_SUCCESS');
  showInfo(msg.title, msg.message);

  showDeleteDialog.value = false;
  conversationToDelete.value = null;
};

// 打开重命名对话框
const openRenameDialog = (conversation: Conversation) => {
  conversationToRename.value = conversation;
  newConversationName.value = conversation.title;
  showRenameDialog.value = true;
};

// 确认重命名
const confirmRename = async () => {
  if (!conversationToRename.value || !newConversationName.value.trim()) return;

  const stored = await getStorage<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  const index = stored.findIndex((c: Conversation) => c.id === conversationToRename.value!.id);
  if (index !== -1 && stored[index]) {
    stored[index]!.title = newConversationName.value.trim();
    stored[index]!.updatedAt = Date.now();
    await setStorage(STORAGE_KEYS.CONVERSATIONS, stored);
    await loadConversations();
    // 显示通知
    const msg = getNotificationMessage('CONVERSATION_RENAME_SUCCESS', { name: newConversationName.value.trim() });
    showSuccess(msg.title, msg.message);
  } else {
    const errorMsg = getNotificationMessage('OPERATION_FAILED', { error: '重命名会话失败' });
    showError(errorMsg.title, errorMsg.message);
  }

  showRenameDialog.value = false;
  conversationToRename.value = null;
  newConversationName.value = '';
};

// 打开会话
const openConversation = (conversation: Conversation) => {
  emit('navigateToConversation', conversation.id);
};

onMounted(async () => {
  await loadAICharacters();
  await loadConversations();
});

// 打开角色选择器
const openCharacterSelector = async () => {
  await loadAICharacters();
  showCharacterSelector.value = true;
};

// 选择临时会话
const handleTempChatClick = () => {
  emit('navigateChat');
};

// 选择角色并进入会话
const selectCharacter = (character: AICharacter) => {
  emit('navigateChatWithCharacter', character);
  showCharacterSelector.value = false;
};
</script>

<template>
  <div class="conversation-list-page">
    <!-- 顶部导航栏 -->
    <PageHeader
      title="会话"
      subtitle="Conversations"
      @back="emit('back')"
    >
      <button class="nav-btn" @click="openCharacterSelector">
        <Plus :size="22" />
      </button>
    </PageHeader>

    <!-- 临时会话按钮 -->
    <div class="temp-chat-banner" @click="handleTempChatClick">
      <div class="temp-chat-icon">
        <Clock :size="24" />
      </div>
      <div class="temp-chat-content">
        <div class="temp-chat-title">临时会话</div>
        <div class="temp-chat-desc">不保存聊天历史 · 快速对话</div>
      </div>
      <div class="temp-chat-arrow">
        <ArrowLeft :size="18" style="transform: rotate(180deg)" />
      </div>
    </div>

    <!-- 滚动内容区域 -->
    <div class="content-scroll">
      <!-- 历史会话 -->
      <div class="section">
        <div class="section-title">
          <span>历史会话</span>
          <span v-if="conversations.length > 0" class="conversation-count">{{ conversations.length }}</span>
        </div>

        <!-- 会话列表 -->
        <div v-if="conversations.length > 0">
          <ConversationItem
            v-for="conversation in conversations"
            :key="conversation.id"
            :conversation="conversation"
            @click="openConversation"
            @edit="openRenameDialog"
            @delete="handleDeleteConversation"
          />
        </div>

        <!-- 空状态 -->
        <EmptyState
          v-else
          :icon="MessageSquare"
          title="暂无角色会话"
          subtitle="点击上方临时会话开始对话"
        />
      </div>
    </div>

    <!-- 角色选择弹窗 -->
    <CharacterSelector
      :show="showCharacterSelector"
      :characters="aiCharacters"
      @update:show="showCharacterSelector = $event"
      @select="selectCharacter"
    />

    <!-- 删除确认对话框 -->
    <ConfirmDialog
      :show="showDeleteDialog"
      type="delete"
      :title="'删除会话'"
      :message="'确定要删除这个会话吗？此操作无法撤销。'"
      @confirm="confirmDelete"
      @cancel="showDeleteDialog = false"
    />

    <!-- 重命名对话框 -->
    <Modal :show="showRenameDialog" title="重命名会话" size="sm" @update:show="showRenameDialog = false">
      <div class="form-group">
        <label class="form-label">会话名称</label>
        <input
          v-model="newConversationName"
          type="text"
          class="form-input"
          placeholder="输入新名称..."
          @keydown.enter="confirmRename"
        />
      </div>
      <template #footer>
        <button class="modal-btn secondary" @click="showRenameDialog = false">取消</button>
        <button class="modal-btn primary" @click="confirmRename">确定</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.conversation-list-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* 导航按钮 */
.nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-main);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.nav-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

/* 内容滚动区域 */
.content-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 16px;
}

/* 表单 */
.form-group {
  margin-bottom: 0;
}

.form-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
  display: block;
}

.form-input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
}

.form-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.form-input:focus {
  border-color: var(--accent-purple);
}
</style>