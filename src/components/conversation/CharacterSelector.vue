<script setup lang="ts">
import { Bot, ArrowLeft } from 'lucide-vue-next';
import type { AICharacter } from '../../types';
import Modal from '../common/Modal.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  show: boolean;
  characters: AICharacter[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:show': [value: boolean];
  select: [character: AICharacter];
}>();

const handleClose = () => {
  emit('update:show', false);
};

const handleSelect = (character: AICharacter) => {
  emit('select', character);
  emit('update:show', false);
};
</script>

<template>
  <Modal :show="show" title="选择AI角色" size="md" @update:show="handleClose">
    <div class="character-selector">
      <!-- 角色列表 -->
      <div
        v-for="char in characters"
        :key="char.id"
        class="character-option"
        @click="handleSelect(char)"
      >
        <div class="character-option-icon">
          <Bot :size="24" />
        </div>
        <div class="character-option-info">
          <div class="character-option-name">{{ char.name }}</div>
          <div class="character-option-desc">{{ char.description || '暂无描述' }}</div>
        </div>
        <div class="character-option-arrow">
          <ArrowLeft :size="18" style="transform: rotate(180deg)" />
        </div>
      </div>

      <!-- 空状态 -->
      <EmptyState
        v-if="characters.length === 0"
        :icon="Bot"
        title="暂无AI角色"
        subtitle="请先在角色管理中添加AI角色"
      />
    </div>
  </Modal>
</template>

<style scoped>
.character-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 50vh;
  overflow-y: auto;
}

.character-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-primary);
  border-radius: 16px;
  border: 1.5px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.character-option:last-child {
  margin-bottom: 0;
}

.character-option:active {
  transform: scale(0.98);
  background: var(--accent-soft);
}

.character-option-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #10B981, #34D399);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.character-option-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.character-option-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}

.character-option-desc {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-option-arrow {
  width: 24px;
  height: 24px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 深色主题适配 */
[data-theme='dark'] .character-option-icon {
  background: linear-gradient(135deg, #059669, #10B981);
}

[data-theme='dark'] .character-option:active {
  background: rgba(157, 141, 241, 0.15);
}
</style>