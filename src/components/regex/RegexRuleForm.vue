<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { User, Bot } from '@lucide/vue';
import type { RegexRule, RegexScope, RegexApplyTo } from '@/types';
import { validateRegex } from '@/utils/regexEngine';

interface Props {
  modelValue: Partial<RegexRule>;
  mode?: 'create' | 'edit';
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
});

const emit = defineEmits<{
  'update:modelValue': [value: Partial<RegexRule>];
}>();

// 滚动进度
const formContainerRef = ref<HTMLElement | null>(null);
const scrollProgress = ref(0);

const updateScrollProgress = () => {
  if (formContainerRef.value) {
    const { scrollTop, scrollHeight, clientHeight } = formContainerRef.value;
    const progress = scrollHeight > clientHeight ? scrollTop / (scrollHeight - clientHeight) : 0;
    scrollProgress.value = progress;
  }
};

onMounted(() => {
  if (formContainerRef.value) {
    formContainerRef.value.addEventListener('scroll', updateScrollProgress);
    updateScrollProgress();
  }
  window.addEventListener('resize', updateScrollProgress);
});

onUnmounted(() => {
  if (formContainerRef.value) {
    formContainerRef.value.removeEventListener('scroll', updateScrollProgress);
  }
  window.removeEventListener('resize', updateScrollProgress);
});

const scopeOptions = [
  { value: 'user', label: '用户', icon: User },
  { value: 'assistant', label: 'AI', icon: Bot },
  { value: 'all', label: '全部', icon: null },
] as const;

const applyToOptions = [
  { value: 'before-macro', label: '宏作用前' },
  { value: 'after-macro', label: '宏作用后' },
] as const;

// 写死在脚本里而不是模板里：模板文本会解析 {{...}}，需要避免被当成插值。
const applyToHint = '宏作用于聊天内容（用户输入 / AI 输出）。宏作用前：规则看到的是 {{char}} 原文；宏作用后：看到的是替换后的角色名。代码块与行内代码里的宏不展开。';

const testText = ref('');
const validationError = computed(() => validateRegex(props.modelValue.pattern ?? '', props.modelValue.flags));
const testResult = computed(() => {
  if (validationError.value) return '';
  return testText.value.replace(new RegExp(props.modelValue.pattern ?? '', props.modelValue.flags), props.modelValue.replacement ?? '');
});

const localValue = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const updateField = <K extends keyof RegexRule>(field: K, value: RegexRule[K]) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value });
};
</script>

<template>
  <div class="regex-rule-form-wrapper">
    <div class="regex-rule-form" ref="formContainerRef">
      <div class="form-group">
        <label class="form-label">名称</label>
        <input
          :value="localValue.name"
          type="text"
          class="form-input"
          placeholder="规则名称"
          @input="updateField('name', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="form-group">
        <label class="form-label">正则表达式</label>
        <input
          :value="localValue.pattern"
          type="text"
          class="form-input"
          placeholder="例如：\\n{3,}"
          @input="updateField('pattern', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="form-group">
        <label class="form-label">标志</label>
        <input
          :value="localValue.flags"
          type="text"
          class="form-input"
          placeholder="例如：gi"
          @input="updateField('flags', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="form-group">
        <label class="form-label">替换内容</label>
        <input
          :value="localValue.replacement"
          type="text"
          class="form-input"
          placeholder="例如：\\n\\n"
          @input="updateField('replacement', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <p v-if="validationError && localValue.pattern" role="alert" class="regex-error">{{ validationError }}</p>
      <div class="form-group">
        <label class="form-label">测试文本</label>
        <textarea v-model="testText" class="form-input" rows="3" placeholder="输入文本，预览当前规则的替换结果" />
        <span class="form-label">替换结果</span>
        <pre class="regex-preview">{{ validationError ? '请先修正表达式或标志' : testResult }}</pre>
        <p class="apply-hint">仅测试当前表达式的替换，不执行宏或其他规则。</p>
      </div>
      <div class="form-group">
        <label class="form-label">作用域</label>
        <div class="scope-options">
          <button
            v-for="opt in scopeOptions"
            :key="opt.value"
            :class="['scope-btn', { 'active': localValue.scope === opt.value }]"
            @click="updateField('scope', opt.value as RegexScope)"
          >
            <component v-if="opt.icon" :is="opt.icon" :size="16" />
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">应用时机</label>
        <div class="apply-options">
          <button
            v-for="opt in applyToOptions"
            :key="opt.value"
            :class="['apply-btn', { 'active': localValue.applyTo === opt.value }]"
            @click="updateField('applyTo', opt.value as RegexApplyTo)"
          >
            <span>{{ opt.label }}</span>
          </button>
        </div>
        <p class="apply-hint">{{ applyToHint }}</p>
      </div>
    </div>
    
    <!-- 侧边滚动进度条 -->
    <div class="scroll-progress-track">
      <div 
        class="scroll-progress-bar" 
        :style="{ height: `${scrollProgress * 100}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.regex-error { color: #ef4444; font-size: 12px; }
.regex-preview { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 10px; background: var(--bg-secondary); border-radius: 8px; min-height: 40px; }
.regex-rule-form-wrapper {
  position: relative;
  max-height: 50vh;
  overflow: hidden;
}

.regex-rule-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 50vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 12px;
}

/* Custom scrollbar */
.regex-rule-form::-webkit-scrollbar {
  width: 4px;
}

.regex-rule-form::-webkit-scrollbar-track {
  background: transparent;
}

.regex-rule-form::-webkit-scrollbar-thumb {
  background: var(--accent-soft);
  border-radius: 2px;
}

/* Scroll Progress Bar */
.scroll-progress-track {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3px;
  background: rgba(157, 141, 241, 0.1);
  border-radius: 2px;
  pointer-events: none;
}

.scroll-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: var(--accent-purple);
  border-radius: 2px;
  transition: height 0.1s ease-out;
  pointer-events: none;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 11px 13px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-main);
  font-size: 14px;
  transition: all 0.2s ease;
  outline: none;
}

.form-input::placeholder {
  color: var(--text-muted);
  opacity: 0.5;
}

.form-input:focus {
  border-color: var(--accent-purple);
}

.scope-options,
.apply-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.apply-hint {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.scope-btn,
.apply-btn {
  flex: 1;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scope-btn.active,
.apply-btn.active {
  background: rgba(157, 141, 241, 0.15);
  border-color: var(--accent-purple);
  color: var(--accent-purple);
}

.scope-btn:active,
.apply-btn:active {
  transform: scale(0.96);
}
</style>