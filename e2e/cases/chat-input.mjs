import { buildDriver, BASE_URL, waitForVisible } from '../helpers/driver.mjs';

export default {
  '输入法与换行保护、生成中草稿和延迟发送确认': async () => {
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
            const { default: ChatInput } = await import('/src/components/chat/ChatInput.vue');
            const active = ref(false);
            const draft = ref('中文');
            let sends = 0;
            let cancels = 0;
            let accept;
            host = document.createElement('div');
            document.body.append(host);
            app = createApp(defineComponent({ setup() {
              return () => h(ChatInput, {
                modelValue: draft.value, 'onUpdate:modelValue': value => { draft.value = value; },
                enterToSend: true, isRequestActive: active.value, isSending: active.value,
                onSend: (_content, accepted) => { sends++; accept = accepted; },
                onCancel: () => { cancels++; },
              });
            } }));
            app.mount(host);
            await nextTick();
            const input = host.querySelector('textarea');
            const enter = options => {
              const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
              input.dispatchEvent(event);
              return event;
            };
            input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            enter({});
            input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
            enter({ isComposing: true });
            if (enter({ shiftKey: true }).defaultPrevented || sends) throw new Error('输入法确认或 Shift+Enter 被当成发送');
            enter({});
            if (sends !== 1 || draft.value !== '中文') throw new Error('发送前草稿未保留');
            accept();
            await nextTick();
            if (draft.value !== '') throw new Error('保存成功后未清空草稿');
            active.value = true;
            await nextTick();
            if (input.disabled) throw new Error('生成时无法输入');
            input.value = '下一条';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            enter({});
            if (sends !== 1 || cancels || draft.value !== '下一条') throw new Error('生成中 Enter 影响了当前请求或草稿');
            host.querySelector('.stop-btn').click();
            if (cancels !== 1) throw new Error('停止按钮未取消请求');
            done({ ok: true });
          } catch (error) { done({ ok: false, error: String(error) }); }
          finally { app?.unmount(); host?.remove(); }
        })();
      });
      if (!result.ok) throw new Error(result.error);
    } finally { await driver.quit(); }
  },
};
