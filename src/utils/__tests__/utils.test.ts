/**
 * 工具函数测试示例
 */

import { describe, it, expect } from 'vitest';

describe('工具函数测试', () => {
  it('应该通过示例测试', () => {
    expect(1 + 1).toBe(2);
  });

  it('应该验证字符串相等', () => {
    const str = 'hello';
    expect(str).toBe('hello');
  });

  it('应该验证数组长度', () => {
    const arr = [1, 2, 3];
    expect(arr.length).toBe(3);
  });
});