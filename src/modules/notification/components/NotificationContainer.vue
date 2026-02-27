<script setup lang="ts">
import { computed } from 'vue';
import { useNotifications } from '../useNotifications';
import NotificationToast from './NotificationToast.vue';

// 使用通知管理
const { notifications, removeNotification } = useNotifications();

// 计算属性：当前显示的通知列表（倒序，最新的在顶部）
const visibleNotifications = computed(() => {
  return [...notifications.value].reverse();
});

// 处理关闭事件
const handleClose = (id: string) => {
  removeNotification(id);
};
</script>

<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification">
        <NotificationToast
          v-for="notification in visibleNotifications"
          :key="notification.id"
          :notification="notification"
          @close="handleClose"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../styles/notification.css';
</style>