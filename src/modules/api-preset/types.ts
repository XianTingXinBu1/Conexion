/**
 * API 预设模块 - 类型定义
 */

export type ProxyType = 'query' | 'header';

/**
 * 代理配置接口
 */
export interface ProxyConfig {
  enabled: boolean;
  url: string;
  type: ProxyType;
  targetEndpoint?: string;
}

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
  proxy: ProxyConfig;
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
  proxy: ProxyConfig;
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
  proxy: {
    enabled: boolean;
    url: string;
    type: ProxyType;
    targetEndpoint: string;
  };
}