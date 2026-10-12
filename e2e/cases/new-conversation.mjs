import { buildDriver, BASE_URL, By, waitForVisible } from '../helpers/driver.mjs';

export default {
  '新建选择角色后留在聊天页，返回回到会话列表且旧消息不带入': async () => {
    const driver = buildDriver();
    try {
      await driver.get(BASE_URL);
      await waitForVisible(driver, '#app', 15000);
      await driver.executeScript(() => {
        const originalFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
          const url = String(input);
          const character = { id: 'e2e-new-chat', name: '新会话测试角色', description: '', personality: '', firstMessage: '新会话开场白', createdAt: 1 };
          if (url.includes('/api/characters/ai')) {
            return Promise.resolve(new Response(JSON.stringify(url.endsWith('/ai') ? [character] : character), { headers: { 'Content-Type': 'application/json' } }));
          }
          return originalFetch(input, init);
        };
        location.hash = '/conversation-list';
      });
      await waitForVisible(driver, '.conversation-list-page', 15000);
      await driver.findElement(By.css('.page-header .nav-btn:last-child')).click();
      await waitForVisible(driver, '.character-option', 10000);
      await driver.findElement(By.css('.character-option')).click();
      await waitForVisible(driver, '.chat-page', 10000);
      await driver.sleep(400);
      const url = await driver.getCurrentUrl();
      if (!url.includes('/chat/character/e2e-new-chat')) throw new Error(`新建跳转被弹窗关闭回退: ${url}`);
      await driver.wait(async () => (await driver.findElement(By.css('.chat-messages')).getText()).includes('新会话开场白'), 10000);
      const count = await driver.findElements(By.css('.message-item'));
      if (count.length !== 1) throw new Error(`新会话消息数异常: ${count.length}`);
      await driver.navigate().back();
      await waitForVisible(driver, '.conversation-list-page', 10000);
      if ((await driver.findElements(By.css('.character-option'))).length) throw new Error('返回后角色弹窗重新出现');
    } finally { await driver.quit(); }
  },
};
