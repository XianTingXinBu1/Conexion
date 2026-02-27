import { ref, computed } from 'vue';
import type { KnowledgeBase, KnowledgeEntry } from '../types';
import { STORAGE_KEYS, DEFAULT_KNOWLEDGE_BASES } from '../constants';
import { getStorage, setStorage } from '@/utils/storage';

/**
 * 知识库管理 Composable
 * 提供知识库的加载、保存、切换、创建、删除、重命名等功能
 */
export function useKnowledgeBases() {
  const knowledgeBases = ref<KnowledgeBase[]>([...DEFAULT_KNOWLEDGE_BASES]);
  const selectedKnowledgeBaseId = ref<string | null>(null);

  /**
   * 计算属性：当前选中的知识库
   */
  const currentKnowledgeBase = computed<KnowledgeBase | null>(() =>
    selectedKnowledgeBaseId.value
      ? knowledgeBases.value.find(kb => kb.id === selectedKnowledgeBaseId.value) ?? null
      : null
  );

  /**
   * 加载知识库列表
   */
  const loadKnowledgeBases = async () => {
    const saved = await getStorage<KnowledgeBase[]>(STORAGE_KEYS.KNOWLEDGE_BASES, [...DEFAULT_KNOWLEDGE_BASES]);
    if (saved && Array.isArray(saved)) {
      knowledgeBases.value = saved;
    }
  };

  /**
   * 保存知识库列表
   */
  const saveKnowledgeBases = async () => {
    await setStorage(STORAGE_KEYS.KNOWLEDGE_BASES, knowledgeBases.value);
  };

  /**
   * 切换知识库
   */
  const selectKnowledgeBase = (knowledgeBaseId: string | null) => {
    selectedKnowledgeBaseId.value = knowledgeBaseId;
  };

  /**
   * 创建新知识库
   */
  const createKnowledgeBase = async (name: string, description: string = ''): Promise<KnowledgeBase> => {
    const newKnowledgeBase: KnowledgeBase = {
      id: 'kb-' + Date.now(),
      name,
      description,
      entries: [],
      globallyEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    knowledgeBases.value.push(newKnowledgeBase);
    await saveKnowledgeBases();
    return newKnowledgeBase;
  };

  /**
   * 更新知识库
   */
  const updateKnowledgeBase = async (id: string, updates: Partial<KnowledgeBase>): Promise<boolean> => {
    const index = knowledgeBases.value.findIndex(kb => kb.id === id);
    if (index !== -1) {
      knowledgeBases.value[index] = {
        ...knowledgeBases.value[index],
        ...updates,
        updatedAt: Date.now(),
      } as KnowledgeBase;
      await saveKnowledgeBases();
      return true;
    }
    return false;
  };

  /**
   * 删除知识库
   */
  const deleteKnowledgeBase = async (id: string): Promise<boolean> => {
    const initialLength = knowledgeBases.value.length;
    knowledgeBases.value = knowledgeBases.value.filter(kb => kb.id !== id);
    if (knowledgeBases.value.length < initialLength) {
      await saveKnowledgeBases();
      // 如果删除的是当前选中的知识库，清空选中状态
      if (selectedKnowledgeBaseId.value === id) {
        selectedKnowledgeBaseId.value = null;
      }
      return true;
    }
    return false;
  };

  /**
   * 重命名知识库
   */
  const renameKnowledgeBase = async (id: string, newName: string): Promise<boolean> => {
    return await updateKnowledgeBase(id, { name: newName });
  };

  /**
   * 添加知识条目
   */
  const addKnowledgeEntry = async (
    knowledgeBaseId: string,
    name: string,
    content: string,
    priority: number = 50
  ): Promise<KnowledgeEntry | null> => {
    const kbIndex = knowledgeBases.value.findIndex(kb => kb.id === knowledgeBaseId);
    if (kbIndex !== -1) {
      const kb = knowledgeBases.value[kbIndex];
      if (!kb) return null;

      const newEntry: KnowledgeEntry = {
        id: 'entry-' + Date.now(),
        name,
        content,
        enabled: true,
        priority,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      kb.entries.unshift(newEntry);
      kb.updatedAt = Date.now();
      await saveKnowledgeBases();
      return newEntry;
    }
    return null;
  };
  /**
   * 更新知识条目
   */
  const updateKnowledgeEntry = async (
    knowledgeBaseId: string,
    entryId: string,
    updates: Partial<KnowledgeEntry>
  ): Promise<boolean> => {
    const kbIndex = knowledgeBases.value.findIndex(kb => kb.id === knowledgeBaseId);
    if (kbIndex !== -1) {
      const kb = knowledgeBases.value[kbIndex];
      if (!kb) return false;

      const entryIndex = kb.entries.findIndex(e => e.id === entryId);
      if (entryIndex !== -1) {
        const entry = kb.entries[entryIndex];
        if (!entry) return false;

        kb.entries[entryIndex] = {
          ...entry,
          ...updates,
          // 确保 priority 字段存在
          priority: updates.priority ?? entry.priority ?? 50,
          updatedAt: Date.now(),
        };
        kb.updatedAt = Date.now();
        await saveKnowledgeBases();
        return true;
      }
    }
    return false;
  };
  /**
   * 删除知识条目
   */
  const deleteKnowledgeEntry = async (knowledgeBaseId: string, entryId: string): Promise<boolean> => {
    const kbIndex = knowledgeBases.value.findIndex(kb => kb.id === knowledgeBaseId);
    if (kbIndex !== -1) {
      const kb = knowledgeBases.value[kbIndex];
      if (!kb) return false;

      const initialLength = kb.entries.length;
      kb.entries = kb.entries.filter(e => e.id !== entryId);
      if (kb.entries.length < initialLength) {
        kb.updatedAt = Date.now();
        await saveKnowledgeBases();
        return true;
      }
    }
    return false;
  };

  /**
   * 切换知识条目启用状态
   */
  const toggleKnowledgeEntryEnabled = async (knowledgeBaseId: string, entryId: string): Promise<boolean> => {
    const kbIndex = knowledgeBases.value.findIndex(kb => kb.id === knowledgeBaseId);
    if (kbIndex !== -1) {
      const kb = knowledgeBases.value[kbIndex];
      if (!kb) return false;

      const entryIndex = kb.entries.findIndex(e => e.id === entryId);
      if (entryIndex !== -1) {
        const entry = kb.entries[entryIndex];
        if (!entry) return false;

        entry.enabled = !entry.enabled;
        kb.updatedAt = Date.now();
        await saveKnowledgeBases();
        return true;
      }
    }
    return false;
  };

  /**
   * 切换知识库全局启用状态
   */
  const toggleGlobalEnabled = async (knowledgeBaseId: string): Promise<boolean> => {
    const kbIndex = knowledgeBases.value.findIndex(kb => kb.id === knowledgeBaseId);
    if (kbIndex !== -1) {
      const kb = knowledgeBases.value[kbIndex];
      if (!kb) return false;

      kb.globallyEnabled = !kb.globallyEnabled;
      kb.updatedAt = Date.now();
      await saveKnowledgeBases();
      return true;
    }
    return false;
  };

  /**
   * 初始化
   */
  const init = async () => {
    await loadKnowledgeBases();
  };

  return {
    knowledgeBases,
    selectedKnowledgeBaseId,
    currentKnowledgeBase,
    loadKnowledgeBases,
    saveKnowledgeBases,
    selectKnowledgeBase,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    renameKnowledgeBase,
    addKnowledgeEntry,
    updateKnowledgeEntry,
    deleteKnowledgeEntry,
    toggleKnowledgeEntryEnabled,
    toggleGlobalEnabled,
    init,
  };
}