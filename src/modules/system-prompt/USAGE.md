# 系统提示词构建模块 - 使用示例

## 基本用法

```typescript
import { buildSystemPrompt } from '@/modules/system-prompt';
import type { SystemPromptConfig } from '@/modules/system-prompt';

// 准备配置
const config: SystemPromptConfig = {
  preset: promptPreset,           // 提示词预设
  aiCharacter: character,         // AI 角色（可选）
  userCharacter: user,            // 用户角色（可选）
  knowledgeBases: knowledgeBases, // 知识库列表（可选）
  chatHistory: messages,          // 聊天历史（可选）
  userInstruction: userInput,     // 用户指令（可选）
  mergeMode: 'adjacent',          // 合并模式：'none' | 'adjacent' | 'all'
  filterEmptyPrompts: true,       // 是否过滤空的 prompt
};

// 构建系统提示词
const result = buildSystemPrompt(config);

// 使用结果
console.log('Messages:', result.messages);
console.log('Estimated Tokens:', result.estimatedTokens);
console.log('Used Items:', result.usedItemIds);
console.log('Skipped Items:', result.skippedItemIds);
console.log('Chat History Count:', result.chatHistoryCount);
console.log('User Instruction Included:', result.userInstructionIncluded);
console.log('Metadata:', result.metadata);
```

## 特殊条目自动填充

以下条目名称会被自动识别并填充内容：

| 条目名称 | 占位符类型 | 数据来源 |
|---------|-----------|---------|
| 角色设定 | character | aiCharacter |
| 用户设定 | user | userCharacter |
| 知识库 | knowledge | knowledgeBases |
| 聊天历史 | chat-history | chatHistory |
| 用户指令 | user-instruction | userInstruction |

## 在聊天页面中使用

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

## Token 估算

```typescript
import { estimateTokens, estimateMessagesTokens } from '@/modules/system-prompt';

// 估算单个文本的 token 数
const tokenCount = estimateTokens('这是一段文本');

// 估算 messages 数组的总 token 数
const totalTokens = estimateMessagesTokens(messages);
```

## 消息合并

```typescript
import { mergeMessages } from '@/modules/system-prompt';

// 合并相邻同类型的消息
const result = mergeMessages(messages, 'adjacent');
console.log('Merged messages:', result.messages);
console.log('Merge count:', result.mergeCount);
console.log('Saved messages:', result.savedMessages);
```

## API 参考

### buildSystemPrompt(config: SystemPromptConfig): SystemPromptResult

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

### 其他工具函数

- `estimateTokens(text: string): number` - 估算文本的 token 数量
- `estimateMessagesTokens(messages: ChatMessage[]): number` - 估算 messages 数组的总 token 数量
- `normalizeContent(content: string): string` - 格式化内容
- `isContentEmpty(content: string): boolean` - 检查内容是否为空
- `isValidRoleType(role: string): boolean` - 验证角色类型