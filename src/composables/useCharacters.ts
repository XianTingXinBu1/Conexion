import { ref, computed } from 'vue';
import type { UserCharacter, AICharacter, CharacterType } from '../types';
import { DEFAULT_USER_CHARACTER, DEFAULT_AI_CHARACTERS, STORAGE_KEYS } from '../constants';
import { getStorage, setStorage } from '@/utils/storage';

/**
 * 角色管理 Composable
 * 提供用户角色和 AI 角色的加载、保存、添加、编辑、删除等功能
 */
export function useCharacters() {
  // 用户角色
  const userCharacters = ref<UserCharacter[]>([]);
  const selectedUserId = ref<string | null>(null);

  // AI 角色
  const aiCharacters = ref<AICharacter[]>([]);

  /**
   * 计算属性：当前选中的用户角色
   */
  const selectedUser = computed(() =>
    userCharacters.value.find(c => c.id === selectedUserId.value)
  );

  /**
   * 加载用户角色
   */
  const loadUserCharacters = async () => {
    const stored = await getStorage<UserCharacter[]>(STORAGE_KEYS.USER_CHARACTERS, [DEFAULT_USER_CHARACTER]);
    if (stored && stored.length > 0) {
      userCharacters.value = stored;
    } else {
      userCharacters.value = [DEFAULT_USER_CHARACTER];
    }
  };

  /**
   * 加载 AI 角色
   */
  const loadAICharacters = async () => {
    const stored = await getStorage<AICharacter[]>(STORAGE_KEYS.AI_CHARACTERS, [...DEFAULT_AI_CHARACTERS]);
    if (stored && stored.length > 0) {
      aiCharacters.value = stored;
    } else {
      aiCharacters.value = [...DEFAULT_AI_CHARACTERS];
    }
  };

  /**
   * 加载选中的用户角色
   */
  const loadSelectedUser = async () => {
    const stored = await getStorage<string | null>(STORAGE_KEYS.SELECTED_USER_CHARACTER, null);
    if (stored) {
      selectedUserId.value = stored;
    } else if (userCharacters.value.length > 0) {
      selectedUserId.value = userCharacters.value[0]?.id || null;
    }
  };

  /**
   * 保存用户角色
   */
  const saveUserCharacters = async () => {
    await setStorage(STORAGE_KEYS.USER_CHARACTERS, userCharacters.value);
  };

  /**
   * 保存 AI 角色
   */
  const saveAICharacters = async () => {
    await setStorage(STORAGE_KEYS.AI_CHARACTERS, aiCharacters.value);
  };

  /**
   * 保存选中的用户角色
   */
  const saveSelectedUser = async () => {
    if (selectedUserId.value) {
      await setStorage(STORAGE_KEYS.SELECTED_USER_CHARACTER, selectedUserId.value);
    }
  };

  /**
   * 选择用户角色
   */
  const selectUser = async (id: string) => {
    selectedUserId.value = id;
    await saveSelectedUser();
  };

  /**
   * 添加用户角色
   */
  const addUserCharacter = async (character: Omit<UserCharacter, 'id' | 'createdAt'>): Promise<UserCharacter> => {
    const newCharacter: UserCharacter = {
      id: Date.now().toString(),
      ...character,
      createdAt: Date.now(),
    };
    userCharacters.value.push(newCharacter);
    await saveUserCharacters();
    // 如果是第一个角色，自动选中
    if (userCharacters.value.length === 1) {
      selectedUserId.value = newCharacter.id;
      await saveSelectedUser();
    }
    return newCharacter;
  };

  /**
   * 添加 AI 角色
   */
  const addAICharacter = async (character: Omit<AICharacter, 'id' | 'createdAt'>): Promise<AICharacter> => {
    const newCharacter: AICharacter = {
      id: Date.now().toString(),
      ...character,
      createdAt: Date.now(),
    };
    aiCharacters.value.push(newCharacter);
    await saveAICharacters();
    return newCharacter;
  };

  /**
   * 更新用户角色
   */
  const updateUserCharacter = async (id: string, updates: Partial<UserCharacter>): Promise<boolean> => {
    const index = userCharacters.value.findIndex(c => c.id === id);
    if (index !== -1) {
      userCharacters.value[index] = { ...userCharacters.value[index], ...updates } as UserCharacter;
      await saveUserCharacters();
      return true;
    }
    return false;
  };

  /**
   * 更新 AI 角色
   */
  const updateAICharacter = async (id: string, updates: Partial<AICharacter>): Promise<boolean> => {
    const index = aiCharacters.value.findIndex(c => c.id === id);
    if (index !== -1) {
      aiCharacters.value[index] = { ...aiCharacters.value[index], ...updates } as AICharacter;
      await saveAICharacters();
      return true;
    }
    return false;
  };

  /**
   * 删除用户角色
   */
  const deleteUserCharacter = async (id: string): Promise<boolean> => {
    const initialLength = userCharacters.value.length;
    userCharacters.value = userCharacters.value.filter(c => c.id !== id);
    if (userCharacters.value.length < initialLength) {
      await saveUserCharacters();
      // 如果删除的是当前选中的角色，切换到第一个角色
      if (selectedUserId.value === id && userCharacters.value.length > 0) {
        const firstCharacter = userCharacters.value[0];
        if (firstCharacter) {
          selectedUserId.value = firstCharacter.id;
          await saveSelectedUser();
        }
      }
      return true;
    }
    return false;
  };

  /**
   * 删除 AI 角色
   */
  const deleteAICharacter = async (id: string): Promise<boolean> => {
    const initialLength = aiCharacters.value.length;
    aiCharacters.value = aiCharacters.value.filter(c => c.id !== id);
    if (aiCharacters.value.length < initialLength) {
      await saveAICharacters();
      return true;
    }
    return false;
  };

  /**
   * 获取用户角色
   */
  const getUserCharacter = (id: string): UserCharacter | undefined => {
    return userCharacters.value.find(c => c.id === id);
  };

  /**
   * 获取 AI 角色
   */
  const getAICharacter = (id: string): AICharacter | undefined => {
    return aiCharacters.value.find(c => c.id === id);
  };

  /**
   * 根据类型获取角色
   */
  const getCharacter = (type: CharacterType, id: string): UserCharacter | AICharacter | undefined => {
    if (type === 'user') {
      return getUserCharacter(id);
    } else {
      return getAICharacter(id);
    }
  };

  /**
   * 初始化（加载所有角色数据）
   */
  const init = async () => {
    await loadUserCharacters();
    await loadAICharacters();
    await loadSelectedUser();
  };

  return {
    // 用户角色
    userCharacters,
    selectedUserId,
    selectedUser,
    // AI 角色
    aiCharacters,
    // 通用方法
    loadUserCharacters,
    loadAICharacters,
    loadSelectedUser,
    saveUserCharacters,
    saveAICharacters,
    saveSelectedUser,
    selectUser,
    addUserCharacter,
    addAICharacter,
    updateUserCharacter,
    updateAICharacter,
    deleteUserCharacter,
    deleteAICharacter,
    getUserCharacter,
    getAICharacter,
    getCharacter,
    init,
  };
}