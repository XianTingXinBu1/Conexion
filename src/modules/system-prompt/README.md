# 系统提示词构建模块 (System Prompt Builder)

一个用于动态构建 OpenAI 格式提示词的 Vue 3 + TypeScript 模块。

## 功能特性

### 核心功能

- **动态提示词构建**: 根据提示词预设中的条目自动构建 OpenAI 格式的 messages 数组
- **智能内容填充**: 自动识别并填充特殊条目（角色设定、用户设定、知识库、聊天历史）
- **灵活排序**: 支持通过 `insertPosition` 自定义条目顺序
- **角色类型支持**: 支持 `system`、`user`、`assistant` 三种角色类型
- **消息合并**: 支持合并相邻同类型消息，减少 token 消耗
- **Token 估算**: 提供粗略的 token 数量估算功能

### 特殊条目

以下条目名称会被自动识别并填充内容：

| 条目名称 | 占位符类型 | 数据来源 | 描述 |
|---------|-----------|---------|------|
| 角色设定 | character | aiCharacter | AI 角色的人设和性格 |
| 用户设定 | user | userCharacter | 用户的身份信息 |
| 知识库 | knowledge | knowledgeBases | 知识库中的已启用条目 |
| 聊天历史 | chat-history | chatHistory | 对话历史记录 |
| 用户指令 | user-instruction | userInstruction | 当前用户输入的指令 |

## 目录结构

```
src/modules/system-prompt/
├── index.ts                    # 模块入口
├── types.ts                    # 类型定义
├── core/
│   ├── index.ts               # 核心功能导出
│   ├── builder.ts             # 核心构建器
│   ├── content-filler.ts      # 内容填充器
│   └── merger.ts              # 消息合并器
├── utils/
│   ├── index.ts               # 工具函数
│   └── constants.ts           # 常量定义
├── __tests__/
│   └── example.test.ts        # 使用示例
├── USAGE.md                   # 使用文档
└── README.md                  # 本文件
```

## 快速开始

### 基本用法

```typescript
import { buildSystemPrompt } from '@/modules/system-prompt';

const result = buildSystemPrompt({
  preset: promptPreset,           // 提示词预设
  aiCharacter: character,         // AI 角色（可选）
  userCharacter: user,            // 用户角色（可选）
  knowledgeBases: knowledgeBases, // 知识库列表（可选）
  chatHistory: messages,          // 聊天历史（可选）
  mergeMode: 'adjacent',          // 合并模式：'none' | 'adjacent' | 'all'
  filterEmptyPrompts: true,       // 是否过滤空的 prompt
});

// 使用构建的 messages 数组
console.log(result.messages);      // OpenAI 格式的 messages 数组
console.log(result.estimatedTokens); // 估算的 token 数量
```

### 在聊天页面中使用

```typescript
<script setup lang="ts">
import { buildSystemPrompt } from '@/modules/system-prompt';
import { useCharacters } from '@/composables/useCharacters';
import { useKnowledgeBases } from '@/composables/useKnowledgeBases';
import { usePromptPresets } from '@/composables/usePromptPresets';

const { selectedAICharacter, selectedUserCharacter } = useCharacters();
const { knowledgeBases } = useKnowledgeBases();
const { selectedPreset } = usePromptPresets();

// 构建系统提示词
const buildMessages = () => {
  const result = buildSystemPrompt({
    preset: selectedPreset.value,
    aiCharacter: selectedAICharacter.value,
    userCharacter: selectedUserCharacter.value,
    knowledgeBases: knowledgeBases.value,
    chatHistory: conversation.value.messages,
    mergeMode: 'adjacent',
  });

  return result.messages;
};

// 发送消息
const sendMessage = async (userMessage: string) => {
  const messages = buildMessages();

  // 添加用户消息
  messages.push({
    role: 'user',
    content: userMessage,
  });

  // 调用 API
  const response = await fetchChatCompletion(messages);
  // ...
};
</script>
```

## API 参考

### buildSystemPrompt(config: SystemPromptConfig): SystemPromptResult

构建系统提示词的核心函数。

**参数：**

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|-----|------|------|--------|------|
| preset | PromptPreset | 是 | - | 提示词预设 |
| aiCharacter | AICharacter | 否 | - | AI 角色 |
| userCharacter | UserCharacter | 否 | - | 用户角色 |
| knowledgeBases | KnowledgeBase[] | 否 | - | 知识库列表 |
| chatHistory | Message[] | 否 | - | 聊天历史 |
| userInstruction | string | 否 | - | 当前用户输入的指令 |
| mergeMode | MergeMode | 否 | 'adjacent' | 合并模式 |
| filterEmptyPrompts | boolean | 否 | true | 是否过滤空的 prompt |

**返回值：**

| 属性 | 类型 | 描述 |
|-----|------|------|
| messages | ChatMessage[] | 构建后的 messages 数组 |
| usedItemIds | string[] | 使用的条目 ID 列表 |
| skippedItemIds | string[] | 被跳过的条目 ID 列表 |
| chatHistoryCount | number | 聊天历史消息数量 |
| userInstructionIncluded | boolean | 是否包含用户指令 |
| estimatedTokens | number | 总 token 数估算 |
| metadata | BuildMetadata | 构建元数据 |

### 工具函数

#### estimateTokens(text: string): number

估算文本的 token 数量（粗略估算：1 token ≈ 4 字符）。

```typescript
const tokenCount = estimateTokens('这是一段文本');
```

#### estimateMessagesTokens(messages: ChatMessage[]): number

估算 messages 数组的总 token 数量。

```typescript
const totalTokens = estimateMessagesTokens(messages);
```

#### normalizeContent(content: string): string

格式化内容（去除首尾空白，规范化换行）。

```typescript
const normalized = normalizeContent('  Hello\nWorld  ');
// 结果: 'Hello\nWorld'
```

#### isContentEmpty(content: string): boolean

检查内容是否为空（只包含空白字符）。

```typescript
const isEmpty = isContentEmpty('   ');
// 结果: true
```

#### isValidRoleType(role: string): boolean

验证角色类型是否有效。

```typescript
const isValid = isValidRoleType('system');
// 结果: true
```

### 消息合并

#### mergeMessages(messages: ChatMessage[], mode: MergeMode): MergeResult

根据合并模式合并消息。

**合并模式：**

| 模式 | 描述 |
|-----|------|
| none | 不合并 |
| adjacent | 合并相邻同类型的消息（推荐） |
| all | 合并所有消息到一个 system 消息中 |

```typescript
const result = mergeMessages(messages, 'adjacent');
console.log('Merged messages:', result.messages);
console.log('Merge count:', result.mergeCount);
console.log('Saved messages:', result.savedMessages);
```

## 类型定义

### SystemPromptConfig

```typescript
interface SystemPromptConfig {
  preset: PromptPreset;
  aiCharacter?: AICharacter;
  userCharacter?: UserCharacter;
  knowledgeBases?: KnowledgeBase[];
  chatHistory?: Message[];
  userInstruction?: string;
  mergeMode?: MergeMode;
  filterEmptyPrompts?: boolean;
}
```

### SystemPromptResult

```typescript
interface SystemPromptResult {
  messages: ChatMessage[];
  usedItemIds: string[];
  skippedItemIds: string[];
  chatHistoryCount: number;
  userInstructionIncluded: boolean;
  estimatedTokens: number;
  metadata: BuildMetadata;
}
```

### MergeMode

```typescript
type MergeMode = 'none' | 'adjacent' | 'all';
```

## 设计原则

1. **类型安全**: 使用 TypeScript 严格模式，提供完整的类型定义
2. **灵活性**: 支持多种配置选项，适应不同场景
3. **可测试性**: 模块化设计，便于单元测试
4. **可扩展性**: 易于添加新的占位符类型和功能
5. **性能优化**: 提供消息合并功能，减少 token 消耗

## 注意事项

1. Token 估算是粗略的，实际 token 数量可能会有差异
2. 知识库只收集全局启用的知识库中的已启用条目
3. 聊天历史条目会被拆分为多个消息，每个消息保留原始类型
4. 条目按 `insertPosition` 排序，数字越小越靠前
5. 未启用或内容为空的条目会被跳过
6. 用户指令会作为特殊占位符 `user-instruction` 填充，适合用于动态插入用户当前输入
7. BuildMetadata 中的 `filledPlaceholders` 记录了每个特殊占位符的填充结果

## 未来改进

- 支持自定义占位符类型
- 支持更精确的 token 计算
- 支持上下文窗口限制管理
- 支持提示词模板系统
- 支持多语言提示词

## 相关文档

- [使用示例 (USAGE.md)](./USAGE.md)
- [示例测试 (__tests__/example.test.ts)](./__tests__/example.test.ts)