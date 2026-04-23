import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './router'
import App from './App.vue'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { useAuthStore } from './stores/auth'
import { flushUploadQueue } from './lib/uploadQueue'

registerSW({ immediate: true })

const router = createRouter({
  history: createWebHistory(),
  routes
})

const pinia = createPinia()

router.beforeEach((to) => {
  if (
    to.path === '/dashboard' ||
    to.path === '/infos' ||
    to.path === '/carte' ||
    to.path === '/galerie' ||
    to.path === '/lien-public' ||
    to.path === '/equipe' ||
    to.path === '/stats' ||
    to.path === '/logout' ||
    to.path === '/settings' ||
    to.path === '/history' ||
    to.path === '/enhance' ||
    to.path === '/onboarding'
  ) {
    const auth = useAuthStore(pinia)
    if (!auth.isAuthed) return { path: '/login' }
  }
  return true
})

window.addEventListener('online', async () => {
  try {
    await flushUploadQueue()
  } catch {
    // ignore
  }
})

createApp(App).use(pinia).use(router).mount('#app')
