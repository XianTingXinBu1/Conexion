# 系统提示词构建模块 - 功能总结

## 模块概述

已成功创建 `src/modules/system-prompt/` 模块，该模块负责将提示词预设中的条目转换为 OpenAI 格式的 messages 数组。

## 文件结构

```
src/modules/system-prompt/
├── index.ts                    # 模块主入口
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
│   ├── builder.test.ts        # 核心构建测试
│   └── merger.test.ts         # 合并逻辑测试
├── README.md                  # 模块文档
├── USAGE.md                   # 使用指南
└── SUMMARY.md                 # 本文件
```

## 核心功能

### 1. 动态提示词构建 (`buildSystemPrompt`)

根据提示词预设和相关数据（角色、用户、知识库、聊天历史）构建完整的 messages 数组。

**特性：**
- 按条目的 `insertPosition` 排序
- 只包含启用的条目
- 自动填充特殊条目内容
- 支持消息合并
- 提供构建元数据

### 2. 智能内容填充 (`fillItemContent`)

自动识别并填充特殊条目内容：

| 条目名称 | 占位符类型 | 数据来源 |
|---------|-----------|---------|
| 角色设定 | character | aiCharacter |
| 用户设定 | user | userCharacter |
| 知识库 | knowledge | knowledgeBases |
| 聊天历史 | chat-history | chatHistory |
| 用户指令 | user-instruction | userInstruction |

### 3. 消息合并 (`mergeMessages`)

支持三种合并模式：

- `none`: 不合并
- `adjacent`: 合并相邻同类型的消息（推荐）
- `all`: 合并所有消息到一个 system 消息中

### 4. Token 估算

提供粗略的 token 数量估算（1 token ≈ 4 字符）。

## 使用示例

### 基本用法

```typescript
import { buildSystemPrompt } from '@/modules/system-prompt';

const result = buildSystemPrompt({
  preset: promptPreset,           // 提示词预设
  aiCharacter: character,         // AI 角色（可选）
  userCharacter: user,            // 用户角色（可选）
  knowledgeBases: knowledgeBases, // 知识库列表（可选）
  chatHistory: messages,          // 聊天历史（可选）
  mergeMode: 'adjacent',          // 合并模式
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
import { getStorage } from '@/utils/storage';
import { STORAGE_KEYS } from '@/constants';

const { selectedAICharacter, selectedUserCharacter } = useCharacters();
const { knowledgeBases } = useKnowledgeBases();
const selectedPreset = ref();

onMounted(async () => {
  selectedPreset.value = await getStorage(STORAGE_KEYS.SELECTED_PROMPT_PRESET, null);
});

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

### 主要函数

#### buildSystemPrompt(config: SystemPromptConfig): SystemPromptResult

构建系统提示词的核心函数。

**参数：**
- `preset`: 提示词预设
- `aiCharacter`: AI 角色（可选）
- `userCharacter`: 用户角色（可选）
- `knowledgeBases`: 知识库列表（可选）
- `chatHistory`: 聊天历史（可选）
- `userInstruction`: 用户指令（可选）
- `mergeMode`: 合并模式（默认: 'adjacent'）
- `filterEmptyPrompts`: 是否过滤空的 prompt（默认: true）

**返回值：**
- `messages`: 构建后的 messages 数组
- `usedItemIds`: 使用的条目 ID 列表
- `skippedItemIds`: 被跳过的条目 ID 列表
- `chatHistoryCount`: 聊天历史消息数量
- `userInstructionIncluded`: 是否包含用户指令
- `estimatedTokens`: 总 token 数估算
- `metadata`: 构建元数据

### 工具函数

- `estimateTokens(text: string): number` - 估算文本的 token 数量
- `estimateMessagesTokens(messages: ChatMessage[]): number` - 估算 messages 数组的总 token 数量
- `normalizeContent(content: string): string` - 格式化内容
- `isContentEmpty(content: string): boolean` - 检查内容是否为空
- `isValidRoleType(role: string): boolean` - 验证角色类型
- `mergeMessages(messages: ChatMessage[], mode: MergeMode): MergeResult` - 合并消息

### 辅助函数

- `fillItemContent(item: PromptItem, context: ContentFillerContext)` - 填充条目内容
- `isChatHistoryItem(item: PromptItem): boolean` - 检查是否为聊天历史条目

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

## 构建流程

1. **排序条目**: 按 `insertPosition` 排序
2. **过滤条目**: 跳过未启用的条目
3. **填充内容**: 根据条目名称自动填充特殊条目
4. **处理聊天历史**: 将聊天历史拆分为多个消息
5. **过滤空内容**: 可选地过滤空的 prompt
6. **合并消息**: 根据合并模式合并相邻同类型消息
7. **估算 Token**: 计算估算的 token 数量
8. **返回结果**: 返回构建的 messages 数组和元数据

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

## 集成建议

### 在 ChatPage.vue 中集成

```typescript
// 导入模块
import { buildSystemPrompt } from '@/modules/system-prompt';

// 在发送消息函数中使用
const handleSendMessage = async () => {
  // 构建系统提示词
  const result = buildSystemPrompt({
    preset: currentPromptPreset.value,
    aiCharacter: selectedAICharacter.value,
    userCharacter: selectedUserCharacter.value,
    knowledgeBases: knowledgeBases.value,
    chatHistory: currentConversation.value.messages,
    mergeMode: 'adjacent',
  });

  // 添加用户消息
  const messages = [
    ...result.messages,
    {
      role: 'user',
      content: userMessage.value,
    },
  ];

  // 调用 API
  await callChatAPI(messages);

  // 显示 token 使用量
  console.log(`Est. tokens: ${result.estimatedTokens}`);
};
```

## 未来改进

- 支持自定义占位符类型
- 支持更精确的 token 计算（使用 gpt-tokenizer）
- 支持上下文窗口限制管理
- 支持提示词模板系统
- 支持多语言提示词
- 支持条件性内容填充

## 相关文档

- [README.md](./README.md) - 详细文档
- [USAGE.md](./USAGE.md) - 使用指南
- [example.test.ts](./__tests__/example.test.ts) - 使用示例
- [validate.test.ts](./__tests__/validate.test.ts) - 功能验证

## 测试状态

- ✅ 类型检查通过
- ✅ 模块结构完整
- ✅ 所有文件已创建
- ✅ 导入路径正确
- ⏳ 等待在 Vue 组件中集成测试
