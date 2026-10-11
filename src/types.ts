export type Theme = 'light' | 'dark';

export type MessageType = 'user' | 'assistant' | 'system';

export type ConversationCompressionMode = 'manual' | 'auto';

/**
 * 文本动画类型
 */
export type TextAnimationType = 'none' | 'typewriter' | 'gradual-fade' | 'fade-in' | 'slide-up' | 'bounce';

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
}

/**
 * 模型接口
 */
export interface Model {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
}

/**
 * 预设接口
 */
export interface Preset {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  /** 核采样阈值（top_p）。1 表示关闭核采样。 */
  topP: number;
  /** 频率惩罚（frequency_penalty），降低逐字重复。 */
  frequencyPenalty: number;
  /** 存在惩罚（presence_penalty），鼓励引入新话题。 */
  presencePenalty: number;
  /** 停止序列（stop）。命中即截断输出，最多 `MAX_STOP_SEQUENCES` 条。 */
  stopSequences: string[];
  /** 随机种子（seed）。未设置时由上游随机，设置后同参数输出可复现。 */
  seed?: number;
  /**
   * 上下文窗口上限（token 数），上下文使用率与压缩阈值的**唯一来源**。
   *
   * 早期版本另有一个 `maxTokens` 字段承载同一个概念，导致「UI 改了但上限不变」。
   * 现已移除，旧数据由后端读取时迁移（见 `server/repositories/presetRepositories.ts`）。
   */
  contextLength: number;
  maxOutputTokens: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 代理类型
 */
/**
 * API 配置接口
 */
export interface ApiConfig {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stopSequences: string[];
  seed?: number;
  contextLength: number;
  maxOutputTokens: number;
}

/**
 * 正则规则作用域
 */
export type RegexScope = 'user' | 'assistant' | 'all';

/**
 * 正则规则应用时机
 */
export type RegexApplyTo = 'before-macro' | 'after-macro';

/**
 * 正则规则接口
 */
export interface RegexRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string;
  flags: string;
  replacement: string;
  scope: RegexScope;
  applyTo: RegexApplyTo;
}

/**
 * 角色类型
 */
export type CharacterType = 'user' | 'ai';

/**
 * 用户角色接口
 */
export interface UserCharacter {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

/**
 * AI角色接口
 */
export interface AICharacter {
  id: string;
  name: string;
  description: string;
  personality: string;
  knowledgeBaseId?: string;
  createdAt: number;
}

/**
 * 会话接口
 */
export interface ConversationCompression {
  compressedAt: number;
  summaryContent: string;
  promptContent: string;
  sourceMessageCount: number;
  sourceMessageIds: string[];
  keepRecentCount: number;
  contextBeforeCompression?: number;
  contextAfterCompression?: number;
}

export interface Conversation {
  id: string;
  title: string;
  characterId?: string;
  characterName?: string;
  messages: Message[];
  compressed?: boolean;
  compression?: ConversationCompression;
  createdAt: number;
  updatedAt: number;
}

/**
 * 提示词角色类型
 */
export type PromptRoleType = 'system' | 'user' | 'assistant';

/**
 * 系统提示词内容块类型
 */
export type PromptBlockType = 'custom' | 'character' | 'user' | 'knowledge';

/**
 * 提示词条目接口
 */
export interface PromptItem {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  prompt: string;
  roleType: PromptRoleType;
  /** 插入位置（1-1000），数字越小越靠前。所有条目按此位置排序 */
  insertPosition?: number;
}

/**
 * 提示词预设接口
 */
export interface PromptPreset {
  id: string;
  name: string;
  items: PromptItem[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 知识条目接口
 */
export interface KnowledgeEntry {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  /** 优先级（1-100），数字越小优先级越高，在构建提示词时按优先级排序 */
  priority: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 知识库接口
 */
export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  entries: KnowledgeEntry[];
  globallyEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * OpenAI Chat API 消息接口
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * OpenAI Chat Completion 请求接口
 */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  /** 核采样阈值。 */
  top_p?: number;
  /** 频率惩罚，按已出现频次压低重复用词。 */
  frequency_penalty?: number;
  /** 存在惩罚，鼓励引入新话题。 */
  presence_penalty?: number;
  /** 停止序列，命中即截断输出。 */
  stop?: string[];
  /** 随机种子。省略时由上游随机。 */
  seed?: number;
  stream?: boolean;
  /**
   * 流式响应需显式请求 usage：不传时上游可自行决定是否返回，
   * Token 面板会拿不到真实用量。
   */
  stream_options?: {
    include_usage?: boolean;
  };
}

/**
 * OpenAI Chat Completion 响应接口
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Chat Completion 流式响应块接口
 */
export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 通知类型
 */
export type NotificationType = 'info' | 'warning' | 'error' | 'success';

/**
 * 通知项接口
 */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  onClick?: () => void;
}