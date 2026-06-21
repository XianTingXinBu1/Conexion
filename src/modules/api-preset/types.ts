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
  maxTokens: number;
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
  maxTokens: number;
  maxOutputTokens: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * API 预设表单数据接口
 */
export interface PresetFormData {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
}
