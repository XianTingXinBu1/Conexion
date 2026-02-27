<script setup lang="ts">
import { computed } from 'vue';
import type { AICharacter } from '../../types';
import CharacterCard from './CharacterCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  characters: AICharacter[];
  editingId: string | null;
  editingData?: Partial<AICharacter>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  startEdit: [id: string, type: 'ai'];
  saveEdit: [];
  cancelEdit: [];
  delete: [id: string, type: 'ai'];
}>();

const isEmpty = computed(() => props.characters.length === 0);

const isEditing = (id: string) => props.editingId === id;
</script>

<template>
  <div class="ai-character-list">
    <div class="ai-character-list__title">
      <span>AI角色 ({{ characters.length }})</span>
    </div>

    <EmptyState
      v-if="isEmpty"
      icon="Sparkles"
      title="暂无AI角色"
      hint="点击右上角 + 添加AI角色"
    />

    <div v-else class="ai-character-list__items">
      <CharacterCard
        v-for="character in characters"
        :key="character.id"
        :character="character"
        type="ai"
        :is-selected="false"
        :is-editing="isEditing(character.id)"
        :editing-data="editingData"
        @start-edit="emit('startEdit', $event, 'ai')"
        @save-edit="emit('saveEdit')"
        @cancel-edit="emit('cancelEdit')"
        @delete="emit('delete', $event, 'ai')"
      />
    </div>
  </div>
</template>

<style scoped>
.ai-character-list__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-character-list__items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>