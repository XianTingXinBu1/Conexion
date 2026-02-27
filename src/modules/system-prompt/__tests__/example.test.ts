/**
 * 系统提示词构建模块 - 使用示例
 *
 * 这是一个示例文件，演示如何使用 system-prompt 模块
 */

import { buildSystemPrompt, estimateTokens } from '../index';
import type { SystemPromptConfig } from '../types';
import type { PromptPreset, AICharacter, UserCharacter, KnowledgeBase, Message } from '@/types';

// 示例：创建一个简单的提示词预设
const examplePreset: PromptPreset = {
  id: 'example-preset',
  name: '示例预设',
  items: [
    {
      id: 'main-prompt',
      name: '主提示词',
      description: '设置主要的系统提示词',
      enabled: true,
      prompt: '你是一个友好的AI助手，能够帮助用户解决问题。',
      roleType: 'system',
      insertPosition: 1,
    },
    {
      id: 'character-setting',
      name: '角色设定',
      description: '配置AI角色的基础设定',
      enabled: true,
      prompt: '', // 空内容，将自动填充
      roleType: 'system',
      insertPosition: 2,
    },
    {
      id: 'user-setting',
      name: '用户设定',
      description: '配置用户身份信息',
      enabled: true,
      prompt: '', // 空内容，将自动填充
      roleType: 'system',
      insertPosition: 3,
    },
    {
      id: 'knowledge-base',
      name: '知识库',
      description: '管理知识库相关设置',
      enabled: true,
      prompt: '', // 空内容，将自动填充
      roleType: 'system',
      insertPosition: 4,
    },
    {
      id: 'chat-history',
      name: '聊天历史',
      description: '管理聊天历史记录',
      enabled: true,
      prompt: '', // 空内容，将自动填充
      roleType: 'system',
      insertPosition: 5,
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 示例：创建 AI 角色
const exampleAICharacter: AICharacter = {
  id: 'ai-char-1',
  name: '智能助手',
  description: '一个专业的AI助手，擅长解答各种问题',
  personality: '友善、专业、耐心、乐于助人',
  createdAt: Date.now(),
};

// 示例：创建用户角色
const exampleUserCharacter: UserCharacter = {
  id: 'user-char-1',
  name: '小明',
  description: '一个好奇的用户，喜欢探索新知识',
  createdAt: Date.now(),
};

// 示例：创建知识库
const exampleKnowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb-1',
    name: '技术文档',
    description: '包含技术相关的知识',
    globallyEnabled: true,
    entries: [
      {
        id: 'kb-entry-1',
        name: 'JavaScript 基础',
        content: 'JavaScript 是一种动态编程语言，主要用于 Web 开发。',
        enabled: true,
        priority: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'kb-entry-2',
        name: 'Vue 3',
        content: 'Vue 3 是一个流行的前端框架，采用 Composition API。',
        enabled: true,
        priority: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// 示例：创建聊天历史
const exampleChatHistory: Message[] = [
  {
    id: 'msg-1',
    type: 'user',
    content: '你好，请介绍一下 Vue 3。',
    timestamp: Date.now(),
  },
  {
    id: 'msg-2',
    type: 'assistant',
    content: 'Vue 3 是一个渐进式 JavaScript 框架，它提供了更好的性能和开发体验。',
    timestamp: Date.now(),
  },
  {
    id: 'msg-3',
    type: 'user',
    content: '什么是 Composition API？',
    timestamp: Date.now(),
  },
];

// 示例：构建系统提示词
const exampleConfig: SystemPromptConfig = {
  preset: examplePreset,
  aiCharacter: exampleAICharacter,
  userCharacter: exampleUserCharacter,
  knowledgeBases: exampleKnowledgeBases,
  chatHistory: exampleChatHistory,
  mergeMode: 'adjacent',
  filterEmptyPrompts: true,
};

// 执行构建
const result = buildSystemPrompt(exampleConfig);

// 输出结果
console.log('=== 系统提示词构建结果 ===');
console.log('\nMessages 数组:');
result.messages.forEach((msg, index) => {
  console.log(`\n[${index + 1}] Role: ${msg.role}`);
  console.log(`Content:\n${msg.content}`);
  console.log(`Tokens: ${estimateTokens(msg.content)}`);
});

console.log('\n=== 统计信息 ===');
console.log(`总消息数: ${result.messages.length}`);
console.log(`使用条目数: ${result.usedItemIds.length}`);
console.log(`跳过条目数: ${result.skippedItemIds.length}`);
console.log(`聊天历史消息数: ${result.chatHistoryCount}`);
console.log(`估算 Token 数: ${result.estimatedTokens}`);

console.log('\n=== 构建元数据 ===');
console.log(JSON.stringify(result.metadata, null, 2));

console.log('\n=== 填充结果 ===');
Object.entries(result.metadata.filledPlaceholders).forEach(([itemId, info]) => {
  console.log(`\n条目 ID: ${itemId}`);
  console.log(`占位符类型: ${info.placeholder}`);
  console.log(`填充成功: ${info.success}`);
  console.log(`内容长度: ${info.contentLength}`);
});
