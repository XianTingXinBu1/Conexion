import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    dir: '.',
    environment: 'node',
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // 统计范围是全部 src。早前这里缩到 system-prompt 与 utils 两个目录，
      // 于是 project-status.md 记的页面覆盖率（components 26.7% → 81.2%）
      // 用 npm run test:coverage 根本跑不出来，前后数字互相无法印证。
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '*.config.ts',
        '*.config.js',
        'scripts/',
        'public/',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/*.{test,spec}.{ts,tsx,js}',
        // 进程入口：只做全局样式引入、挂载与启动失败兜底，单测无法有效覆盖。
        // 根组件 App.vue 仍留在统计内——它的 getRouteComponent 是可测逻辑，目前待补。
        'src/main.ts',
      ],
      // 覆盖率门槛：略低于当前实测（78.1 / 65.6 / 72.4 / 79.8），目的是拦住
      // 「新增代码不带测试」这种明显退步，不是要求每次提交都抬升数字。
      // 只在 --coverage 模式下生效（npm run test:coverage 与 CI），普通 vitest run 不受影响。
      thresholds: {
        statements: 77,
        branches: 64,
        functions: 71,
        lines: 78,
      },
    },

    include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    testTimeout: 10000,
    watch: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
