import { createRouter, createWebHistory } from 'vue-router'
import HomeLauncher from './views/HomeLauncher.vue'
import SpdFileConverter from './components/SpdFileConverter.vue'
import FlImageProcessor from './views/FlImageProcessor.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeLauncher },
    { path: '/spd-converter', name: 'spd-converter', component: SpdFileConverter },
    { path: '/fl-image-processor', name: 'fl-image-processor', component: FlImageProcessor },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
