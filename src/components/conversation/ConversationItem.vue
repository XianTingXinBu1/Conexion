<script setup lang="ts">
import { Bot, Edit2, Trash2 } from 'lucide-vue-next';
import type { Conversation } from '../../types';

interface Props {
  conversation: Conversation;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  click: [conversation: Conversation];
  edit: [conversation: Conversation];
  delete: [conversation: Conversation];
}>();

const handleClick = () => {
  emit('click', props.conversation);
};

const handleEdit = (event: Event) => {
  event.stopPropagation();
  emit('edit', props.conversation);
};

const handleDelete = (event: Event) => {
  event.stopPropagation();
  emit('delete', props.conversation);
};

// 格式化时间
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return '今天';
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
};

// 获取会话预览
const getConversationPreview = (conversation: Conversation) => {
  if (conversation.messages.length === 0) return '暂无消息';
  const lastMessage = conversation.messages[conversation.messages.length - 1]!;
  return lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
};
</script>

<template>
  <div class="conversation-item" @click="handleClick">
    <div class="conversation-icon">
      <Bot :size="20" />
    </div>
    <div class="conversation-info">
      <div class="conversation-name">{{ conversation.title }}</div>
      <div class="conversation-preview">{{ getConversationPreview(conversation) }}</div>
      <div class="conversation-meta">
        <span class="conversation-time">{{ formatTime(conversation.updatedAt) }}</span>
        <span v-if="conversation.characterName" class="conversation-character">{{ conversation.characterName }}</span>
      </div>
    </div>
    <div class="conversation-actions">
      <button class="edit-btn" @click="handleEdit">
        <Edit2 :size="16" />
      </button>
      <button class="delete-btn" @click="handleDelete">
        <Trash2 :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  transition: all 0.2s ease;
  cursor: pointer;
  margin-bottom: 10px;
}

.conversation-item:active {
  transform: scale(0.98);
  background: var(--accent-soft);
}

.conversation-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #9D8DF1, #B7A3E3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conversation-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.conversation-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-preview {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.conversation-time {
  font-size: 11px;
  color: var(--text-muted);
}

.conversation-character {
  font-size: 11px;
  color: var(--accent-purple);
  background: rgba(157, 141, 241, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.conversation-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.edit-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.edit-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
  color: var(--accent-purple);
}

.delete-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.delete-btn:active {
  transform: scale(0.9);
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 深色主题适配 */
[data-theme='dark'] .conversation-icon {
  background: linear-gradient(135deg, #7E67CE, #9D8DF1);
}
</style>