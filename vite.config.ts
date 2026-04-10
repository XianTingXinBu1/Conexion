import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('markdown-it') || id.includes('highlight.js') || id.includes('dompurify')) {
              return 'markdown-vendor'
            }

            if (id.includes('@vue') || id.includes('vue-router') || id.includes('pinia')) {
              return 'vue-vendor'
            }

            return 'vendor'
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['conexion.venturoso.sbs'],
  },
})
