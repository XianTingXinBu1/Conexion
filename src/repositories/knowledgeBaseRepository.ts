import type { KnowledgeBase } from '@/types';
import { DEFAULT_KNOWLEDGE_BASES, STORAGE_KEYS } from '@/constants';
import { getStorage, setStorage } from '@/utils/storage';

export async function loadKnowledgeBases(): Promise<KnowledgeBase[]> {
  const saved = await getStorage<KnowledgeBase[]>(STORAGE_KEYS.KNOWLEDGE_BASES, [...DEFAULT_KNOWLEDGE_BASES]);
  return Array.isArray(saved) ? saved : [...DEFAULT_KNOWLEDGE_BASES];
}

export async function saveKnowledgeBases(knowledgeBases: KnowledgeBase[]): Promise<void> {
  await setStorage(STORAGE_KEYS.KNOWLEDGE_BASES, knowledgeBases);
}
