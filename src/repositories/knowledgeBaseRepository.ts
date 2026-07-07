import type { KnowledgeBase } from '@/types';
import { DEFAULT_KNOWLEDGE_BASES } from '@/constants';

const KNOWLEDGE_BASE_API_BASE = '/api/knowledge-bases';

async function readApiJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    return await response.json() as T;
  }

  let message = `请求失败 (${response.status})`;
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string };
    message = data.error?.message || data.message || message;
  } catch {
    // 保留默认错误信息
  }

  throw new Error(message);
}

async function requestJson<T>(options: RequestInit = {}): Promise<T> {
  const response = await fetch(KNOWLEDGE_BASE_API_BASE, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return readApiJson<T>(response);
}

export async function loadKnowledgeBases(): Promise<KnowledgeBase[]> {
  const saved = await requestJson<KnowledgeBase[]>();
  return Array.isArray(saved) ? saved : [...DEFAULT_KNOWLEDGE_BASES];
}

export async function saveKnowledgeBases(knowledgeBases: KnowledgeBase[]): Promise<void> {
  await requestJson<KnowledgeBase[]>({
    method: 'PUT',
    body: JSON.stringify({ knowledgeBases }),
  });
}
