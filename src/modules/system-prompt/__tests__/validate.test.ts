/**
 * 系统提示词构建模块 - 功能验证
 *
 * 验证模块的基本功能是否正常
 */

// 测试导入
import {
  buildSystemPrompt,
  mergeMessages,
  estimateTokens,
  normalizeContent,
  isContentEmpty,
  isValidRoleType,
} from '../index';

import type { SystemPromptConfig } from '../types';
import type { PromptItem, PromptPreset, AICharacter, UserCharacter, KnowledgeBase } from '@/types';

console.log('=== System Prompt 模块功能验证 ===\n');

// 1. 测试工具函数
console.log('1. 测试工具函数:');
const testText = '这是一个测试文本';
const tokenCount = estimateTokens(testText);
console.log(`   estimateTokens("${testText}"): ${tokenCount}`);
console.log(`   normalizeContent("  Hello\\nWorld  "): "${normalizeContent('  Hello\nWorld  ')}"`);
console.log(`   isContentEmpty("   "): ${isContentEmpty('   ')}`);
console.log(`   isValidRoleType("system"): ${isValidRoleType('system')}`);
console.log(`   isValidRoleType("invalid"): ${isValidRoleType('invalid')}`);

// 2. 测试消息合并
console.log('\n2. 测试消息合并:');
const testMessages = [
  { role: 'system' as const, content: 'You are a helpful assistant.' },
  { role: 'system' as const, content: 'You answer questions concisely.' },
  { role: 'user' as const, content: 'What is AI?' },
  { role: 'assistant' as const, content: 'AI is artificial intelligence.' },
];
const mergeResult = mergeMessages(testMessages, 'adjacent');
console.log(`   合并前消息数: ${testMessages.length}`);
console.log(`   合并后消息数: ${mergeResult.messages.length}`);
console.log(`   合并次数: ${mergeResult.mergeCount}`);

// 3. 测试系统提示词构建
console.log('\n3. 测试系统提示词构建:');

// 定义测试条目
const testItems: PromptItem[] = [
  { id: '1', name: '主提示词', description: 'Test', enabled: true, prompt: 'You are AI', roleType: 'system' },
  { id: '2', name: '角色设定', description: 'Test', enabled: true, prompt: '', roleType: 'system' },
  { id: '3', name: '用户设定', description: 'Test', enabled: true, prompt: '', roleType: 'system' },
  { id: '4', name: '知识库', description: 'Test', enabled: true, prompt: '', roleType: 'system' },
  { id: '5', name: '聊天历史', description: 'Test', enabled: true, prompt: '', roleType: 'system' },
];

const testPreset: PromptPreset = {
  id: 'test-preset',
  name: '测试预设',
  items: testItems,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const testAICharacter: AICharacter = {
  id: 'test-ai',
  name: '测试助手',
  description: '一个测试用的AI助手',
  personality: '友善、专业',
  createdAt: Date.now(),
};

const testUserCharacter: UserCharacter = {
  id: 'test-user',
  name: '测试用户',
  description: '一个测试用户',
  createdAt: Date.now(),
};

const testKnowledgeBases: KnowledgeBase[] = [
  {
    id: 'test-kb',
    name: '测试知识库',
    description: '测试用知识库',
    globallyEnabled: true,
    entries: [
      {
        id: 'entry-1',
        name: '测试条目',
        content: '这是测试知识库内容',
        enabled: true,
        priority: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const config: SystemPromptConfig = {
  preset: testPreset,
  aiCharacter: testAICharacter,
  userCharacter: testUserCharacter,
  knowledgeBases: testKnowledgeBases,
  chatHistory: [],
  mergeMode: 'adjacent',
};

const result = buildSystemPrompt(config);

console.log(`   构建消息数: ${result.messages.length}`);
console.log(`   使用条目数: ${result.usedItemIds.length}`);
console.log(`   跳过条目数: ${result.skippedItemIds.length}`);
console.log(`   估算 Tokens: ${result.estimatedTokens}`);
console.log(`   填充占位符数: ${Object.keys(result.metadata.filledPlaceholders).length}`);

// 显示构建的 messages
console.log('\n   构建的 Messages:');
result.messages.forEach((msg, idx) => {
  console.log(`   [${idx + 1}] Role: ${msg.role}`);
  console.log(`       Content: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
  console.log(`       Tokens: ${estimateTokens(msg.content)}`);
});

// 4. 测试填充结果
console.log('\n4. 测试填充结果:');
Object.entries(result.metadata.filledPlaceholders).forEach(([itemId, info]) => {
  console.log(`   条目 ID: ${itemId}`);
  console.log(`   占位符类型: ${info.placeholder}`);
  console.log(`   填充成功: ${info.success}`);
  console.log(`   内容长度: ${info.contentLength}`);
});

console.log('\n=== 功能验证完成 ===');
