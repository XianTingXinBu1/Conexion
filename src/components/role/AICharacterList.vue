<script setup lang="ts">
import { computed } from 'vue';
import type { AICharacter } from '@/types';
import CharacterCard from './CharacterCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  characters: AICharacter[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  edit: [id: string];
  delete: [id: string];
  export: [id: string];
}>();

const total = computed(() => props.characters.length);
</script>

<template>
  <div class="ai-character-list">
    <div class="ai-character-list__title">
      <span>AI角色 ({{ total }})</span>
    </div>

    <EmptyState
      v-if="characters.length === 0"
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
        can-export
        @edit="emit('edit', $event)"
        @delete="emit('delete', $event)"
        @export="emit('export', $event)"
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
