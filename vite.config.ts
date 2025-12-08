import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import components from 'unplugin-vue-components/vite'
import autoImport from 'unplugin-auto-import/vite'
import { VarletImportResolver } from '@varlet/import-resolver'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    components({
      resolvers: [VarletImportResolver(),ElementPlusResolver()],
    }),
    autoImport({
      resolvers: [VarletImportResolver({ autoImport: true }),ElementPlusResolver()],
    }),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'echarts': ['echarts'],
          'opencv': ['@techstark/opencv-js'],
          'vendor': ['vue', 'vue-router', 'vue-i18n', '@varlet/ui'],
          'ui-extra': ['element-plus', '@element-plus/icons-vue'],
        }
      }
    },
    minify: 'terser',
    terserOptions: ({ 
      compress: {
        drop_console: true
      }
    } as any)
  },
  server: {
    middlewareMode: false,
  },
})
