import { buildDriver, BASE_URL, waitForVisible } from '../helpers/driver.mjs';

export default {
  '消息下方操作与两端箭头；在底部跟随，上翻后聚焦和输出均不强制滚动': async () => {
    const driver = buildDriver();
    try {
      await driver.get(BASE_URL);
      await waitForVisible(driver, '#app', 15000);
      const result = await driver.executeAsyncScript(function (done) {
        (async () => {
          let app;
          let host;
          try {
            const { createApp, defineComponent, h, ref, nextTick } = await import('/node_modules/.vite/deps/vue.js');
            const { useChatScrollPolicy } = await import('/src/features/chat/presentation/useChatScrollPolicy.ts');
            const { default: MessageItem } = await import('/src/components/chat/MessageItem.vue');
            const container = ref();
            let policy;
            const content = ref('长回复内容\n'.repeat(120));
            host = document.createElement('div');
            host.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white';
            document.body.append(host);
            app = createApp(defineComponent({
              setup() {
                policy = useChatScrollPolicy(container);
                return () => h('div', { ref: container, style: 'height:260px;width:360px;overflow:auto' }, [
                  h(MessageItem, { message: { id: 'a', type: 'assistant', content: content.value, timestamp: 1 },
                    index: 0, totalMessages: 1, displayCount: 1, theme: 'light', enableMarkdown: false,
                    showWordCount: false, showMessageIndex: false, canRetry: true, variantCount: 2, variantIndex: 1 }),
                ]);
              },
            }));
            app.mount(host);
            const settle = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 80)); };
            await settle();
            policy.onPageLoad();
            await settle();
            const el = container.value;
            const bottom = () => el.scrollHeight - el.scrollTop - el.clientHeight < 25;
            if (!bottom()) throw new Error('页面初次加载未到达底部');
            content.value += '新增输出\n'.repeat(30);
            policy.onStreamFlush();
            await settle();
            if (!bottom()) throw new Error(`在底部没有跟随新增输出: ${el.scrollTop}/${el.scrollHeight}/${el.clientHeight}, follow=${policy.isNearBottom.value}`);
            const body = el.querySelector('.message-content').getBoundingClientRect();
            const footer = el.querySelector('.message-footer').getBoundingClientRect();
            const arrows = el.querySelectorAll('.variant-btn');
            if (footer.top < body.bottom - 1) throw new Error('操作未位于消息下方');
            if (arrows[0].getBoundingClientRect().left > footer.left + 2 || arrows[1].getBoundingClientRect().right < footer.right - 2) throw new Error('版本箭头未分居两端');
            el.scrollTop = 80;
            el.dispatchEvent(new Event('scroll'));
            const readingTop = el.scrollTop;
            content.value += '更多输出\n'.repeat(30);
            policy.onStreamFlush();
            policy.onInputFocus();
            policy.onMessageSend();
            await settle();
            if (Math.abs(el.scrollTop - readingTop) > 1) throw new Error('上翻后仍被强制滚动');
            el.scrollTop = el.scrollHeight;
            el.dispatchEvent(new Event('scroll'));
            content.value += '再次输出\n'.repeat(20);
            await settle();
            if (!bottom()) throw new Error('回到底部后没有恢复跟随');
            // Cancel a queued follow when the reader scrolls away before its frame.
            policy.onStreamFlush();
            el.scrollTop = 100;
            el.dispatchEvent(new Event('scroll'));
            await settle();
            if (Math.abs(el.scrollTop - 100) > 1) throw new Error('延迟滚动覆盖用户阅读位置');
            done({ ok: true });
          } catch (error) { done({ ok: false, error: String(error) }); }
          finally { app?.unmount(); host?.remove(); }
        })();
      });
      if (!result.ok) throw new Error(result.error);
    } finally { await driver.quit(); }
  },
};
