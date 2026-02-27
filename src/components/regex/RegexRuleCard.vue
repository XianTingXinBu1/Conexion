<script setup lang="ts">
import { ToggleLeft, ToggleRight, Edit2, Trash2, User, Bot, Hash } from 'lucide-vue-next';
import type { RegexRule, RegexScope, RegexApplyTo } from '../../types';

interface Props {
  rule: RegexRule;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [id: string];
  edit: [rule: RegexRule];
  delete: [id: string];
}>();

const scopeOptions = [
  { value: 'user', label: '用户', icon: User },
  { value: 'assistant', label: 'AI', icon: Bot },
  { value: 'all', label: '全部', icon: Hash },
] as const;

const applyToOptions = [
  { value: 'before-macro', label: '宏作用前' },
  { value: 'after-macro', label: '宏作用后' },
] as const;

const getScopeLabel = (scope: RegexScope) => {
  return scopeOptions.find(o => o.value === scope)?.label || scope;
};

const getApplyToLabel = (applyTo: RegexApplyTo) => {
  return applyToOptions.find(o => o.value === applyTo)?.label || applyTo;
};
</script>

<template>
  <div :class="['rule-card', { 'disabled': !rule.enabled }]">
    <div class="rule-header">
      <div class="rule-info">
        <button
          :class="['toggle-btn', { 'active': rule.enabled }]"
          @click="emit('toggle', rule.id)"
        >
          <ToggleRight v-if="rule.enabled" :size="18" />
          <ToggleLeft v-else :size="18" />
        </button>
        <div class="rule-name">{{ rule.name }}</div>
      </div>
      <div class="rule-actions">
        <button class="action-btn" @click="emit('edit', rule)">
          <Edit2 :size="16" />
        </button>
        <button class="action-btn delete" @click="emit('delete', rule.id)">
          <Trash2 :size="16" />
        </button>
      </div>
    </div>
    <div class="rule-body">
      <div class="rule-detail">
        <span class="detail-label">正则:</span>
        <code class="detail-value">{{ `/${rule.pattern}/${rule.flags}` }}</code>
      </div>
      <div class="rule-detail">
        <span class="detail-label">替换:</span>
        <code class="detail-value">{{ rule.replacement || '(删除)' }}</code>
      </div>
      <div class="rule-tags">
        <span class="tag scope-tag">
          {{ getScopeLabel(rule.scope) }}
        </span>
        <span class="tag apply-tag">
          {{ getApplyToLabel(rule.applyTo) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rule-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: all 0.2s ease;
}

.rule-card.disabled {
  opacity: 0.5;
}

.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-bottom: 1px solid var(--border-color);
}

.rule-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.toggle-btn {
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

.toggle-btn.active {
  color: var(--accent-purple);
}

.toggle-btn:active {
  transform: scale(0.9);
}

.rule-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
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
}

.action-btn:active {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.action-btn.delete:active {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.rule-body {
  padding: 12px 14px;
}

.rule-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rule-detail:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  flex-shrink: 0;
}

.detail-value {
  font-size: 13px;
  color: var(--accent-purple);
  background: var(--bg-primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rule-tags {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.tag {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.scope-tag {
  background: rgba(157, 141, 241, 0.1);
  color: var(--accent-purple);
}

.apply-tag {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}
</style>