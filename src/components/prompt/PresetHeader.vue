<script setup lang="ts">
import { ChevronLeft, Plus, Settings, X } from 'lucide-vue-next';

interface Props {
  currentPresetName: string;
  enabledCount: number;
  totalCount: number;
  showNewForm: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  back: [];
  openMenu: [];
  toggleNewForm: [];
}>();
</script>

<template>
  <header class="page-header">
    <button class="nav-btn" @click="emit('back')">
      <ChevronLeft :size="22" />
    </button>
    <div class="header-content">
      <div class="page-title" @click="emit('openMenu')">
        {{ currentPresetName || '选择预设' }}
        <Settings :size="14" class="preset-icon" />
      </div>
      <div class="page-subtitle">{{ enabledCount }}/{{ totalCount }} 个条目已启用</div>
    </div>
    <button class="nav-btn" @click="emit('toggleNewForm')">
      <X v-if="showNewForm" :size="22" />
      <Plus v-else :size="22" />
    </button>
  </header>
</template>

<style scoped>
/* 页面头部 */
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
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.page-title:active {
  color: var(--accent-purple);
}

.preset-icon {
  color: var(--accent-purple);
  flex-shrink: 0;
}

.page-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
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
</style>