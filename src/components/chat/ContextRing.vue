<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  current: number;
  max: number;
  theme: 'light' | 'dark';
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  clickable: false,
});

const emit = defineEmits<{
  click: [];
}>();

const percentage = computed(() => {
  if (props.max <= 0) return 0;
  return Math.min(Math.round((props.current / props.max) * 100), 100);
});

const strokeColor = computed(() => {
  const pct = percentage.value;
  if (pct >= 80) return '#EF4444'; // 红色
  if (pct >= 50) return '#EAB308'; // 黄色
  return '#9D8DF1'; // 紫色
});

const circumference = computed(() => 2 * Math.PI * 18); // r=18
const strokeDashoffset = computed(() => {
  return circumference.value - (percentage.value / 100) * circumference.value;
});

// 弹动动画状态
const isPulsing = ref(false);
const prevPercentage = ref(percentage.value);

// 监听百分比变化，触发弹动动画
watch(percentage, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    isPulsing.value = true;
    // 动画持续 300ms 后移除
    setTimeout(() => {
      isPulsing.value = false;
    }, 300);
    prevPercentage.value = newVal;
  }
});
</script>

<template>
  <div class="context-ring" :class="[theme, { clickable: clickable, pulsing: isPulsing }]" @click="clickable ? emit('click') : null">
    <svg width="44" height="44" viewBox="0 0 44 44">
      <!-- 背景圆环 -->
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        :stroke="theme === 'dark' ? '#2C2C38' : '#E8E8F0'"
        stroke-width="4"
      />
      <!-- 进度圆环 -->
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        :stroke="strokeColor"
        stroke-width="4"
        stroke-linecap="round"
        transform="rotate(-90 22 22)"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="strokeDashoffset"
        class="progress-ring"
      />
    </svg>
    <div class="percentage-text">
      {{ percentage }}%
    </div>
  </div>
</template>

<style scoped>
.context-ring {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.progress-ring {
  transition: stroke 0.4s cubic-bezier(0.16, 1, 0.3, 1), stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 弹动动画 */
.context-ring.pulsing {
  animation: pulse-ring 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
}

.percentage-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-main);
  transition: color 0.3s ease;
}

.context-ring.dark .percentage-text {
  color: #FFFFFF;
}

.context-ring.light .percentage-text {
  color: #12121A;
}

.context-ring.clickable {
  cursor: pointer;
}

.context-ring.clickable:not(.pulsing) {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.context-ring.clickable:hover {
  transform: scale(1.08);
}

.context-ring.clickable:active {
  transform: scale(0.95);
}

.context-ring.clickable:hover .percentage-text {
  transform: translate(-50%, -50%) scale(1.1);
}
</style>