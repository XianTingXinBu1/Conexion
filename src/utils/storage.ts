/**
 * 统一存储管理模块
 * 
 * 策略：
 * - localStorage: 存储配置类数据（主题、设置等，数据小、频繁读取）
 * - IndexedDB: 存储大数据（聊天记录、角色卡、知识库等）
 */

import { get, set, del, createStore, keys as idbKeys, clear as idbClear } from 'idb-keyval';

// IndexedDB 存储（大数据）
export const dbStore = createStore('conexion-db', 'data');

/**
 * 存储类型
 */
export type StorageType = 'local' | 'indexeddb';

/**
 * 存储配置映射
 */
const STORAGE_CONFIG: Record<string, StorageType> = {
  // localStorage: 配置类数据
  'conexion_theme': 'local',
  'conexion_enter_to_send': 'local',
  'conexion_show_word_count': 'local',
  'conexion_enable_markdown': 'local',
  'conexion_show_message_index': 'local',
  'conexion_chat_history_limit': 'local',
  'conexion_selected_preset': 'local',
  'conexion_selected_prompt_preset': 'local',
  'conexion_selected_user_character': 'local',
  'conexion_merge_prompt_presets': 'local',
  'conexion_prompt_merge_mode': 'local',
  'conexion_debug_mode': 'local',

  // IndexedDB: 大数据
  'conexion_regex_scripts': 'indexeddb',
  'conexion_user_characters': 'indexeddb',
  'conexion_ai_characters': 'indexeddb',
  'conexion_api_presets': 'indexeddb',
  'conexion_models': 'indexeddb',
  'conexion_conversations': 'indexeddb',
  'conexion_prompt_presets': 'indexeddb',
  'conexion_knowledge_bases': 'indexeddb',
};

/**
 * 获取存储类型
 */
function getStorageType(key: string): StorageType {
  return STORAGE_CONFIG[key] || 'indexeddb';
}

/**
 * 获取数据
 */
export async function getStorage<T>(key: string, defaultValue: T): Promise<T> {
  const type = getStorageType(key);

  try {
    if (type === 'local') {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } else {
      const value = await get<T>(key, dbStore);
      return value !== undefined ? value : defaultValue;
    }
  } catch (e) {
    console.warn(`Failed to get ${key} from ${type}:`, e);
    return defaultValue;
  }
}

/**
 * 设置数据
 */
export async function setStorage<T>(key: string, value: T): Promise<void> {
  const type = getStorageType(key);

  try {
    if (type === 'local') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      await set(key, value, dbStore);
    }
  } catch (e) {
    console.warn(`Failed to set ${key} to ${type}:`, e);
    throw e;
  }
}

/**
 * 删除数据
 */
export async function removeStorage(key: string): Promise<void> {
  const type = getStorageType(key);

  try {
    if (type === 'local') {
      localStorage.removeItem(key);
    } else {
      await del(key, dbStore);
    }
  } catch (e) {
    console.warn(`Failed to remove ${key} from ${type}:`, e);
  }
}

/**
 * 清空所有存储
 */
export async function clearStorage(): Promise<void> {
  try {
    // 清空 localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('conexion_')) {
        localStorage.removeItem(key);
      }
    });

    // 清空 IndexedDB
    await idbClear(dbStore);
  } catch (e) {
    console.warn('Failed to clear storage:', e);
  }
}

/**
 * 获取所有存储键
 */
export async function getAllStorageKeys(): Promise<string[]> {
  try {
    const localKeys = Object.keys(localStorage).filter(key => key.startsWith('conexion_'));
    const indexedDBKeys = await idbKeys(dbStore);
    return [...localKeys, ...indexedDBKeys.map(k => String(k))];
  } catch (e) {
    console.warn('Failed to get storage keys:', e);
    return [];
  }
}

/**
 * 获取存储使用情况
 */
export async function getStorageUsage(): Promise<{
  local: { used: number; total: number };
  indexedDB: { used: number; total: number };
}> {
  try {
    // localStorage 使用量
    let localUsed = 0;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('conexion_')) {
        localUsed += localStorage.getItem(key)!.length * 2; // UTF-16, 每个字符 2 字节
      }
    });

    // IndexedDB 使用量（估算）
    let indexedDBUsed = 0;
    const allKeys = await idbKeys(dbStore);
    for (const key of allKeys) {
      const value = await get(key, dbStore);
      if (value !== undefined) {
        indexedDBUsed += JSON.stringify(value).length * 2;
      }
    }

    return {
      local: {
        used: localUsed,
        total: 5 * 1024 * 1024, // localStorage 通常 5MB
      },
      indexedDB: {
        used: indexedDBUsed,
        total: 50 * 1024 * 1024, // IndexedDB 通常 50MB+
      },
    };
  } catch (e) {
    console.warn('Failed to get storage usage:', e);
    return {
      local: { used: 0, total: 5 * 1024 * 1024 },
      indexedDB: { used: 0, total: 50 * 1024 * 1024 },
    };
  }
}

// 注意：如需迁移数据，可使用 getStorage 从 localStorage 读取后，使用 setStorage 保存到 IndexedDB