/**
 * API 预设模块 - 类型定义
 */

/**
 * API 配置接口
 */
export interface ApiConfig {
  url: string;
  apiKey: string;
  model: string;
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

/**
 * 预设接口
 */
export interface Preset {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  /** 核采样阈值（top_p）。 */
  topP: number;
  /** 频率惩罚（frequency_penalty）。 */
  frequencyPenalty: number;
  /** 存在惩罚（presence_penalty）。 */
  presencePenalty: number;
  /** 停止序列（stop）。 */
  stopSequences: string[];
  /** 随机种子（seed）。未设置时由上游随机。 */
  seed?: number;
  /** 上下文窗口上限（token 数），上下文使用率与压缩阈值的唯一来源。 */
  contextLength: number;
  maxOutputTokens: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * API 预设表单数据接口
 *
 * 与 `Preset` 的可编辑字段一一对应。`contextLength` 是「最大上下文 Tokens」
 * 滑块的绑定字段，也是上下文窗口的唯一来源（早期另有一个 `maxTokens` 字段与之重叠，已移除）。
 */
export interface PresetFormData {
  url: string;
  apiKey: string;
  model: string;
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
