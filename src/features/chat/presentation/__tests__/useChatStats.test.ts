import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import type { ChatMessage, Preset } from '@/types';
import { useChatStats } from '../useChatStats';

const preset = (contextLength: number) => ({ contextLength }) as Preset;

describe('useChatStats 上下文阈值', () => {
  it('历史先加载时，不使用临时上限误报；选中预设加载完成后按实际上限计算', () => {
    const request = ref<ChatMessage[]>([{ role: 'user', content: 'hello '.repeat(4000) }]);
    const currentPreset = ref<Preset | undefined>(preset(2048));
    const ready = ref(false);
    const stats = useChatStats(ref([]), request, currentPreset, ref(75), ready);

    expect(stats.currentContextCount.value).toBeGreaterThan(2048);
    expect(stats.usagePercent.value).toBe(0);
    expect(stats.isCompressionThresholdReached.value).toBe(false);

    currentPreset.value = preset(200000);
    ready.value = true;
    expect(stats.usagePercent.value).toBeLessThan(75);
    expect(stats.isCompressionThresholdReached.value).toBe(false);
  });

  it('加载完成后达到真实预设阈值仍提醒，减少上下文后恢复正常', () => {
    const request = ref<ChatMessage[]>([{ role: 'user', content: 'hello '.repeat(4000) }]);
    const ready = ref(false);
    const stats = useChatStats(ref([]), request, ref(preset(4096)), ref(75), ready);
    expect(stats.isCompressionThresholdReached.value).toBe(false);
    ready.value = true;
    expect(stats.isCompressionThresholdReached.value).toBe(true);
    request.value = [{ role: 'user', content: 'short' }];
    expect(stats.isCompressionThresholdReached.value).toBe(false);
  });
});
