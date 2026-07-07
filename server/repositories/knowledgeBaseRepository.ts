import type { KnowledgeBase } from '../../src/types';
import type { AppStorage } from '../storage/appStorage';

const cloneKnowledgeBase = (knowledgeBase: KnowledgeBase): KnowledgeBase => ({
  ...knowledgeBase,
  entries: knowledgeBase.entries.map(entry => ({ ...entry })),
});

export class KnowledgeBaseRepository {
  private readonly storage: AppStorage;

  constructor(storage: AppStorage) {
    this.storage = storage;
  }

  async list(): Promise<KnowledgeBase[]> {
    const knowledgeBases = await this.storage.knowledgeBases.read();
    return Array.isArray(knowledgeBases) ? knowledgeBases.map(cloneKnowledgeBase) : [];
  }

  async replaceAll(knowledgeBases: KnowledgeBase[]): Promise<KnowledgeBase[]> {
    const nextKnowledgeBases = knowledgeBases.map(cloneKnowledgeBase);
    await this.storage.knowledgeBases.write(nextKnowledgeBases);
    return nextKnowledgeBases.map(cloneKnowledgeBase);
  }
}
