import { computed, ref, watch, type Ref } from 'vue';
import type { Message, Preset } from '../types';
import { countMessageTokens, countMessagesTokens } from '../utils/tokenCounter';

interface CachedMessageTokenEntry {
  signature: string;
  total: number;
  userTotal: number;
  assistantTotal: number;
}

const countByType = (messages: Message[], type: Message['type']) => {
  let count = 0;

  for (const message of messages) {
    if (message.type === type) count += 1;
  }

  return count;
};

export function useChatStats(messages: Ref<Message[]>, currentApiPreset: Ref<Preset | undefined>) {
  const tokenCache = new Map<string, CachedMessageTokenEntry>();
  const currentContextCountValue = ref(0);
  const userTokensValue = ref(0);
  const aiTokensValue = ref(0);

  watch(
    messages,
    (nextMessages) => {
      try {
        const activeIds = new Set<string>();
        let totalTokens = 0;
        let userTokens = 0;
        let aiTokens = 0;

        for (const message of nextMessages) {
          activeIds.add(message.id);

          const signature = `${message.type}:${message.content}`;
          const cached = tokenCache.get(message.id);

          if (cached?.signature === signature) {
            totalTokens += cached.total;
            userTokens += cached.userTotal;
            aiTokens += cached.assistantTotal;
            continue;
          }

          const role = message.type === 'user' ? 'user' : 'assistant';
          const total = countMessageTokens(role, message.content);
          const roleTokens = message.type === 'user' ? total : 0;
          const assistantTokens = message.type === 'assistant' ? total : 0;

          tokenCache.set(message.id, {
            signature,
            total,
            userTotal: roleTokens,
            assistantTotal: assistantTokens,
          });

          totalTokens += total;
          userTokens += roleTokens;
          aiTokens += assistantTokens;
        }

        for (const cachedId of tokenCache.keys()) {
          if (!activeIds.has(cachedId)) {
            tokenCache.delete(cachedId);
          }
        }

        currentContextCountValue.value = totalTokens;
        userTokensValue.value = userTokens;
        aiTokensValue.value = aiTokens;
      } catch {
        const chatMessages = nextMessages.map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content,
        }));
        const userMessages = nextMessages
          .filter(msg => msg.type === 'user')
          .map(msg => ({ role: 'user', content: msg.content }));
        const assistantMessages = nextMessages
          .filter(msg => msg.type === 'assistant')
          .map(msg => ({ role: 'assistant', content: msg.content }));

        currentContextCountValue.value = countMessagesTokens(chatMessages);
        userTokensValue.value = countMessagesTokens(userMessages);
        aiTokensValue.value = countMessagesTokens(assistantMessages);
      }
    },
    {
      immediate: true,
      deep: true,
    }
  );

  const currentContextCount = computed(() => currentContextCountValue.value);

  const maxContextLength = computed(() => {
    return currentApiPreset.value?.maxTokens || 4096;
  });

  const userTokens = computed(() => userTokensValue.value);
  const aiTokens = computed(() => aiTokensValue.value);

  const chatMessageCount = computed(() => messages.value.length);
  const userMessageCount = computed(() => countByType(messages.value, 'user'));
  const aiMessageCount = computed(() => countByType(messages.value, 'assistant'));

  return {
    currentContextCount,
    maxContextLength,
    userTokens,
    aiTokens,
    chatMessageCount,
    userMessageCount,
    aiMessageCount,
  };
}
