import { createRouter, createWebHistory } from 'vue-router'
import HomeLauncher from './views/HomeLauncher.vue'
import SpcFileConverter from './components/SpcFileConverter.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeLauncher },
    { path: '/spc-converter', name: 'spc-converter', component: SpcFileConverter },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
