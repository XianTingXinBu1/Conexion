export type Theme = 'light' | 'dark';

export type MessageType = 'user' | 'assistant' | 'system';

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
  maxTokens: number;
  maxOutputTokens: number;
  proxy: ProxyConfig;
  /** 模型的上下文长度限制（token 数） */
  contextLength?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * 代理类型
 */
export type ProxyType = 'query' | 'header';

/**
 * 代理配置接口
 */
export interface ProxyConfig {
  enabled: boolean;
  url: string;
  type: ProxyType;
  targetEndpoint?: string;
}

/**
 * API 配置接口
 */
export interface ApiConfig {
  url: string;
  apiKey: string;
  model: string;
  streamEnabled: boolean;
  temperature: number;
  maxTokens: number;
  maxOutputTokens: number;
  proxy: ProxyConfig;
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
export interface Conversation {
  id: string;
  title: string;
  characterId?: string;
  characterName?: string;
  messages: Message[];
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
  stream?: boolean;
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