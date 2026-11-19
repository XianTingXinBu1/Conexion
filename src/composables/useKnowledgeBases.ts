import { ref, computed } from 'vue';
import type { KnowledgeBase, KnowledgeEntry } from '@/types';
import { DEFAULT_KNOWLEDGE_BASES } from '../constants';
import { generalLogger } from '@/modules/debug';
import {
  loadKnowledgeBases as loadKnowledgeBasesFromRepository,
  saveKnowledgeBases as saveKnowledgeBasesToRepository,
} from '@/repositories/knowledgeBaseRepository';
import { clearKnowledgeBaseReferenceFromAICharacters } from '@/repositories/characterRepository';
import { createId } from '@/utils/id';

/** 写操作回滚用的深拷贝：知识库是整个数组一起 PUT，快照就按数组粒度做 */
function snapshot(list: KnowledgeBase[]): KnowledgeBase[] {
  return JSON.parse(JSON.stringify(list)) as KnowledgeBase[];
}

/**
 * 知识库管理 Composable
 * 提供知识库的加载、保存、切换、创建、删除、重命名等功能
 */
export function useKnowledgeBases() {
  const knowledgeBases = ref<KnowledgeBase[]>([...DEFAULT_KNOWLEDGE_BASES]);
  const selectedKnowledgeBaseId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const isLoading = ref(false);

  /**
   * 写操作串行化：所有写都是「整个数组 PUT」，并发发起时后一次会基于旧快照
   * 覆盖前一次的结果，因此必须排队执行。
   */
  let writeChain: Promise<unknown> = Promise.resolve();

  /**
   * 乐观更新 + 失败回滚。
   *
   * `mutate` 返回 false 表示「没有真正发生改动」（例如 id 不存在），此时不落库。
   * 以前每个写操作都是「先改内存 → await 保存 → 忽略返回值」：保存失败时界面
   * 已经提示成功、内存与后端不一致，刷新后数据「复活」或消失。
   */
  const runWrite = (mutate: () => boolean): Promise<boolean> => {
    const next = writeChain.catch(() => {}).then(async () => {
      const backup = snapshot(knowledgeBases.value);

      if (!mutate()) {
        knowledgeBases.value = backup;
        return false;
      }

      const saved = await saveKnowledgeBases();
      if (!saved) {
        knowledgeBases.value = backup;
      }
      return saved;
    });

    writeChain = next;
    return next as Promise<boolean>;
  };

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
  const loadKnowledgeBases = async (): Promise<boolean> => {
    isLoading.value = true;
    try {
      knowledgeBases.value = await loadKnowledgeBasesFromRepository();
      error.value = null;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载知识库失败';
      error.value = msg;
      generalLogger.error('加载知识库失败', { error: msg });
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 保存知识库列表
   */
  const saveKnowledgeBases = async (): Promise<boolean> => {
    try {
      await saveKnowledgeBasesToRepository(knowledgeBases.value);
      error.value = null;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '保存知识库失败';
      error.value = msg;
      generalLogger.error('保存知识库失败', { error: msg });
      return false;
    }
  };

  /**
   * 切换知识库
   */
  const selectKnowledgeBase = (knowledgeBaseId: string | null) => {
    selectedKnowledgeBaseId.value = knowledgeBaseId;
  };

  /**
   * 创建新知识库
   *
   * 落库失败时返回 null（内存里那条已回滚），调用方据此决定提示成功还是失败。
   */
  const createKnowledgeBase = async (
    name: string,
    description: string = '',
  ): Promise<KnowledgeBase | null> => {
    const newKnowledgeBase: KnowledgeBase = {
      id: `kb-${createId()}`,
      name,
      description,
      entries: [],
      globallyEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const saved = await runWrite(() => {
      knowledgeBases.value.push(newKnowledgeBase);
      return true;
    });

    return saved ? newKnowledgeBase : null;
  };

  /**
   * 更新知识库
   */
  const updateKnowledgeBase = async (id: string, updates: Partial<KnowledgeBase>): Promise<boolean> => {
    return runWrite(() => {
      const index = knowledgeBases.value.findIndex(kb => kb.id === id);
      if (index === -1) return false;

      knowledgeBases.value[index] = {
        ...knowledgeBases.value[index],
        ...updates,
        updatedAt: Date.now(),
      } as KnowledgeBase;
      return true;
    });
  };

  /**
   * 删除知识库
   */
  const deleteKnowledgeBase = async (id: string): Promise<boolean> => {
    const removed = await runWrite(() => {
      const before = knowledgeBases.value.length;
      knowledgeBases.value = knowledgeBases.value.filter(kb => kb.id !== id);
      return knowledgeBases.value.length < before;
    });

    if (!removed) return false;

    if (selectedKnowledgeBaseId.value === id) {
      selectedKnowledgeBaseId.value = null;
    }

    // 清理角色引用是第二步：知识库本身已经落库删掉，这里失败只记录，
    // 不回滚删除（否则后端已删、本地又冒出来）
    try {
      await clearKnowledgeBaseReferenceFromAICharacters(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '清理角色引用失败';
      error.value = msg;
      generalLogger.error('清理知识库引用失败', { error: msg, id });
    }

    return true;
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
    const newEntry: KnowledgeEntry = {
      id: `entry-${createId()}`,
      name,
      content,
      enabled: true,
      priority,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const saved = await runWrite(() => {
      const kb = knowledgeBases.value.find(item => item.id === knowledgeBaseId);
      if (!kb) return false;

      kb.entries.unshift(newEntry);
      kb.updatedAt = Date.now();
      return true;
    });

    return saved ? newEntry : null;
  };

  /**
   * 更新知识条目
   */
  const updateKnowledgeEntry = async (
    knowledgeBaseId: string,
    entryId: string,
    updates: Partial<KnowledgeEntry>
  ): Promise<boolean> => {
    return runWrite(() => {
      const kb = knowledgeBases.value.find(item => item.id === knowledgeBaseId);
      const entry = kb?.entries.find(item => item.id === entryId);
      if (!kb || !entry) return false;

      // 不允许通过 updates 改 id：改了就再也定位不到这条
      const { id: _ignoredId, ...safeUpdates } = updates;
      kb.entries[kb.entries.indexOf(entry)] = {
        ...entry,
        ...safeUpdates,
        priority: safeUpdates.priority ?? entry.priority ?? 50,
        updatedAt: Date.now(),
      };
      kb.updatedAt = Date.now();
      return true;
    });
  };

  /**
   * 删除知识条目
   */
  const deleteKnowledgeEntry = async (knowledgeBaseId: string, entryId: string): Promise<boolean> => {
    return runWrite(() => {
      const kb = knowledgeBases.value.find(item => item.id === knowledgeBaseId);
      if (!kb) return false;

      const before = kb.entries.length;
      kb.entries = kb.entries.filter(entry => entry.id !== entryId);
      if (kb.entries.length === before) return false;

      kb.updatedAt = Date.now();
      return true;
    });
  };

  /**
   * 切换知识条目启用状态
   */
  const toggleKnowledgeEntryEnabled = async (knowledgeBaseId: string, entryId: string): Promise<boolean> => {
    return runWrite(() => {
      const kb = knowledgeBases.value.find(item => item.id === knowledgeBaseId);
      const entry = kb?.entries.find(item => item.id === entryId);
      if (!kb || !entry) return false;

      entry.enabled = !entry.enabled;
      kb.updatedAt = Date.now();
      return true;
    });
  };

  /**
   * 切换知识库全局启用状态
   */
  const toggleGlobalEnabled = async (knowledgeBaseId: string): Promise<boolean> => {
    return runWrite(() => {
      const kb = knowledgeBases.value.find(item => item.id === knowledgeBaseId);
      if (!kb) return false;

      kb.globallyEnabled = !kb.globallyEnabled;
      kb.updatedAt = Date.now();
      return true;
    });
  };

  /**
   * 初始化
   */
  const init = async (): Promise<boolean> => {
    try {
      await loadKnowledgeBases();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '初始化知识库失败';
      error.value = msg;
      generalLogger.error('初始化知识库失败', { error: msg });
      return false;
    }
  };

  return {
    knowledgeBases,
    selectedKnowledgeBaseId,
    currentKnowledgeBase,
    error,
    isLoading,
    clearError: () => { error.value = null; },
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
