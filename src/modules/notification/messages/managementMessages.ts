import { type NotificationMessage } from './types';

/**
 * 管理相关通知消息键类型
 */
export type ManagementMessageKey =
  // 正则脚本相关
  | 'REGEX_RULE_ADD_SUCCESS'
  | 'REGEX_RULE_UPDATE_SUCCESS'
  | 'REGEX_RULE_DELETE_SUCCESS'
  | 'REGEX_RULE_ENABLE_SUCCESS'
  | 'REGEX_RULE_DISABLE_SUCCESS'
  // 提示词预设相关
  | 'PROMPT_PRESET_CREATE_SUCCESS'
  | 'PROMPT_PRESET_RENAME_SUCCESS'
  | 'PROMPT_PRESET_DELETE_SUCCESS'
  | 'PROMPT_ITEM_DELETE_SUCCESS'
  | 'PROMPT_ITEM_ADD_SUCCESS'
  | 'PROMPT_ITEM_UPDATE_SUCCESS'
  | 'PROMPT_ITEM_ENABLE_SUCCESS'
  | 'PROMPT_ITEM_DISABLE_SUCCESS'
  // 角色管理相关
  | 'CHARACTER_ADD_USER_SUCCESS'
  | 'CHARACTER_ADD_AI_SUCCESS'
  | 'CHARACTER_UPDATE_USER_SUCCESS'
  | 'CHARACTER_UPDATE_AI_SUCCESS'
  | 'CHARACTER_DELETE_USER_SUCCESS'
  | 'CHARACTER_DELETE_AI_SUCCESS'
  // 会话管理相关
  | 'CONVERSATION_CREATE_TEMP_SUCCESS'
  | 'CONVERSATION_CREATE_CHARACTER_SUCCESS'
  | 'CONVERSATION_RENAME_SUCCESS'
  | 'CONVERSATION_DELETE_SUCCESS'
  | 'CONVERSATION_LOAD_SUCCESS'
  | 'CONVERSATION_SAVE_SUCCESS'
  | 'CONVERSATION_TEMP_WARNING'
  // 知识库相关
  | 'KNOWLEDGE_BASE_DISABLE_SUCCESS'
  | 'KNOWLEDGE_BASE_ENABLE_SUCCESS'
  | 'KNOWLEDGE_BASE_CREATE_SUCCESS'
  | 'KNOWLEDGE_BASE_UPDATE_SUCCESS'
  | 'KNOWLEDGE_BASE_ENTRY_ADD_SUCCESS'
  | 'KNOWLEDGE_BASE_ENTRY_UPDATE_SUCCESS'
  | 'KNOWLEDGE_BASE_DELETE_SUCCESS'
  | 'KNOWLEDGE_BASE_ENTRY_DELETE_SUCCESS'
  // 设置相关
  | 'SETTINGS_DATA_DELETE_SUCCESS'
  | 'SETTINGS_RESTORE_SUCCESS';

/**
 * 管理相关通知消息配置
 */
export const MANAGEMENT_MESSAGES: Record<ManagementMessageKey, (params?: Record<string, string | number>) => NotificationMessage> = {
  // ==================== 正则脚本相关 ====================

  /**
   * 正则规则添加成功
   */
  REGEX_RULE_ADD_SUCCESS: (params) => ({
    type: 'success',
    title: '规则已添加',
    message: `"${String(params?.name || '')}" 已成功添加`,
  }),

  /**
   * 正则规则更新成功
   */
  REGEX_RULE_UPDATE_SUCCESS: (params) => ({
    type: 'success',
    title: '规则已更新',
    message: `"${String(params?.name || '')}" 已成功更新`,
  }),

  /**
   * 正则规则删除成功
   */
  REGEX_RULE_DELETE_SUCCESS: () => ({
    type: 'info',
    title: '规则已删除',
    message: '正则规则已成功删除',
  }),

  /**
   * 正则规则启用成功
   */
  REGEX_RULE_ENABLE_SUCCESS: (params) => ({
    type: 'success',
    title: '已启用',
    message: `"${String(params?.name || '')}" 已启用`,
  }),

  /**
   * 正则规则禁用成功
   */
  REGEX_RULE_DISABLE_SUCCESS: (params) => ({
    type: 'info',
    title: '已禁用',
    message: `"${String(params?.name || '')}" 已禁用`,
  }),

  // ==================== 提示词预设相关 ====================

  /**
   * 提示词预设创建成功
   */
  PROMPT_PRESET_CREATE_SUCCESS: (params) => ({
    type: 'success',
    title: '预设已创建',
    message: `"${String(params?.name || '')}" 已成功创建`,
  }),

  /**
   * 提示词预设重命名成功
   */
  PROMPT_PRESET_RENAME_SUCCESS: (params) => ({
    type: 'success',
    title: '预设已重命名',
    message: `"${String(params?.name || '')}" 已成功重命名`,
  }),

  /**
   * 提示词预设删除成功
   */
  PROMPT_PRESET_DELETE_SUCCESS: () => ({
    type: 'info',
    title: '预设已删除',
    message: '预设已成功删除',
  }),

  /**
   * 提示词条目删除成功
   */
  PROMPT_ITEM_DELETE_SUCCESS: () => ({
    type: 'info',
    title: '条目已删除',
    message: '提示词条目已成功删除',
  }),

  /**
   * 提示词条目添加成功
   */
  PROMPT_ITEM_ADD_SUCCESS: (params) => ({
    type: 'success',
    title: '条目已添加',
    message: `"${String(params?.name || '')}" 已成功添加`,
  }),

  /**
   * 提示词条目更新成功
   */
  PROMPT_ITEM_UPDATE_SUCCESS: (params) => ({
    type: 'success',
    title: '条目已更新',
    message: `"${String(params?.name || '')}" 已成功更新`,
  }),

  /**
   * 提示词条目启用成功
   */
  PROMPT_ITEM_ENABLE_SUCCESS: (params) => ({
    type: 'success',
    title: '已启用',
    message: `"${String(params?.name || '')}" 已启用`,
  }),

  /**
   * 提示词条目禁用成功
   */
  PROMPT_ITEM_DISABLE_SUCCESS: (params) => ({
    type: 'info',
    title: '已禁用',
    message: `"${String(params?.name || '')}" 已禁用`,
  }),

  // ==================== 角色管理相关 ====================

  /**
   * 用户角色添加成功
   */
  CHARACTER_ADD_USER_SUCCESS: (params) => ({
    type: 'success',
    title: '角色已添加',
    message: `用户角色 "${String(params?.name || '')}" 创建成功`,
  }),

  /**
   * AI 角色添加成功
   */
  CHARACTER_ADD_AI_SUCCESS: (params) => ({
    type: 'success',
    title: '角色已添加',
    message: `AI角色 "${String(params?.name || '')}" 创建成功`,
  }),

  /**
   * 用户角色更新成功
   */
  CHARACTER_UPDATE_USER_SUCCESS: (params) => ({
    type: 'success',
    title: '角色已更新',
    message: `用户角色 "${String(params?.name || '')}" 已更新`,
  }),

  /**
   * AI 角色更新成功
   */
  CHARACTER_UPDATE_AI_SUCCESS: (params) => ({
    type: 'success',
    title: '角色已更新',
    message: `AI角色 "${String(params?.name || '')}" 已更新`,
  }),

  /**
   * 用户角色删除成功
   */
  CHARACTER_DELETE_USER_SUCCESS: () => ({
    type: 'info',
    title: '角色已删除',
    message: '用户角色已删除',
  }),

  /**
   * AI 角色删除成功
   */
  CHARACTER_DELETE_AI_SUCCESS: () => ({
    type: 'info',
    title: '角色已删除',
    message: 'AI角色已删除',
  }),

  // ==================== 会话管理相关 ====================

  /**
   * 临时会话创建成功
   */
  CONVERSATION_CREATE_TEMP_SUCCESS: () => ({
    type: 'success',
    title: '会话已创建',
    message: '临时会话已创建',
  }),

  /**
   * 角色会话创建成功
   */
  CONVERSATION_CREATE_CHARACTER_SUCCESS: (params) => ({
    type: 'success',
    title: '会话已创建',
    message: `与 "${String(params?.name || '')}" 的会话已创建`,
  }),

  /**
   * 会话重命名成功
   */
  CONVERSATION_RENAME_SUCCESS: (params) => ({
    type: 'success',
    title: '会话已重命名',
    message: `已重命名为 "${String(params?.name || '')}"`,
  }),

  /**
   * 会话删除成功
   */
  CONVERSATION_DELETE_SUCCESS: () => ({
    type: 'info',
    title: '会话已删除',
    message: '会话已成功删除',
  }),

  /**
   * 会话加载成功
   */
  CONVERSATION_LOAD_SUCCESS: (params) => ({
    type: 'success',
    title: '加载成功',
    message: `已加载 ${String(params?.count || 0)} 条历史消息`,
  }),

  /**
   * 会话保存成功
   */
  CONVERSATION_SAVE_SUCCESS: () => ({
    type: 'success',
    title: '保存成功',
    message: '会话已保存',
  }),

  /**
   * 临时会话警告
   */
  CONVERSATION_TEMP_WARNING: () => ({
    type: 'warning',
    title: '临时会话',
    message: '此会话将不会被保存',
  }),

  // ==================== 知识库相关 ====================

  /**
   * 知识库禁用成功
   */
  KNOWLEDGE_BASE_DISABLE_SUCCESS: (params) => ({
    type: 'info',
    title: '已禁用',
    message: `"${String(params?.name || '')}" 已全局禁用`,
  }),

  /**
   * 知识库启用成功
   */
  KNOWLEDGE_BASE_ENABLE_SUCCESS: (params) => ({
    type: 'success',
    title: '已启用',
    message: `"${String(params?.name || '')}" 已全局启用`,
  }),

  /**
   * 知识库创建成功
   */
  KNOWLEDGE_BASE_CREATE_SUCCESS: (params) => ({
    type: 'success',
    title: '知识库已创建',
    message: `"${String(params?.name || '')}" 已成功创建`,
  }),

  /**
   * 知识库更新成功
   */
  KNOWLEDGE_BASE_UPDATE_SUCCESS: (params) => ({
    type: 'success',
    title: '知识库已更新',
    message: `"${String(params?.name || '')}" 已成功更新`,
  }),

  /**
   * 知识库条目添加成功
   */
  KNOWLEDGE_BASE_ENTRY_ADD_SUCCESS: (params) => ({
    type: 'success',
    title: '条目已添加',
    message: `"${String(params?.name || '')}" 已成功添加`,
  }),

  /**
   * 知识库条目更新成功
   */
  KNOWLEDGE_BASE_ENTRY_UPDATE_SUCCESS: (params) => ({
    type: 'success',
    title: '条目已更新',
    message: `"${String(params?.name || '')}" 已成功更新`,
  }),

  /**
   * 知识库删除成功
   */
  KNOWLEDGE_BASE_DELETE_SUCCESS: () => ({
    type: 'info',
    title: '知识库已删除',
    message: '知识库已成功删除',
  }),

  /**
   * 知识库条目删除成功
   */
  KNOWLEDGE_BASE_ENTRY_DELETE_SUCCESS: () => ({
    type: 'info',
    title: '条目已删除',
    message: '知识条目已成功删除',
  }),

  // ==================== 设置相关 ====================

  /**
   * 数据删除成功
   */
  SETTINGS_DATA_DELETE_SUCCESS: () => ({
    type: 'warning',
    title: '数据已清除',
    message: '所有本地数据已成功删除',
  }),

  /**
   * 设置恢复成功
   */
  SETTINGS_RESTORE_SUCCESS: () => ({
    type: 'success',
    title: '设置已恢复',
    message: '所有设置已恢复为默认值',
  }),
};