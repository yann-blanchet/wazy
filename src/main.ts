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

let handlingInvalidAuth = false
window.addEventListener('auth:invalid', async () => {
  if (handlingInvalidAuth) return
  handlingInvalidAuth = true
  try {
    const auth = useAuthStore(pinia)
    auth.logout()

    if (router.currentRoute.value.path !== '/login' && router.currentRoute.value.path !== '/' && router.currentRoute.value.path !== '/auth') {
      await router.replace('/login')
    }
  } finally {
    handlingInvalidAuth = false
  }
})

router.beforeEach((to) => {
  if (to.path === '/' || to.path === '/login') {
    const auth = useAuthStore(pinia)
    if (auth.isAuthed) return { path: '/dashboard' }
  }

  if (to.path === '/auth') {
    return true
  }

  if (
    to.path === '/dashboard' ||
    to.path === '/codes-acces' ||
    to.path === '/infos' ||
    to.path === '/carte' ||
    to.path === '/galerie' ||
    to.path === '/lien-public' ||
    to.path === '/stats' ||
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
