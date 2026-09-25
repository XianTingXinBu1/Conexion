<script setup lang="ts">
import { ref, watch } from 'vue';
import { GripVertical } from '@lucide/vue';
import type { PromptItem } from '@/types';
import { useDraggable } from '../../composables/useDraggable';
import PromptItemCard from './PromptItemCard.vue';
import EmptyState from '../common/EmptyState.vue';

interface Props {
  items: PromptItem[];
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
  dragStart: [index: number, event: DragEvent];
  dragEnd: [];
  touchStart: [index: number, event: TouchEvent];
  touchMove: [event: TouchEvent];
  touchEnd: [];
  touchCancel: [];
}>();

// 内部 items ref，用于拖拽操作
const itemsRef = ref<PromptItem[]>([]);

const listRef = ref<HTMLElement | null>(null);

/**
 * 按真实布局测量每项节距（本项顶 → 下一项顶，含列表 gap）。
 * 卡片高度随描述长短变化，写死高度会让拖拽落点跳格。
 * 最后一项没有“下一项”，单独加上列表 gap，否则末尾的让位 / 落点会少一个间距。
 */
const measureItemHeights = (): number[] => {
  const listEl = listRef.value;
  const cards = listEl?.querySelectorAll<HTMLElement>('.prompt-item');
  if (!listEl || !cards || cards.length === 0) return [];

  const rects = [...cards].map((card) => card.getBoundingClientRect());
  const rowGap = Number.parseFloat(getComputedStyle(listEl).rowGap) || 0;

  return rects.map((rect, index) => {
    const next = rects[index + 1];
    return next ? next.top - rect.top : rect.height + rowGap;
  });
};

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
  isDragging: isDraggingState,
  insertBeforeIndex,
  getItemStyle,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleTouchCancel,
} = useDraggable(itemsRef, {
  itemHeight: 74,
  measureItemHeights,
  onDragEnd: () => {
    emit('reorder', itemsRef.value);
  },
});

// 转发拖拽相关的事件
const onDragStart = (index: number, event: DragEvent) => {
  emit('dragStart', index, event);
  handleDragStart(index, event);
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

const onTouchCancel = () => {
  emit('touchCancel');
  handleTouchCancel();
};
</script>

<template>
  <div ref="listRef" :class="['prompt-list', { 'dragging-active': isDragging || isDraggingState }]">
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
          @drag-start="(idx: number, evt: DragEvent) => onDragStart(idx, evt)"
          @drag-end="onDragEnd"
          @touch-start="(idx: number, evt: TouchEvent) => onTouchStart(idx, evt)"
          @touch-move="(evt: TouchEvent) => onTouchMove(evt)"
          @touch-end="onTouchEnd"
          @touch-cancel="onTouchCancel"
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