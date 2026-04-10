import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const VENDOR_CHUNKS: Array<[string, string[]]> = [
  ['markdown-vendor', ['marked', 'markdown-it', 'highlight.js', 'dompurify']],
  ['vue-vendor', ['@vue', 'vue-router', 'pinia']],
  ['icons-vendor', ['lucide-vue-next']],
  ['storage-vendor', ['idb-keyval']],
  ['tokenizer-vendor', ['gpt-tokenizer']],
]

function resolveVendorChunk(id: string) {
  for (const [chunkName, packages] of VENDOR_CHUNKS) {
    if (packages.some((pkg) => id.includes(pkg))) {
      return chunkName
    }
  }

  return 'vendor'
}

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
            return resolveVendorChunk(id)
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
