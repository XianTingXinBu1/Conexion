<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Server, Shield, AlertCircle, RefreshCw } from 'lucide-vue-next';
import { validateUrl } from '../../../utils';

interface Props {
  url: string;
  apiKey: string;
}

defineProps<Props>();

const emit = defineEmits<{
  'update:url': [value: string];
  'update:apiKey': [value: string];
}>();

const urlError = ref('');
const BACKEND_STATUS_REFRESH_INTERVAL = 5000;

const backendStatus = ref<'checking' | 'online' | 'offline'>('checking');
const backendMessage = ref('正在检查内建后端代理...');
const backendLatency = ref<number | null>(null);
let backendStatusTimer: ReturnType<typeof window.setInterval> | undefined;

async function checkBackendStatus() {
  backendStatus.value = 'checking';
  backendMessage.value = '正在检查内建后端代理...';
  backendLatency.value = null;

  const startedAt = Date.now();

  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json().catch(() => null) as { ok?: boolean } | null;

    if (!response.ok || data?.ok !== true) {
      throw new Error(`状态码 ${response.status}`);
    }

    backendLatency.value = Date.now() - startedAt;
    backendStatus.value = 'online';
    backendMessage.value = '内建后端代理运行正常';
  } catch (error) {
    backendStatus.value = 'offline';
    backendMessage.value = error instanceof Error
      ? `内建后端代理不可用：${error.message}`
      : '内建后端代理不可用';
  }
}

function handleUrlInput(value: string) {
  emit('update:url', value);
  if (value) {
    const result = validateUrl(value);
    urlError.value = result.valid ? '' : (result.error || '');
  } else {
    urlError.value = '';
  }
}

onMounted(() => {
  void checkBackendStatus();
  backendStatusTimer = window.setInterval(() => {
    void checkBackendStatus();
  }, BACKEND_STATUS_REFRESH_INTERVAL);
});

onBeforeUnmount(() => {
  if (backendStatusTimer !== undefined) {
    window.clearInterval(backendStatusTimer);
  }
});
</script>

<template>
  <div class="section">
    <div class="section-title">
      <Server :size="18" />
      <span>API 配置</span>
    </div>
    <div class="form-group">
      <label class="form-label">URL 端点</label>
      <input
        :value="url"
        type="text"
        class="form-input"
        :class="{ 'input-error': urlError }"
        placeholder="https://api.openai.com/v1"
        @input="handleUrlInput(($event.target as HTMLInputElement).value)"
      />
      <div v-if="urlError" class="form-error">
        <AlertCircle :size="14" />
        <span>{{ urlError }}</span>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">API Key</label>
      <input
        :value="apiKey"
        type="password"
        class="form-input"
        placeholder="sk-..."
        @input="emit('update:apiKey', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>

  <div class="section">
    <div class="section-title">
      <Shield :size="18" />
      <span>后端状态</span>
    </div>
    <div class="proxy-info">
      <div class="status-header">
        <div class="status-title">
          <span class="status-dot" :class="backendStatus" />
          <span>{{ backendStatus === 'online' ? '后端在线' : backendStatus === 'offline' ? '后端离线' : '检查中' }}</span>
        </div>
        <button class="status-refresh" type="button" @click="checkBackendStatus">
          <RefreshCw :size="14" />
          <span>刷新</span>
        </button>
      </div>
      <div class="info-text">
        {{ backendMessage }}<span v-if="backendLatency !== null">（{{ backendLatency }}ms）</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 14px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.proxy-info {
  background: var(--bg-secondary);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid var(--border-color);
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.status-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--text-muted);
}

.status-dot.online {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.45);
}

.status-dot.offline {
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.45);
}

.status-dot.checking {
  background: #f59e0b;
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.45);
}

.status-refresh {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 3px 0;
}

.status-refresh:hover {
  color: var(--accent-purple);
}

.info-text {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.info-text a {
  color: var(--accent-purple);
  text-decoration: none;
  font-weight: 500;
}

.info-text a:hover {
  text-decoration: underline;
}

.form-group {
  margin-bottom: 14px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
  font-weight: 500;
  display: block;
}

.optional {
  font-weight: 400;
  color: var(--text-muted);
  opacity: 0.7;
}

.form-input,
.form-select {
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

.form-input:focus,
.form-select:focus {
  border-color: var(--accent-purple);
}

.form-input.input-error,
.form-select.input-error {
  border-color: #ef4444;
}

.form-input.input-error:focus,
.form-select.input-error:focus {
  border-color: #ef4444;
}

.form-error {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #ef4444;
  margin-top: 6px;
}

.form-error svg {
  flex-shrink: 0;
}

.form-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239D8DF1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 13px center;
  background-size: 16px;
  padding-right: 40px;
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
  opacity: 0.7;
}
</style>