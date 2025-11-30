import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import components from 'unplugin-vue-components/vite'
import autoImport from 'unplugin-auto-import/vite'
import { VarletImportResolver } from '@varlet/import-resolver'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    components({
      resolvers: [VarletImportResolver(),ElementPlusResolver()],
    }),
    autoImport({
      resolvers: [VarletImportResolver({ autoImport: true }),ElementPlusResolver()],
    })
  ],
})
