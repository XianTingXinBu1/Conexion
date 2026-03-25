import { defineConfig, configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    dir: 'src',
    environment: 'node',
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/modules/system-prompt/**/*.ts', 'src/utils/**/*.ts'],
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
      ],
    },

    include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    exclude: [...configDefaults.exclude],
    testTimeout: 10000,
    watch: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
