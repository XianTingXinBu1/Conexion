<script setup lang="ts">
import type { MergeMode } from '../../modules/system-prompt';

interface Props {
  enterToSend: boolean;
  showWordCount: boolean;
  enableMarkdown: boolean;
  showMessageIndex: boolean;
  debugMode: boolean;
  chatHistoryLimit: number;
  promptMergeMode: MergeMode;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updateEnterToSend: [value: boolean];
  updateShowWordCount: [value: boolean];
  updateEnableMarkdown: [value: boolean];
  updateShowMessageIndex: [value: boolean];
  updateChatHistoryLimit: [value: number];
  updatePromptMergeMode: [value: MergeMode];
  toggleDebugMode: [];
}>();

const handleEnterToSendToggle = () => {
  emit('updateEnterToSend', !props.enterToSend);
};

const handleShowWordCountToggle = () => {
  emit('updateShowWordCount', !props.showWordCount);
};

const handleEnableMarkdownToggle = () => {
  emit('updateEnableMarkdown', !props.enableMarkdown);
};

const handleShowMessageIndexToggle = () => {
  emit('updateShowMessageIndex', !props.showMessageIndex);
};

const handleChatHistoryLimitChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('updateChatHistoryLimit', parseInt(target.value));
};

const handleDebugModeToggle = () => {
  emit('toggleDebugMode');
};

const handlePromptMergeModeChange = (mode: MergeMode) => {
  emit('updatePromptMergeMode', mode);
};

// 合并模式选项
const mergeModeOptions: { value: MergeMode; label: string; desc: string }[] = [
  {
    value: 'none',
    label: '不合并',
    desc: '保持所有消息独立',
  },
  {
    value: 'adjacent',
    label: '合并相邻',
    desc: '合并相邻同类型消息（推荐）',
  },
  {
    value: 'all',
    label: '全部合并',
    desc: '合并所有到一个消息',
  },
];
</script>

<template>
  <div class="section">
    <div class="section-title">
      <span>聊天设置</span>
    </div>

    <div class="toggle-item">
      <div class="toggle-label">回车发送</div>
      <button class="toggle-btn" :class="{ 'active': enterToSend }" @click="handleEnterToSendToggle">
        <span>{{ enterToSend ? '已启用' : '已禁用' }}</span>
      </button>
    </div>

    <div class="toggle-item">
      <div class="toggle-label">显示词符数</div>
      <button class="toggle-btn" :class="{ 'active': showWordCount }" @click="handleShowWordCountToggle">
        <span>{{ showWordCount ? '已启用' : '已禁用' }}</span>
      </button>
    </div>

    <div class="toggle-item">
      <div class="toggle-label">Markdown 渲染</div>
      <button class="toggle-btn" :class="{ 'active': enableMarkdown }" @click="handleEnableMarkdownToggle">
        <span>{{ enableMarkdown ? '已启用' : '已禁用' }}</span>
      </button>
    </div>

    <div class="toggle-item">
      <div class="toggle-label">显示楼层数</div>
      <button class="toggle-btn" :class="{ 'active': showMessageIndex }" @click="handleShowMessageIndexToggle">
        <span>{{ showMessageIndex ? '已启用' : '已禁用' }}</span>
      </button>
    </div>

    <div class="toggle-item">
      <div class="toggle-label">调试模式</div>
      <button class="toggle-btn" :class="{ 'active': debugMode }" @click="handleDebugModeToggle">
        <span>{{ debugMode ? '已启用' : '已禁用' }}</span>
      </button>
    </div>

    <div class="selector-item">
      <div class="selector-label">提示词合并模式</div>
      <div class="selector-options">
        <button
          v-for="option in mergeModeOptions"
          :key="option.value"
          class="selector-option"
          :class="{ 'active': promptMergeMode === option.value }"
          @click="handlePromptMergeModeChange(option.value)"
        >
          <div class="option-label">{{ option.label }}</div>
          <div class="option-desc">{{ option.desc }}</div>
        </button>
      </div>
    </div>

    <div class="slider-item">
      <div class="slider-header">
        <div class="slider-label">初始加载消息数</div>
        <div class="slider-value">{{ chatHistoryLimit }} 条</div>
      </div>
      <input
        type="range"
        class="slider-input"
        :min="5"
        :max="100"
        :step="5"
        :value="chatHistoryLimit"
        @input="handleChatHistoryLimitChange"
      />
    </div>
  </div>
</template>

<style scoped>
/* 分组 */
.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 开关项 */
.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.toggle-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.toggle-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background: rgba(157, 141, 241, 0.15);
  border-color: var(--accent-purple);
  color: var(--accent-purple);
}

.toggle-btn:active {
  transform: scale(0.95);
}

/* 滑块项 */
.slider-item {
  padding: 12px 0;
}

.slider-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.slider-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.slider-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--accent-purple);
  background: rgba(157, 141, 241, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
}

.slider-input {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: var(--border-color);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-purple);
  cursor: pointer;
  transition: all 0.2s ease;
}

.slider-input::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.slider-input::-webkit-slider-thumb:active {
  transform: scale(0.95);
}

.slider-input::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent-purple);
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
}

.slider-input::-moz-range-thumb:hover {
  transform: scale(1.1);
}

.slider-input::-moz-range-thumb:active {
  transform: scale(0.95);
}

.slider-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
  line-height: 1.4;
}

/* 选择器项 */
.selector-item {
  padding: 12px 0;
}

.selector-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 10px;
}

.selector-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector-option {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.selector-option.active {
  background: rgba(157, 141, 241, 0.15);
  border-color: var(--accent-purple);
}

.selector-option:active {
  transform: scale(0.98);
}

.option-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.option-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.selector-option.active .option-label {
  color: var(--accent-purple);
}
</style>