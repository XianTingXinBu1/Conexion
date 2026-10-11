/**
 * API 预设模块
 *
 * 提供 API 预设的完整管理功能
 */

// 类型定义
export type { ApiConfig, Preset, PresetFormData } from './types';

// Composable
export { useApiPresets } from './useApiPresets';

// 停止序列的文本 ↔ 数组转换
export { formatStopSequences, parseStopSequences } from './stopSequences';

// 组件
export { ApiConfigForm, ModelSelector, ParameterSettings, PresetSelector } from './components';