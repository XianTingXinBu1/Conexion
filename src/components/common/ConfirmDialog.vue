<script setup lang="ts">
import { X, Trash2, AlertCircle, Info, CheckCircle } from 'lucide-vue-next';

export interface ConfirmDialogProps {
  show: boolean;
  title?: string;
  message?: string;
  targetName?: string;
  description?: string;
  type?: 'delete' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
}

const props = withDefaults(defineProps<ConfirmDialogProps>(), {
  show: false,
  title: '确认操作',
  message: '确定要执行此操作吗？',
  type: 'warning',
  confirmText: '确认',
  cancelText: '取消',
  confirmDanger: false,
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const getIcon = () => {
  switch (props.type) {
    case 'delete': return Trash2;
    case 'warning': return AlertCircle;
    case 'success': return CheckCircle;
    default: return Info;
  }
};

const getIconColor = () => {
  switch (props.type) {
    case 'delete': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'success': return '#10b981';
    default: return 'var(--accent-purple, #8b5cf6)';
  }
};

const getIconBgColor = () => {
  switch (props.type) {
    case 'delete': return 'rgba(239, 68, 68, 0.12)';
    case 'warning': return 'rgba(245, 158, 11, 0.12)';
    case 'success': return 'rgba(16, 185, 129, 0.12)';
    default: return 'var(--accent-soft, rgba(139, 92, 246, 0.12))';
  }
};

const getConfirmBtnBg = () => {
  if (props.confirmDanger || props.type === 'delete') {
    return '#ef4444';
  }
  return 'var(--accent-purple, #8b5cf6)';
};

const handleConfirm = () => emit('confirm');
const handleCancel = () => emit('cancel');
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" :duration="400">
      <div v-if="show" class="modal-overlay" @click="handleCancel">
        
        <div class="modal-content" @click.stop>
          
          <div class="modal-header">
            <div class="modal-title">{{ title }}</div>
            <button class="modal-close" @click="handleCancel">
              <X :size="20" />
            </button>
          </div>

          <div class="modal-body">
            <div class="dialog-icon" :style="{ color: getIconColor(), background: getIconBgColor() }">
              <component :is="getIcon()" :size="32" stroke-width="2.5" />
            </div>
            
            <div class="text-container">
              <div v-if="message" class="dialog-message">
                {{ message }}
                <span v-if="targetName" class="dialog-target-name"> {{ targetName }}</span>
              </div>
              <div v-if="description" class="dialog-description">{{ description }}</div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button 
              class="btn-confirm" 
              :style="{ background: getConfirmBtnBg() }" 
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* =========================================
   核心优化：动画曲线 (Physics-based)
   ========================================= */

/* 1. 遮罩层 (Overlay) 动画 - 负责背景渐变 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

/* 2. 内容层 (Content) 动画 - 负责缩放和位移 */
/* 入场：带有回弹效果 (贝塞尔曲线: overshooting) */
.modal-enter-active .modal-content {
  transition: 
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
    opacity 0.3s ease;
}

/* 离场：快速收缩 (贝塞尔曲线: standard easing) */
.modal-leave-active .modal-content {
  transition: 
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
    opacity 0.2s ease;
}

/* --- 初始状态 & 结束状态 --- */
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* 入场前：缩小 + 稍微下沉 (增加纵深感) */
.modal-enter-from .modal-content {
  transform: scale(0.92) translateY(15px);
  opacity: 0;
}

/* 离场后：缩小 + 原地消失 */
.modal-leave-to .modal-content {
  transform: scale(0.96);
  opacity: 0;
}


/* =========================================
   布局与样式 (包含默认回退值)
   ========================================= */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.45); /* 稍微调低一点透明度，更通透 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  backdrop-filter: blur(4px); /* 磨砂玻璃效果 */
  -webkit-backdrop-filter: blur(4px);
}

.modal-content {
  width: 100%;
  max-width: 360px; /* 稍微加宽一点点 */
  background: var(--bg-secondary, #ffffff);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 
    0 10px 30px -5px rgba(0, 0, 0, 0.2),
    0 4px 6px -2px rgba(0, 0, 0, 0.05); /* 更柔和的阴影 */
  
  /* 性能优化关键：开启硬件加速 */
  will-change: transform, opacity;
  transform-origin: center center;
}

/* Header */
.modal-header {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 移除底边框，让视觉更干净，或者用极淡的颜色 */
  border-bottom: 1px solid var(--border-color, #f3f4f6); 
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #111827);
  letter-spacing: -0.01em;
}

.modal-close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted, #9ca3af);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-main, #4b5563);
}

/* Body */
.modal-body {
  padding: 28px 24px 24px; /* 增加顶部 padding */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.dialog-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%; /* 圆形图标更现代 */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 4px;
}

.text-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dialog-message {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #111827);
  line-height: 1.5;
}

.dialog-target-name {
  color: #ef4444; /* 强制红色强调目标 */
  font-weight: 700;
  word-break: break-all;
}

.dialog-description {
  font-size: 13px;
  color: var(--text-muted, #6b7280);
  line-height: 1.5;
}

/* Footer */
.modal-footer {
  padding: 16px 24px 20px;
  display: flex;
  gap: 12px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 42px; /* 固定高度 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-cancel {
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e5e7eb);
  color: var(--text-main, #374151);
}

.btn-cancel:hover {
  background: var(--bg-hover, #f9fafb);
  border-color: #d1d5db;
}

.btn-cancel:active {
  transform: scale(0.98);
}

.btn-confirm {
  border: none;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.btn-confirm:hover {
  filter: brightness(1.08); /* 悬停微亮 */
  box-shadow: 0 6px 10px -2px rgba(0, 0, 0, 0.15);
}

.btn-confirm:active {
  transform: scale(0.97);
  filter: brightness(0.95);
}
</style>
