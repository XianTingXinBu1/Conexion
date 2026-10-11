<script setup lang="ts">
/**
 * 角色编辑器（全屏）
 *
 * 新建与编辑共用同一个组件，替换掉原先「列表里内联展开表单 + 单独的 CharacterForm」
 * 两套字段定义。字段分三组：基础 / 角色卡正文 / 附加信息。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { Check, X } from '@lucide/vue';
import type { UserCharacter, AICharacter, CharacterType, KnowledgeBase } from '@/types';
import { loadKnowledgeBases as loadKnowledgeBasesFromRepository } from '@/repositories/knowledgeBaseRepository';
import { useBackGuard } from '@/composables/useBackGuard';
import FormInput from '../form/FormInput.vue';
import FormTextarea from '../form/FormTextarea.vue';
import FormActions from '../form/FormActions.vue';

interface Props {
  show: boolean;
  type: CharacterType;
  /** 传入则为编辑，null / undefined 为新建 */
  character?: UserCharacter | AICharacter | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  submit: [character: UserCharacter | AICharacter];
  cancel: [];
}>();

interface Draft {
  name: string;
  description: string;
  personality: string;
  knowledgeBaseId: string;
  scenario: string;
  firstMessage: string;
  alternateGreetingsText: string;
  exampleDialogue: string;
  creator: string;
  characterVersion: string;
  creatorNotes: string;
  tagsText: string;
}

const createEmptyDraft = (): Draft => ({
  name: '',
  description: '',
  personality: '',
  knowledgeBaseId: '',
  scenario: '',
  firstMessage: '',
  alternateGreetingsText: '',
  exampleDialogue: '',
  creator: '',
  characterVersion: '',
  creatorNotes: '',
  tagsText: '',
});

const draft = ref<Draft>(createEmptyDraft());
const knowledgeBases = ref<KnowledgeBase[]>([]);

// 安卓系统返回键先关编辑器，而不是直接离开角色管理页
useBackGuard({
  isOpen: () => props.show,
  onBack: () => emit('cancel'),
});

const isEditing = computed(() => Boolean(props.character));
const isAI = computed(() => props.type === 'ai');

const title = computed(() => {
  const action = isEditing.value ? '编辑' : '新建';
  return `${action}${isAI.value ? 'AI 角色' : '用户角色'}`;
});

const namePlaceholder = computed(() => (isAI.value ? '例如：智能助手' : '例如：小明'));
const descriptionPlaceholder = computed(() =>
  isAI.value ? '一句话说明这个角色是谁' : '描述用户的基本信息'
);

/** 空串统一转 undefined，避免把空字段写进数据文件 */
function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** 逗号 / 顿号 / 换行分隔的标签 */
function parseTags(text: string): string[] | undefined {
  const tags = text
    .split(/[,，、\n]/)
    .map(tag => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}

/** 每行一条备选开场白 */
function parseLines(text: string): string[] | undefined {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : undefined;
}

const resetDraft = () => {
  const character = props.character;
  if (!character) {
    draft.value = createEmptyDraft();
    return;
  }

  const aiCharacter = props.type === 'ai' ? (character as AICharacter) : undefined;

  draft.value = {
    name: character.name,
    description: character.description,
    personality: aiCharacter?.personality ?? '',
    knowledgeBaseId: aiCharacter?.knowledgeBaseId ?? '',
    scenario: aiCharacter?.scenario ?? '',
    firstMessage: aiCharacter?.firstMessage ?? '',
    alternateGreetingsText: (aiCharacter?.alternateGreetings ?? []).join('\n'),
    exampleDialogue: aiCharacter?.exampleDialogue ?? '',
    creator: aiCharacter?.creator ?? '',
    characterVersion: aiCharacter?.characterVersion ?? '',
    creatorNotes: aiCharacter?.creatorNotes ?? '',
    tagsText: (aiCharacter?.tags ?? []).join(', '),
  };
};

watch(() => [props.show, props.character], resetDraft, { immediate: true });

onMounted(async () => {
  knowledgeBases.value = await loadKnowledgeBasesFromRepository();
});

const canSubmit = computed(() => draft.value.name.trim().length > 0);

const buildCharacter = (): UserCharacter | AICharacter => {
  const existing = props.character;
  const isNew = !existing;

  const base = {
    id: isNew ? Date.now().toString() : existing.id,
    name: draft.value.name.trim(),
    description: draft.value.description,
    createdAt: isNew ? Date.now() : existing.createdAt,
  };

  if (!isAI.value) {
    return base as UserCharacter;
  }

  return {
    ...base,
    personality: draft.value.personality,
    knowledgeBaseId: optional(draft.value.knowledgeBaseId),
    scenario: optional(draft.value.scenario),
    firstMessage: optional(draft.value.firstMessage),
    alternateGreetings: parseLines(draft.value.alternateGreetingsText),
    exampleDialogue: optional(draft.value.exampleDialogue),
    creator: optional(draft.value.creator),
    characterVersion: optional(draft.value.characterVersion),
    creatorNotes: optional(draft.value.creatorNotes),
    tags: parseTags(draft.value.tagsText),
  } as AICharacter;
};

const handleSubmit = () => {
  if (!canSubmit.value) return;
  emit('submit', buildCharacter());
};
</script>

<template>
  <div v-if="show" class="character-editor" data-testid="character-editor">
    <header class="editor-header">
      <button class="editor-nav-btn" title="取消" @click="emit('cancel')">
        <X :size="22" />
      </button>
      <div class="editor-header__content">
        <div class="editor-title">{{ title }}</div>
        <div class="editor-subtitle">{{ isEditing ? 'Character' : 'New Character' }}</div>
      </div>
      <button
        class="editor-nav-btn editor-nav-btn--primary"
        title="保存"
        :disabled="!canSubmit"
        data-testid="editor-save"
        @click="handleSubmit"
      >
        <Check :size="22" />
      </button>
    </header>

    <div class="editor-scroll">
      <!-- 基础信息 -->
      <section class="editor-section">
        <h3 class="section-title">基础信息</h3>
        <div class="editor-field">
          <label class="editor-label">角色名称 <span class="required">*</span></label>
          <FormInput
            v-model="draft.name"
            :placeholder="namePlaceholder"
            data-testid="editor-name"
          />
        </div>
        <div class="editor-field">
          <label class="editor-label">角色描述</label>
          <FormTextarea
            v-model="draft.description"
            :placeholder="descriptionPlaceholder"
            :rows="3"
          />
        </div>
        <div v-if="isAI" class="editor-field">
          <label class="editor-label">个性描述</label>
          <FormTextarea
            v-model="draft.personality"
            placeholder="性格特点、说话风格"
            :rows="3"
          />
        </div>
        <div v-if="isAI && knowledgeBases.length > 0" class="editor-field">
          <label class="editor-label">绑定知识库</label>
          <select v-model="draft.knowledgeBaseId" class="editor-select">
            <option value="">不绑定知识库</option>
            <option v-for="kb in knowledgeBases" :key="kb.id" :value="kb.id">
              {{ kb.name }}{{ kb.globallyEnabled ? '（全局启用）' : '' }}
            </option>
          </select>
        </div>
      </section>

      <!-- 角色卡正文 -->
      <template v-if="isAI">
        <section class="editor-section">
          <h3 class="section-title">角色卡正文</h3>
          <p class="section-hint">
            这些内容不会自动进入提示词；在提示词预设里添加同名条目（如「场景」）即可注入。
          </p>
          <div class="editor-field">
            <label class="editor-label">场景</label>
            <FormTextarea
              v-model="draft.scenario"
              placeholder="故事发生的场景、当前情境"
              :rows="3"
            />
          </div>
          <div class="editor-field">
            <label class="editor-label">开场白</label>
            <FormTextarea
              v-model="draft.firstMessage"
              placeholder="进入该角色会话时作为首条消息出现"
              :rows="4"
            />
          </div>
          <div class="editor-field">
            <label class="editor-label">备选开场白</label>
            <FormTextarea
              v-model="draft.alternateGreetingsText"
              placeholder="每行一条，可用于不同开局"
              :rows="4"
            />
            <p class="field-hint">已存储并可导入导出；切换开场白的入口尚未实现。</p>
          </div>
          <div class="editor-field">
            <label class="editor-label">对话示例</label>
            <FormTextarea
              v-model="draft.exampleDialogue"
              placeholder="示例对话，用于示范语气与节奏"
              :rows="5"
            />
          </div>
        </section>

        <!-- 附加信息 -->
        <section class="editor-section">
          <h3 class="section-title">附加信息</h3>
          <p class="section-hint">用于记录出处与版本，不进入提示词；导出角色卡时会一并带上。</p>
          <div class="editor-field-row">
            <div class="editor-field">
              <label class="editor-label">作者</label>
              <FormInput v-model="draft.creator" placeholder="角色卡作者" />
            </div>
            <div class="editor-field">
              <label class="editor-label">版本</label>
              <FormInput v-model="draft.characterVersion" placeholder="例如 1.0" />
            </div>
          </div>
          <div class="editor-field">
            <label class="editor-label">标签</label>
            <FormInput v-model="draft.tagsText" placeholder="用逗号分隔，例如：科幻, 助手" />
          </div>
          <div class="editor-field">
            <label class="editor-label">创作者注释</label>
            <FormTextarea
              v-model="draft.creatorNotes"
              placeholder="给使用者看的说明"
              :rows="3"
            />
          </div>
        </section>
      </template>

      <div class="editor-footer-space" />
    </div>

    <footer class="editor-footer">
      <FormActions
        :buttons="[
          { type: 'secondary', label: '取消', icon: X },
          { type: 'primary', label: isEditing ? '保存' : '添加', icon: Check, disabled: !canSubmit },
        ]"
        :equal-width="true"
        @click="(_, index) => index === 1 ? handleSubmit() : emit('cancel')"
      />
    </footer>
  </div>
</template>

<style scoped>
.character-editor {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.editor-nav-btn {
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
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.editor-nav-btn:active:not(:disabled) {
  transform: scale(0.9);
  background: var(--accent-soft);
}

.editor-nav-btn--primary {
  color: var(--accent-purple);
}

.editor-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.editor-header__content {
  flex: 1;
  min-width: 0;
}

.editor-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-main);
}

.editor-subtitle {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.editor-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  -webkit-overflow-scrolling: touch;
}

.editor-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 14px;
}

.section-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.section-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}

.editor-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.editor-field:last-child {
  margin-bottom: 0;
}

.editor-field-row {
  display: flex;
  gap: 10px;
}

.editor-field-row > .editor-field {
  flex: 1;
  min-width: 0;
}

.editor-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.required {
  color: #ef4444;
}

.field-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

.editor-select {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-main);
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.editor-select:focus {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px rgba(157, 141, 241, 0.1);
}

.editor-footer-space {
  height: 8px;
}

.editor-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}
</style>
