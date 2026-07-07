import { requestJson } from '@/api/http';
import type { KnowledgeBase } from '@/types';
import { DEFAULT_KNOWLEDGE_BASES } from '@/constants';

const KNOWLEDGE_BASE_API_BASE = '/api/knowledge-bases';

function requestKnowledgeBases<T>(options: RequestInit = {}): Promise<T> {
  return requestJson<T>(KNOWLEDGE_BASE_API_BASE, options);
}

export async function loadKnowledgeBases(): Promise<KnowledgeBase[]> {
  const saved = await requestKnowledgeBases<KnowledgeBase[]>();
  return Array.isArray(saved) ? saved : [...DEFAULT_KNOWLEDGE_BASES];
}

export async function saveKnowledgeBases(knowledgeBases: KnowledgeBase[]): Promise<void> {
  await requestKnowledgeBases<KnowledgeBase[]>({
    method: 'PUT',
    body: JSON.stringify({ knowledgeBases }),
  });
}
