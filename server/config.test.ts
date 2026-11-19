import { afterEach, describe, expect, it } from 'vitest';
import { getServerConfig } from './config';

/** 这些键会污染同进程里的其它用例，每次结束都清掉 */
const NUMERIC_KEYS = ['PORT', 'UPSTREAM_TIMEOUT_MS', 'MAX_BODY_BYTES'] as const;

afterEach(() => {
  for (const key of NUMERIC_KEYS) {
    delete process.env[key];
  }
});

describe('getServerConfig', () => {
  it('未设置时回退到默认值', () => {
    const config = getServerConfig();

    expect(config.port).toBe(3900);
    expect(config.upstreamTimeoutMs).toBe(60000);
    expect(config.maxBodyBytes).toBe(1024 * 1024);
  });

  it('合法值被解析为数字', () => {
    process.env.PORT = '4123';
    process.env.UPSTREAM_TIMEOUT_MS = '5000';
    process.env.MAX_BODY_BYTES = '2048';

    const config = getServerConfig();

    expect(config.port).toBe(4123);
    expect(config.upstreamTimeoutMs).toBe(5000);
    expect(config.maxBodyBytes).toBe(2048);
  });

  it('非整数直接报错，而不是带着 NaN 继续跑', () => {
    // 以前 Number('abc') 得 NaN：port 监听失败，maxBodyBytes 比较恒为 false
    // 会让请求体大小限制静默失效
    process.env.PORT = 'abc';
    expect(() => getServerConfig()).toThrow(/PORT/);

    delete process.env.PORT;
    process.env.MAX_BODY_BYTES = '1.5';
    expect(() => getServerConfig()).toThrow(/MAX_BODY_BYTES/);
  });

  it('越界值报错', () => {
    process.env.PORT = '70000';
    expect(() => getServerConfig()).toThrow(/PORT/);

    delete process.env.PORT;
    process.env.UPSTREAM_TIMEOUT_MS = '0';
    expect(() => getServerConfig()).toThrow(/UPSTREAM_TIMEOUT_MS/);
  });

  it('空字符串按未设置处理', () => {
    process.env.PORT = '';

    expect(getServerConfig().port).toBe(3900);
  });
});
