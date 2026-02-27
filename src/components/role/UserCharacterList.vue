<script setup lang="ts">
import { computed } from 'vue';
import type { UserCharacter } from '../../types';
import CharacterCard from './CharacterCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  characters: UserCharacter[];
  selectedUserId: string | null;
  editingId: string | null;
  editingData?: Partial<UserCharacter>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [id: string];
  startEdit: [id: string, type: 'user'];
  saveEdit: [];
  cancelEdit: [];
  delete: [id: string, type: 'user'];
}>();

const isEmpty = computed(() => props.characters.length === 0);

const isEditing = (id: string) => props.editingId === id;

const isSelected = (id: string) => props.selectedUserId === id;

const canDelete = () => props.characters.length > 1;
</script>

<template>
  <div class="user-character-list">
    <div class="user-character-list__title">
      <span>用户角色 ({{ characters.length }})</span>
    </div>

    <EmptyState
      v-if="isEmpty"
      icon="UserCircle"
      title="暂无用户角色"
      hint="点击右上角 + 添加用户角色"
    />

    <div v-else class="user-character-list__items">
      <CharacterCard
        v-for="character in characters"
        :key="character.id"
        :character="character"
        type="user"
        :is-selected="isSelected(character.id)"
        :is-editing="isEditing(character.id)"
        :editing-data="editingData"
        :can-delete="canDelete()"
        @select="emit('select', $event)"
        @start-edit="emit('startEdit', $event, 'user')"
        @save-edit="emit('saveEdit')"
        @cancel-edit="emit('cancelEdit')"
        @delete="emit('delete', $event, 'user')"
      />
    </div>
  </div>
</template>

<style scoped>
.user-character-list__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-character-list__items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>