<script setup lang="ts">
interface Props {
  icon?: any;
  title: string;
  subtitle?: string;
}

const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
});
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-icon">
      <component :is="icon" :size="48" />
    </div>
    <div class="empty-text">{{ title }}</div>
    <div v-if="subtitle" class="empty-hint">{{ subtitle }}</div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--accent-soft);
  color: var(--accent-purple);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}
</style>