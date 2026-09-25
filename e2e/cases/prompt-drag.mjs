/**
 * 提示词预设 · 拖拽排序 E2E
 *
 * 验证两条拖拽路径的让位几何：
 * - 触摸：拖动项跟手，中间项让出「被拖项占用的节距」，插入指示跟随目标
 * - 鼠标（HTML5 DnD）：dragover 驱动让位与插入指示，拖动项本身不跟手
 *
 * 刻意不落位（触摸用 touchcancel、鼠标只发 dragend），
 * 这样用例不会改动用户预设的顺序，也没有任何数据副作用。
 */

import { buildDriver, BASE_URL, By, waitForVisible } from '../helpers/driver.mjs';

const PROMPT_URL = `${BASE_URL}/#/prompt-preset`;

/** 读取列表几何：首项节距（本项顶 → 下一项顶，含 gap）与各包装元素的 translateY */
const READ_GEOMETRY = `
  const wraps = [...document.querySelectorAll('.prompt-list > div')];
  const cards = wraps.map((w) => w.querySelector('.prompt-item'));
  const rects = cards.map((card) => card.getBoundingClientRect());
  return {
    names: cards.map((card) => card.querySelector('.prompt-name')?.textContent?.trim()),
    pitch: rects[1] ? rects[1].top - rects[0].top : rects[0].height,
    offsets: wraps.map((wrap) => Math.round(new DOMMatrixReadOnly(getComputedStyle(wrap).transform).m42)),
    insertIndex: cards.findIndex((card) => card.classList.contains('prompt-item--insert-before')),
    draggingIndex: cards.findIndex((card) => card.classList.contains('prompt-item--dragging')),
    listDragging: document.querySelector('.prompt-list').classList.contains('dragging-active'),
  };
`;

/** 在第一个拖拽手柄上装一套合成触摸事件发射器 */
const INSTALL_TOUCH = `
  const handle = document.querySelectorAll('.drag-handle')[0];
  const rect = handle.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  window.__startY = rect.top + rect.height / 2;
  window.__fireTouch = (type, y) => {
    const touch = new Touch({ identifier: 7, target: handle, clientX: cx, clientY: y });
    const list = type === 'touchend' ? [] : [touch];
    handle.dispatchEvent(new TouchEvent(type, {
      touches: list, targetTouches: list, changedTouches: [touch], bubbles: true, cancelable: true,
    }));
  };
  return true;
`;

const INSTALL_MOUSE = `
  const handle = document.querySelectorAll('.drag-handle')[0];
  const wraps = [...document.querySelectorAll('.prompt-list > div')];
  const rect = handle.getBoundingClientRect();
  window.__startY = rect.top + rect.height / 2;
  window.__handle = handle;
  window.__wraps = wraps;
  window.__fireDrag = (el, type, y) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 47, clientY: y, view: window });
    Object.defineProperty(event, 'clientY', { value: y });
    Object.defineProperty(event, 'clientX', { value: 47 });
    el.dispatchEvent(event);
  };
  return true;
`;

async function openList(driver) {
  await driver.get(PROMPT_URL);
  await waitForVisible(driver, '.prompt-list', 15000);
  await driver.sleep(400);

  const geometry = await driver.executeScript(READ_GEOMETRY);
  if (!Array.isArray(geometry.names) || geometry.names.length < 3) {
    throw new Error(`列表项不足，无法验证拖拽：${geometry.names?.length}`);
  }
  return geometry;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}：期望 ${expected}，实际 ${actual}`);
  }
}

export default {
  '触摸拖拽：让位量取被拖项节距，插入指示跟随目标且不改顺序': async () => {
    const driver = buildDriver();
    try {
      const before = await openList(driver);
      await driver.executeScript(INSTALL_TOUCH);

      // 拖过一格多一点 → 落点应为第 2 个槽位
      await driver.executeScript(`window.__fireTouch('touchstart', window.__startY); return true;`);
      await driver.executeScript(`window.__fireTouch('touchmove', window.__startY + ${before.pitch + 20}); return true;`);
      await driver.sleep(350);

      const during = await driver.executeScript(READ_GEOMETRY);
      assertEqual(during.draggingIndex, 0, '拖动项下标');
      assertEqual(during.insertIndex, 1, '插入指示位置');
      assertEqual(during.offsets[0], Math.round(before.pitch + 20), '拖动项跟手位移');
      assertEqual(during.offsets[1], -Math.round(before.pitch), '让位量（应为被拖项节距）');
      assertEqual(during.offsets[2], 0, '未越过项不应移动');
      if (!during.listDragging) {
        throw new Error('拖动中列表未进入 dragging-active 状态');
      }

      // 收尾用 touchcancel：复位且不改顺序，用例无数据副作用
      await driver.executeScript(`window.__fireTouch('touchcancel', window.__startY); return true;`);
      await driver.sleep(400);

      const after = await driver.executeScript(READ_GEOMETRY);
      assertEqual(after.offsets.join(','), before.offsets.join(','), '取消后位移应归零');
      assertEqual(after.insertIndex, -1, '取消后不应有插入指示');
      assertEqual(after.names.join(','), before.names.join(','), '取消后顺序不应变化');
    } finally {
      await driver.quit();
    }
  },

  '长列表拖到边缘时自动滚动，松手不改顺序': async () => {
    const driver = buildDriver();
    try {
      const before = await openList(driver);

      // 撑高卡片让列表超出一屏（只影响本次会话，用例结束会移除）
      await driver.executeScript(`
        const style = document.createElement('style');
        style.id = 'e2e-drag-tall';
        style.textContent = '.prompt-item { min-height: 180px !important; }';
        document.head.appendChild(style);
        return true;
      `);
      await driver.sleep(400);

      const scrollable = await driver.executeScript(`
        const scroller = document.querySelector('.page-content');
        return { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight };
      `);
      if (scrollable.scrollHeight <= scrollable.clientHeight) {
        throw new Error(`列表未超出一屏，无法验证自动滚动：${scrollable.scrollHeight}/${scrollable.clientHeight}`);
      }

      await driver.executeScript(INSTALL_TOUCH);
      await driver.executeScript(`window.__fireTouch('touchstart', window.__startY); return true;`);
      // 指针停在容器底部边缘带内，不再移动
      await driver.executeScript(`
        window.__endY = window.innerHeight - 30;
        window.__fireTouch('touchmove', window.__endY);
        return true;
      `);

      await driver.sleep(700);
      const scrolled = await driver.executeScript(`
        const scroller = document.querySelector('.page-content');
        const drag = document.querySelector('.prompt-item--dragging');
        return {
          scrollTop: Math.round(scroller.scrollTop),
          maxScroll: Math.round(scroller.scrollHeight - scroller.clientHeight),
          dragTop: drag ? Math.round(drag.getBoundingClientRect().top) : null,
        };
      `);
      if (scrolled.scrollTop <= 0) {
        throw new Error('指针停在底部边缘时列表未自动滚动');
      }

      // 再等一会儿：滚动到两端后应停下（不能因拖动项溢出而无限滚）
      await driver.sleep(900);
      const settled = await driver.executeScript(`
        const scroller = document.querySelector('.page-content');
        const drag = document.querySelector('.prompt-item--dragging');
        return {
          scrollTop: Math.round(scroller.scrollTop),
          dragTop: drag ? Math.round(drag.getBoundingClientRect().top) : null,
        };
      `);
      if (settled.scrollTop <= scrolled.scrollTop) {
        throw new Error(`自动滚动未到两端就停了：${scrolled.scrollTop} → ${settled.scrollTop}`);
      }
      // 卡片跟手：容器滚动后它在屏幕上的位置应基本不变
      if (Math.abs((settled.dragTop ?? 0) - (scrolled.dragTop ?? 0)) > 4) {
        throw new Error(`滚动补偿不对，卡片在屏幕上漂移：${scrolled.dragTop} → ${settled.dragTop}`);
      }

      // touchcancel 收尾：复位且不写数据
      await driver.executeScript(`window.__fireTouch('touchcancel', window.__endY); return true;`);
      await driver.sleep(400);
      await driver.executeScript(`document.getElementById('e2e-drag-tall')?.remove(); return true;`);

      const after = await driver.executeScript(READ_GEOMETRY);
      assertEqual(after.names.join(','), before.names.join(','), '自动滚动后顺序不应变化');
    } finally {
      await driver.quit();
    }
  },

  '鼠标拖拽：dragover 驱动让位与插入指示，拖动项不跟手': async () => {
    const driver = buildDriver();
    try {
      const before = await openList(driver);
      await driver.executeScript(INSTALL_MOUSE);

      await driver.executeScript(`window.__fireDrag(window.__handle, 'dragstart', window.__startY); return true;`);
      await driver.executeScript(`window.__fireDrag(window.__wraps[1], 'dragover', window.__startY + ${before.pitch + 20}); return true;`);
      await driver.sleep(350);

      const during = await driver.executeScript(READ_GEOMETRY);
      assertEqual(during.draggingIndex, 0, '拖动项下标');
      assertEqual(during.insertIndex, 1, '插入指示位置');
      assertEqual(during.offsets[1], -Math.round(before.pitch), '让位量（应为被拖项节距）');
      // 鼠标路径由浏览器拖影跟随，元素本身不移动
      assertEqual(during.offsets[0], 0, '鼠标拖动项不应跟手');

      // 只发 dragend（等价于拖到列表外松手）：复位且不改顺序
      await driver.executeScript(`window.__fireDrag(window.__handle, 'dragend', window.__startY); return true;`);
      await driver.sleep(400);

      const after = await driver.executeScript(READ_GEOMETRY);
      assertEqual(after.offsets.join(','), before.offsets.join(','), '结束后位移应归零');
      assertEqual(after.insertIndex, -1, '结束后不应有插入指示');
      assertEqual(after.names.join(','), before.names.join(','), '结束后顺序不应变化');
    } finally {
      await driver.quit();
    }
  },
};
