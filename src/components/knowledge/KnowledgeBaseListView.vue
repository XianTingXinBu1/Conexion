<script setup lang="ts">
import { ChevronLeft, Plus, Database } from 'lucide-vue-next';
import type { KnowledgeBase } from '../../types';
import KnowledgeBaseCard from './KnowledgeBaseCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  knowledgeBases: KnowledgeBase[];
  selectedKnowledgeBaseId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  back: [];
  select: [id: string];
  add: [];
  toggleGlobalEnabled: [id: string];
}>();
</script>

<template>
  <div class="kb-list-view">
    <header class="page-header">
      <button class="nav-btn" @click="emit('back')">
        <ChevronLeft :size="22" />
      </button>
      <div class="header-content">
        <div class="page-title">知识库</div>
        <div class="page-subtitle">{{ knowledgeBases.length }} 个知识库</div>
      </div>
      <button class="nav-btn" @click="emit('add')">
        <Plus :size="22" />
      </button>
    </header>

    <div class="page-content">
      <div v-if="knowledgeBases.length > 0" class="kb-list">
        <div
          v-for="kb in knowledgeBases"
          :key="kb.id"
          :class="['kb-card-wrapper', { 'kb-card-wrapper--selected': selectedKnowledgeBaseId === kb.id }]"
        >
          <KnowledgeBaseCard
            :knowledge-base="kb"
            :is-selected="selectedKnowledgeBaseId === kb.id"
            @select="emit('select', kb.id)"
          />
          <button
            :class="['global-toggle-btn', { 'global-toggle-btn--active': kb.globallyEnabled }]"
            @click.stop="emit('toggleGlobalEnabled', kb.id)"
          >
            <div class="global-toggle-btn__icon"></div>
            <span class="global-toggle-btn__label">
              {{ kb.globallyEnabled ? '全局启用' : '全局禁用' }}
            </span>
          </button>
        </div>
      </div>
      <EmptyState
        v-else
        :icon="Database"
        title="暂无知识库"
        subtitle="点击右上角 + 创建新知识库"
      />
    </div>
  </div>
</template>

<style scoped>
.kb-list-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.page-header {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.header-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.3px;
}

.page-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

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

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.kb-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kb-card-wrapper {
  position: relative;
}

.kb-card-wrapper--selected :deep(.kb-card) {
  border-color: var(--accent-purple);
  background: var(--accent-soft);
}

.global-toggle-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  z-index: 2;
}

.global-toggle-btn:active {
  transform: scale(0.95);
}

.global-toggle-btn--active {
  border-color: var(--accent-purple);
  background: var(--accent-soft);
  color: var(--accent-purple);
}

.global-toggle-btn__icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: background 0.2s ease;
}

.global-toggle-btn--active .global-toggle-btn__icon {
  background: var(--accent-purple);
}

.global-toggle-btn__label {
  white-space: nowrap;
}
</style>