<script setup lang="ts">
/**
 * 角色卡片（只读展示）
 *
 * 编辑统一走 CharacterEditor（全屏编辑页），这里不再内联表单，
 * 因此卡片只负责「信息展示 + 操作入口」。
 */
import { computed } from 'vue';
import { Check, Edit2, Trash2, Download, User, Bot } from '@lucide/vue';
import type { UserCharacter, AICharacter, CharacterType } from '@/types';

interface Props {
  character: UserCharacter | AICharacter;
  type: CharacterType;
  isSelected?: boolean;
  canDelete?: boolean;
  /** 是否显示单卡导出（AI 角色卡） */
  canExport?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  canDelete: true,
  canExport: false,
});

const emit = defineEmits<{
  select: [id: string];
  edit: [id: string];
  delete: [id: string];
  export: [id: string];
}>();

const aiCharacter = computed(() =>
  props.type === 'ai' ? (props.character as AICharacter) : undefined
);

const cardClasses = computed(() => [
  'character-card',
  {
    'character-card--selected': props.isSelected,
  },
]);

/** 名字首字作为头像，避免引入图片存储 */
const initial = computed(() => props.character.name.trim().charAt(0) || '?');

/** 已填写的正文字段，用于卡片上的紧凑标记 */
const filledFields = computed(() => {
  const character = aiCharacter.value;
  if (!character) return [];

  const fields: Array<{ key: string; label: string }> = [];
  if (character.scenario?.trim()) fields.push({ key: 'scenario', label: '场景' });
  if (character.firstMessage?.trim()) fields.push({ key: 'firstMessage', label: '开场白' });
  if (character.alternateGreetings?.length) fields.push({ key: 'alternateGreetings', label: `备选开场白 ${character.alternateGreetings.length}` });
  if (character.exampleDialogue?.trim()) fields.push({ key: 'exampleDialogue', label: '对话示例' });
  if (character.creatorNotes?.trim()) fields.push({ key: 'creatorNotes', label: '作者注释' });

  return fields;
});

const metaText = computed(() => {
  const character = aiCharacter.value;
  if (!character) return '';

  const parts: string[] = [];
  if (character.characterVersion?.trim()) parts.push(`v${character.characterVersion.trim()}`);
  if (character.creator?.trim()) parts.push(`作者：${character.creator.trim()}`);

  return parts.join(' · ');
});

const tags = computed(() => aiCharacter.value?.tags ?? []);

const selectBtnClasses = computed(() => [
  'select-btn',
  { 'select-btn--active': props.isSelected },
]);
</script>

<template>
  <div :class="cardClasses" data-testid="character-card">
    <div class="character-header">
      <div class="character-info">
        <button
          v-if="type === 'user'"
          :class="selectBtnClasses"
          :title="isSelected ? '当前使用中' : '设为当前用户角色'"
          @click="emit('select', character.id)"
        >
          <Check v-if="isSelected" :size="16" />
        </button>

        <div :class="['character-avatar', `character-avatar--${type}`]">
          <span class="character-avatar__initial">{{ initial }}</span>
          <component
            :is="type === 'user' ? User : Bot"
            class="character-avatar__badge"
            :size="12"
          />
        </div>

        <div class="character-title">
          <div class="character-name">{{ character.name }}</div>
          <div v-if="metaText" class="character-meta">{{ metaText }}</div>
        </div>
      </div>

      <div class="character-actions">
        <button
          v-if="canExport"
          class="action-btn"
          title="导出为角色卡"
          @click="emit('export', character.id)"
        >
          <Download :size="16" />
        </button>
        <button
          class="action-btn"
          title="编辑"
          @click="emit('edit', character.id)"
        >
          <Edit2 :size="16" />
        </button>
        <button
          class="action-btn action-btn--delete"
          title="删除"
          :disabled="!canDelete"
          @click="emit('delete', character.id)"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <div class="character-body">
      <div class="character-detail">
        <span class="detail-label">描述</span>
        <span class="detail-value">{{ character.description || '暂无描述' }}</span>
      </div>

      <div v-if="aiCharacter?.personality" class="character-detail">
        <span class="detail-label">个性</span>
        <span class="detail-value">{{ aiCharacter.personality }}</span>
      </div>

      <div v-if="tags.length > 0" class="character-tags">
        <span v-for="tag in tags" :key="tag" class="tag-chip">{{ tag }}</span>
      </div>

      <div v-if="filledFields.length > 0" class="character-fields">
        <span
          v-for="field in filledFields"
          :key="field.key"
          class="field-chip"
          :data-testid="`field-chip-${field.key}`"
        >
          {{ field.label }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.character-card--selected {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 2px rgba(157, 141, 241, 0.1);
}

.character-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

.character-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.select-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1.5px solid var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.select-btn--active {
  background: var(--accent-purple);
  border-color: var(--accent-purple);
  color: white;
}

.select-btn:active {
  transform: scale(0.9);
}

.character-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  user-select: none;
}

.character-avatar--user {
  background: var(--accent-soft);
  color: var(--accent-purple);
}

.character-avatar--ai {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.character-avatar__initial {
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.character-avatar__badge {
  position: absolute;
  right: -3px;
  bottom: -3px;
  background: var(--bg-secondary);
  border-radius: 50%;
  padding: 1px;
}

.character-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.character-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-meta {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.character-actions {
  display: flex;
  gap: 4px;
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

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn:active:not(:disabled) {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.action-btn--delete:active:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.character-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.detail-value {
  font-size: 13px;
  color: var(--text-main);
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  word-break: break-word;
}

.character-tags,
.character-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.field-chip {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: rgba(157, 141, 241, 0.12);
  color: var(--accent-purple);
  font-weight: 500;
}
</style>
