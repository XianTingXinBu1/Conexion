<script setup lang="ts">
import { ref, watch } from 'vue';
import { GripVertical } from 'lucide-vue-next';
import type { Theme, PromptItem } from '../../types';
import { useDraggable } from '../../composables/useDraggable';
import PromptItemCard from './PromptItemCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  items: PromptItem[];
  theme: Theme;
  isDragging?: boolean;
  editingId: string | null;
  editingItem: Partial<PromptItem>;
}

const props = withDefaults(defineProps<Props>(), {
  isDragging: false,
});

const emit = defineEmits<{
  toggle: [id: string];
  edit: [item: PromptItem];
  saveEdit: [];
  cancelEdit: [];
  delete: [id: string];
  reorder: [newOrder: PromptItem[]];
  dragStart: [index: number];
  dragEnd: [];
  touchStart: [index: number, event: TouchEvent];
  touchMove: [event: TouchEvent];
  touchEnd: [];
}>();

// 内部 items ref，用于拖拽操作
const itemsRef = ref<PromptItem[]>([]);

// 同步 props.items 到内部 ref
watch(
  () => props.items,
  (newItems) => {
    itemsRef.value = [...newItems];
  },
  { immediate: true, deep: true }
);

// 使用拖拽 composable
const {
  draggedIndex,
  insertBeforeIndex,
  getItemStyle,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useDraggable(itemsRef, {
  itemHeight: 74,
  onDragEnd: () => {
    emit('reorder', itemsRef.value);
  },
});

// 转发拖拽相关的事件
const onDragStart = (index: number) => {
  emit('dragStart', index);
  handleDragStart(index);
};

const onDragEnd = () => {
  emit('dragEnd');
  handleDragEnd();
};

const onTouchStart = (index: number, event: TouchEvent) => {
  emit('touchStart', index, event);
  handleTouchStart(index, event);
};

const onTouchMove = (event: TouchEvent) => {
  emit('touchMove', event);
  handleTouchMove(event);
};

const onTouchEnd = () => {
  emit('touchEnd');
  handleTouchEnd();
};
</script>

<template>
  <div :class="['prompt-list', { 'dragging-active': isDragging }]">
    <template v-if="items.length > 0">
      <div
        v-for="(item, index) in items"
        :key="item.id"
        :style="getItemStyle(index)"
        @dragover="handleDragOver"
        @drop="handleDrop(index)"
      >
        <PromptItemCard
          :index="index"
          :item="item"
          :is-editing="editingId === item.id"
          :is-dragging="draggedIndex === index"
          :insert-before="insertBeforeIndex === index"
          :editing-data="editingItem"
          @toggle="emit('toggle', $event)"
          @start-edit="emit('edit', $event)"
          @save-edit="emit('saveEdit')"
          @cancel-edit="emit('cancelEdit')"
          @delete="emit('delete', $event)"
          @drag-start="(idx: number) => onDragStart(idx)"
          @drag-end="onDragEnd"
          @touch-start="(idx: number, evt: TouchEvent) => onTouchStart(idx, evt)"
          @touch-move="(evt: TouchEvent) => onTouchMove(evt)"
          @touch-end="onTouchEnd"
        />
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState
      v-else
      :icon="GripVertical"
      title="暂无条目"
      subtitle="点击右上角 + 添加新条目"
    />
  </div>
</template>

<style scoped>
/* 条目列表 */
.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  user-select: none;
}

.prompt-list.dragging-active {
  touch-action: none;
}
</style>