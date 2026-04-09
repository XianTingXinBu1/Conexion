/**
 * 存储键常量
 * 
 * 存储策略：
 * - localStorage: 配置类数据（主题、设置等，数据小、频繁读取）
 * - IndexedDB: 大数据（聊天记录、角色卡、知识库等）
 */
export const STORAGE_KEYS = {
  // localStorage: 配置类数据
  ENTER_TO_SEND: 'conexion_enter_to_send',
  THEME: 'conexion_theme',
  SHOW_WORD_COUNT: 'conexion_show_word_count',
  ENABLE_MARKDOWN: 'conexion_enable_markdown',
  SHOW_MESSAGE_INDEX: 'conexion_show_message_index',
  CHAT_HISTORY_LIMIT: 'conexion_chat_history_limit', // 初始加载消息数
  SELECTED_PRESET: 'conexion_selected_preset',
  SELECTED_PROMPT_PRESET: 'conexion_selected_prompt_preset', // 当前选中的提示词预设
  SELECTED_USER_CHARACTER: 'conexion_selected_user_character',
  MERGE_PROMPT_PRESETS: 'conexion_merge_prompt_presets', // 是否合并提示词预设到系统提示词
  PROMPT_MERGE_MODE: 'conexion_prompt_merge_mode', // 提示词合并模式: 'none' | 'adjacent' | 'all'
  DEBUG_MODE: 'conexion_debug_mode', // 调试模式开关
  STORAGE_SCHEMA_VERSION: 'conexion_storage_schema_version', // 存储 schema 版本

  // IndexedDB: 大数据
  REGEX_SCRIPTS: 'conexion_regex_scripts',
  USER_CHARACTERS: 'conexion_user_characters',
  AI_CHARACTERS: 'conexion_ai_characters',
  API_PRESETS: 'conexion_api_presets',
  MODELS: 'conexion_models', // 模型列表（包含关联的预设 ID 和 URL）
  CONVERSATIONS: 'conexion_conversations', // 会话列表
  PROMPT_PRESETS: 'conexion_prompt_presets', // 提示词预设列表
  KNOWLEDGE_BASES: 'conexion_knowledge_bases', // 知识库列表
} as const;

/**
 * 默认值常量
 */
export const DEFAULTS = {
  TEMPERATURE: 0.7,
  MAX_TOKENS: 2048,
  MAX_OUTPUT_TOKENS: 4096,
  STREAM_ENABLED: true as boolean,
  MODEL: '' as string,
  SHOW_MESSAGE_INDEX: false,
  CHAT_HISTORY_LIMIT: 20,
  MERGE_PROMPT_PRESETS: true, // 默认合并提示词预设
  PROMPT_MERGE_MODE: 'adjacent' as const, // 默认合并相邻同类型消息
  MAX_CONTEXT_LIMIT: 128, // 最大上下文消息数
  DEBUG_MODE: false, // 默认关闭调试模式
};

/**
 * 默认正则规则
 */
export const DEFAULT_REGEX_SCRIPTS = [
  {
    id: '1',
    name: '清理多余空行',
    enabled: true,
    pattern: '\\n{3,}',
    flags: 'g',
    replacement: '\\n\\n',
    scope: 'all' as const,
    applyTo: 'after-macro' as const,
  },
  {
    id: '2',
    name: '去除首尾空格',
    enabled: true,
    pattern: '^\\s+|\\s+$',
    flags: 'gm',
    replacement: '',
    scope: 'all' as const,
    applyTo: 'after-macro' as const,
  },
] as const;

/**
 * 默认用户角色
 */
export const DEFAULT_USER_CHARACTER = {
  id: 'default-user',
  name: '用户',
  description: '一个普通的用户',
  createdAt: Date.now(),
};

/**
 * 默认AI角色
 */
export const DEFAULT_AI_CHARACTERS = [
  {
    id: 'default-ai',
    name: '助手',
    description: '一个友好的AI助手',
    personality: '友善、乐于助人、耐心、专业',
    createdAt: Date.now(),
  },
];

/**
 * 默认预设数据
 */
export const DEFAULT_API_PRESETS = [
  {
    id: 'default',
    name: '默认预设',
    url: '',
    apiKey: '',
    model: '',
    streamEnabled: true,
    temperature: 0.7,
    maxTokens: 2048,
    maxOutputTokens: 4096,
    proxy: {
      enabled: false,
      url: '',
      type: 'query' as const,
      targetEndpoint: '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
] as const;

/**
 * 默认提示词条目
 * 只包含自动识别的特殊占位符类型
 */
export const DEFAULT_PROMPT_ITEMS = [
  {
    id: 'character-setting',
    name: '角色设定',
    description: '配置AI角色的基础设定（自动填充，不可编辑）',
    enabled: true,
    prompt: '',
    roleType: 'system' as const,
    insertPosition: 1
  },
  {
    id: 'user-setting',
    name: '用户设定',
    description: '配置用户身份信息（自动填充，不可编辑）',
    enabled: true,
    prompt: '',
    roleType: 'system' as const,
    insertPosition: 2
  },
  {
    id: 'knowledge-base',
    name: '知识库',
    description: '管理知识库相关设置（自动填充，不可编辑）',
    enabled: true,
    prompt: '',
    roleType: 'system' as const,
    insertPosition: 3
  },
  {
    id: 'chat-history',
    name: '聊天历史',
    description: '管理聊天历史记录',
    enabled: true,
    prompt: '',
    roleType: 'system' as const,
    insertPosition: 4
  },
  {
    id: 'user-instruction',
    name: '用户指令',
    description: '当前用户输入的指令（自动填充，不可编辑）',
    enabled: true,
    prompt: '',
    roleType: 'user' as const,
    insertPosition: 5
  }
] as const;

/**
 * 默认提示词预设
 */
export const DEFAULT_PROMPT_PRESETS = [
  {
    id: 'default',
    name: '默认预设',
    items: [...DEFAULT_PROMPT_ITEMS],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
] as const;

/**
 * 默认知识库
 */
export const DEFAULT_KNOWLEDGE_BASES = [] as const;