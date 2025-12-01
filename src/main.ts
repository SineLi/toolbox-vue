import { createApp } from 'vue'
import Varlet from '@varlet/ui'
import ElementPlus from 'element-plus'
import App from './App.vue'
import router from './router'
import './style.css'
// import '@varlet/ui/es/style.js'
import 'element-plus/dist/index.css'

const app = createApp(App)
app.use(Varlet)
app.use(ElementPlus)
app.use(router)
app.mount('#app')
