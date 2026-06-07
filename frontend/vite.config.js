import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

const cdnBase = (process.env.VITE_CDN_BASE_URL || '').trim()

export default defineConfig({
  base: cdnBase ? './' : '/',
  plugins: [
    vue(),
    ui({
      components: {
        prefix: 'U'
      }
    })
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: !!cdnBase,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router')) {
            return 'vue-vendor'
          }
          if (id.includes('node_modules/@nuxt/ui') || id.includes('node_modules/reka-ui') || id.includes('node_modules/@vueuse')) {
            return 'ui-vendor'
          }
          if (id.includes('node_modules/pdfjs-dist')) {
            return 'pdf-vendor'
          }
          if (id.includes('node_modules/heic2any')) {
            return 'heic-vendor'
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true
      }
    }
  }
})
