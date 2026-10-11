// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/vue';
import { defineComponent, h, reactive } from 'vue';
import ParameterSettings from '../ParameterSettings.vue';

/**
 * ParameterSettings 是纯接线组件：props 进、emit 出。
 *
 * 这里锁定三处容易静默坏掉的地方：
 * 1. 新增参数有没有真的接到 UI 上（滑块/输入框在不在、顺序对不对）；
 * 2. 停止序列的文本 ↔ 数组转换（转义、空行、上限）；
 * 3. seed 清空必须是 `undefined` 而不是 `0`——`0` 是「固定种子」，会让输出失去随机性。
 *
 * Host 里逐个列出 props 与 `onUpdate:*` 是有意的：写错字段名 TS 会直接报错，
 * 等于顺带校验了组件的 prop/emit 表面。
 */
interface SettingsState {
  streamEnabled: boolean;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  seed?: number;
  contextLength: number;
  maxOutputTokens: number;
}

const DEFAULT_STATE: SettingsState = {
  streamEnabled: true,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: [],
  seed: undefined,
  contextLength: 2048,
  maxOutputTokens: 4096,
};

function mountSettings(initial: Partial<SettingsState> = {}) {
  const state = reactive<SettingsState>({ ...DEFAULT_STATE, ...initial });

  const Host = defineComponent({
    setup() {
      return () => h(ParameterSettings, {
        streamEnabled: state.streamEnabled,
        temperature: state.temperature,
        topP: state.topP,
        frequencyPenalty: state.frequencyPenalty,
        presencePenalty: state.presencePenalty,
        stopSequences: state.stopSequences,
        seed: state.seed,
        contextLength: state.contextLength,
        maxOutputTokens: state.maxOutputTokens,
        'onUpdate:streamEnabled': (value: boolean) => { state.streamEnabled = value; },
        'onUpdate:temperature': (value: number) => { state.temperature = value; },
        'onUpdate:topP': (value: number) => { state.topP = value; },
        'onUpdate:frequencyPenalty': (value: number) => { state.frequencyPenalty = value; },
        'onUpdate:presencePenalty': (value: number) => { state.presencePenalty = value; },
        'onUpdate:stopSequences': (value: string[]) => { state.stopSequences = value; },
        'onUpdate:seed': (value: number | undefined) => { state.seed = value; },
        'onUpdate:contextLength': (value: number) => { state.contextLength = value; },
        'onUpdate:maxOutputTokens': (value: number) => { state.maxOutputTokens = value; },
      });
    },
  });

  return { state, ...render(Host) };
}

const sliderLabels = (container: Element): string[] =>
  [...container.querySelectorAll('.form-slider-label')].map(el => el.textContent ?? '');

const sliders = (container: Element): HTMLInputElement[] =>
  [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')];

const stopTextarea = (container: Element): HTMLTextAreaElement => {
  const element = container.querySelector<HTMLTextAreaElement>('textarea');
  if (!element) throw new Error('停止序列文本框不存在');
  return element;
};

const seedInput = (container: Element): HTMLInputElement => {
  const element = container.querySelector<HTMLInputElement>('input[placeholder="留空则每次随机"]');
  if (!element) throw new Error('随机种子输入框不存在');
  return element;
};

describe('ParameterSettings', () => {
  it('把采样参数渲染成滑块，顺序与标签固定', () => {
    const { container } = mountSettings();

    expect(sliderLabels(container)).toEqual([
      '温度',
      'Top P（核采样）',
      '频率惩罚',
      '存在惩罚',
      '最大上下文 Tokens',
      '最大输出 Tokens',
    ]);
  });

  it('滑块与输入框显示 props 里的当前值', () => {
    const { container } = mountSettings({ topP: 0.9, frequencyPenalty: -1.5, seed: 42 });

    const [temperature, topP, frequencyPenalty] = sliders(container);
    expect(temperature!.value).toBe('0.7');
    expect(topP!.value).toBe('0.9');
    expect(frequencyPenalty!.value).toBe('-1.5');
    expect(seedInput(container).value).toBe('42');
  });

  it('拖动滑块 emit 新的采样参数', async () => {
    const { state, container } = mountSettings();
    const [, topP, frequencyPenalty, presencePenalty] = sliders(container);

    await fireEvent.update(topP!, '0.35');
    await fireEvent.update(frequencyPenalty!, '1.2');
    await fireEvent.update(presencePenalty!, '-0.4');

    expect(state.topP).toBe(0.35);
    expect(state.frequencyPenalty).toBe(1.2);
    expect(state.presencePenalty).toBe(-0.4);
  });

  it('停止序列一行一条，支持 \\n 转义', async () => {
    const { state, container } = mountSettings();

    await fireEvent.update(stopTextarea(container), '\\n\\nUser:\n###');

    expect(state.stopSequences).toEqual(['\n\nUser:', '###']);
  });

  it('停止序列丢空行并按上限截断', async () => {
    const { state, container } = mountSettings();

    await fireEvent.update(stopTextarea(container), '1\n\n2\n3\n4\n5\n');

    expect(state.stopSequences).toEqual(['1', '2', '3', '4']);
  });

  it('停止序列条数有计数器，超过上限时能看到', async () => {
    const { container } = mountSettings();

    expect(container.querySelector('.field-counter')?.textContent).toBe('0/4');

    await fireEvent.update(stopTextarea(container), 'a\nb');

    expect(container.querySelector('.field-counter')?.textContent).toBe('2/4');
  });

  it('停止序列回填时把真换行编码回 \\n，保持单行显示', () => {
    const { container } = mountSettings({ stopSequences: ['\n\nUser:'] });

    expect(stopTextarea(container).value).toBe('\\n\\nUser:');
  });

  it('随机种子：填写发出数字，清空发出 undefined（而不是 0）', async () => {
    const { state, container } = mountSettings();

    await fireEvent.update(seedInput(container), '42');
    expect(state.seed).toBe(42);

    await fireEvent.update(seedInput(container), '');
    expect(state.seed).toBeUndefined();
  });

  it('流式开关仍然可切换', async () => {
    const { state, container } = mountSettings();

    const toggle = container.querySelector('button.form-toggle');
    expect(toggle).not.toBeNull();

    await fireEvent.click(toggle!);

    expect(state.streamEnabled).toBe(false);
  });
});
