<script setup lang="ts">
import { computed } from 'vue';
import type { KnowledgeBase } from '../../types';

interface Props {
  knowledgeBase: KnowledgeBase;
  isSelected: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [id: string];
}>();

const cardClasses = computed(() => [
  'kb-card',
  { 'kb-card--selected': props.isSelected },
]);

const enabledCount = computed(() =>
  props.knowledgeBase.entries.filter(e => e.enabled).length
);

const totalCount = computed(() => props.knowledgeBase.entries.length);
</script>

<template>
  <div :class="cardClasses" @click="emit('select', knowledgeBase.id)">
    <div class="kb-card__header">
      <h3 class="kb-card__title">{{ knowledgeBase.name }}</h3>
      <div class="kb-card__status">
        <span class="status-dot"></span>
        <span class="status-text">{{ enabledCount }}/{{ totalCount }}</span>
      </div>
    </div>
    <p class="kb-card__description">{{ knowledgeBase.description || '暂无描述' }}</p>
    <div class="kb-card__meta">
      <span class="meta-text">{{ new Date(knowledgeBase.updatedAt).toLocaleDateString() }}</span>
    </div>
  </div>
</template>

<style scoped>
.kb-card {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 16px;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.kb-card:active {
  transform: scale(0.98);
}

.kb-card:active:active {
  animation: pulse 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes pulse {
  0%, 100% {
    transform: scale(0.98);
  }
  50% {
    transform: scale(0.96);
  }
}

.kb-card--selected {
  border-color: var(--accent-purple);
  background: var(--accent-soft);
}

.kb-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.kb-card__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-main);
  margin: 0;
}

.kb-card__status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-purple);
}

.status-text {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.kb-card__description {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kb-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-text {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.7;
}
</style>