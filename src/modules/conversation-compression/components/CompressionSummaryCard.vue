<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, FileText } from 'lucide-vue-next';
import { MarkdownRenderer } from '@/modules/markdown';

interface Props {
  summary: string;
  theme: 'light' | 'dark';
}

const props = defineProps<Props>();
const expanded = ref(false);
const normalizedSummary = computed(() => props.summary.trim());

const toggleExpanded = () => {
  expanded.value = !expanded.value;
};
</script>

<template>
  <div v-if="normalizedSummary" :class="['compression-summary-card', theme]">
    <button class="compression-summary-toggle" @click="toggleExpanded">
      <span class="compression-summary-title">
        <FileText :size="16" />
        已压缩的历史上下文
      </span>
      <span class="compression-summary-hint">
        {{ expanded ? '收起' : '展开摘要' }}
        <ChevronDown :size="16" :class="['compression-summary-chevron', { expanded }]" />
      </span>
    </button>

    <Transition name="compression-summary-expand">
      <div v-if="expanded" class="compression-summary-body">
        <MarkdownRenderer :content="normalizedSummary" :streaming="false" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.compression-summary-card {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  background: var(--bg-secondary);
  overflow: hidden;
  margin: 4px 0 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.compression-summary-toggle {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-main);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.compression-summary-title,
.compression-summary-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.compression-summary-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-purple);
}

.compression-summary-hint {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.compression-summary-chevron {
  transition: transform 0.2s ease;
}

.compression-summary-chevron.expanded {
  transform: rotate(180deg);
}

.compression-summary-body {
  border-top: 1px solid var(--border-color);
  padding: 12px 14px;
  color: var(--text-main);
  font-size: 13px;
  line-height: 1.6;
}

.compression-summary-expand-enter-active,
.compression-summary-expand-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.compression-summary-expand-enter-from,
.compression-summary-expand-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
