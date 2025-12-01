import { createApp } from 'vue'
import Varlet from '@varlet/ui'
import ElementPlus from 'element-plus'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import './style.css'
import '@varlet/ui/es/style'
import '@varlet/touch-emulator'
import 'element-plus/dist/index.css'

const app = createApp(App)
app.use(Varlet)
app.use(ElementPlus)
app.use(i18n)
app.use(router)
app.mount('#app')
