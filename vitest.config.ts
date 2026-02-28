import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    // 测试环境
    environment: 'happy-dom',

    // 全局配置
    globals: true,

    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '*.config.ts',
        '*.config.js',
        'scripts/',
        'public/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },

    // 包含的测试文件
    include: ['**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      '**/example.test.ts',
      '**/validate.test.ts',
    ],

    // 测试超时时间（毫秒）
    testTimeout: 10000,

    // 并发数
    threads: true,

    // 监听模式
    watch: false,
  },

  // 路径别名
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});