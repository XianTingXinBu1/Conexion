import type { Model } from '../types';

/**
 * 默认模型列表
 */
export const DEFAULT_MODELS: Model[] = [];

/**
 * 根据模型 ID 获取模型信息
 */
export function getModelById(modelId: string, models: Model[] = DEFAULT_MODELS): Model | undefined {
  return models.find(m => m.id === modelId);
}

/**
 * 过滤模型列表
 */
export function filterModels(query: string, models: Model[] = DEFAULT_MODELS): Model[] {
  if (!query) return models;
  const lowerQuery = query.toLowerCase();
  return models.filter(m =>
    m.name.toLowerCase().includes(lowerQuery) ||
    m.id.toLowerCase().includes(lowerQuery)
  );
}