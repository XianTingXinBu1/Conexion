<script setup lang="ts">
import { computed } from 'vue';
import type { UserCharacter } from '@/types';
import CharacterCard from './CharacterCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  characters: UserCharacter[];
  selectedUserId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [id: string];
  edit: [id: string];
  delete: [id: string];
}>();

const canDelete = computed(() => props.characters.length > 1);
</script>

<template>
  <div class="user-character-list">
    <div class="user-character-list__title">
      <span>用户角色 ({{ characters.length }})</span>
    </div>

    <EmptyState
      v-if="characters.length === 0"
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
        :is-selected="character.id === selectedUserId"
        :can-delete="canDelete"
        @select="emit('select', $event)"
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
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
