<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import {
  flushUploadQueue,
  todayISO,
  removeQueuedByDate,
  uploadQueueCount
} from '../lib/uploadQueue'
import { apiFetch } from '../lib/api'

const route = useRoute()
const router = useRouter()

const auth = useAuthStore()
const enhanceSession = useEnhanceSessionStore()
const status = ref<string>('')
const queued = ref<number>(0)
const previewUrl = ref<string>('')

async function go(path: string) {
  await router.push(path)
}

async function logout() {
  auth.logout()
  await router.push('/login')
}
const selectedDate = ref<string>(todayISO())
const serverPreviewUrl = ref<string>('')
const serverPreviewState = ref<'idle' | 'loading' | 'loaded' | 'missing'>('idle')

const restaurantName = ref<string>('')
const restaurantAddress = ref<string>('')
const restaurantCity = ref<string>('')
const restaurantCuisineType = ref<string>('')

type MenuItem = { date: string; createdAt: number }
const menus = ref<MenuItem[]>([])

const cameraInputEl = ref<HTMLInputElement | null>(null)

function triggerCamera() {
  cameraInputEl.value?.click()
}

const activeTab = ref<'menu' | 'resto' | 'compte'>('menu')
const isEmployee = computed(() => auth.role === 'worker')

onMounted(() => {
  const q = route.query.tab
  if (q === 'menu' || q === 'resto' || q === 'compte') activeTab.value = q
  if (isEmployee.value) activeTab.value = 'menu'
})

watch(
  () => route.query.tab,
  (q) => {
    if (q === 'menu' || q === 'resto' || q === 'compte') activeTab.value = q
    if (isEmployee.value) activeTab.value = 'menu'
  }
)

watch(
  activeTab,
  async (tab) => {
    if (route.path !== '/dashboard') return
    if (route.query.tab === tab) return
    await router.replace({ path: '/dashboard', query: { ...route.query, tab } })
  },
  { flush: 'post' }
)

const viewerOpen = ref<boolean>(false)
const viewerUrl = ref<string>('')

function openViewer(url: string) {
  if (!url) return
  viewerUrl.value = url
  viewerOpen.value = true
}

function closeViewer() {
  viewerOpen.value = false
  viewerUrl.value = ''
}

async function refreshQueued() {
  queued.value = await uploadQueueCount()
}

async function flush() {
  try {
    await flushUploadQueue({
      onStatus: (s) => (status.value = s)
    })
  } finally {
    await refreshQueued()
  }
}

onMounted(async () => {
  await refreshQueued()
  if (navigator.onLine) await flush()

  try {
    if (auth.key) {
      const res = await apiFetch<{ restaurant: { name: string; address: string; city?: string; cuisineType?: string } }>('/api/restaurant', {
        method: 'GET',
        key: auth.key
      })
      restaurantName.value = res.restaurant.name ?? ''
      restaurantAddress.value = res.restaurant.address ?? ''
      restaurantCity.value = res.restaurant.city ?? ''
      restaurantCuisineType.value = res.restaurant.cuisineType ?? ''
    }
  } catch {
    restaurantName.value = ''
    restaurantAddress.value = ''
    restaurantCity.value = ''
    restaurantCuisineType.value = ''
  }

  try {
    if (auth.key) {
      const res = await apiFetch<{ id: string; menus: MenuItem[] }>('/api/menus', {
        method: 'GET',
        key: auth.key
      })
      menus.value = Array.isArray(res.menus) ? res.menus : []
    }
  } catch {
    menus.value = []
  }

  refreshServerPreview()
})

function formatUpdatedAt(ts: number) {
  const d = new Date(ts)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatRelativeUpdatedAt(ts: number) {
  const now = Date.now()
  const diffMs = Math.max(0, now - ts)
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "à l'instant"

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`

  const diffD = Math.floor(diffH / 24)
  if (diffD <= 7) return `il y a ${diffD} j`

  return formatUpdatedAt(ts)
}

const selectedMenu = computed(() => menus.value.find((m) => m.date === selectedDate.value) ?? null)
const lastUpdatedText = computed(() => (selectedMenu.value ? formatRelativeUpdatedAt(selectedMenu.value.createdAt) : '—'))

const activeTabTitle = computed(() => {
  if (activeTab.value === 'menu') return 'Menu du jour'
  if (activeTab.value === 'resto') return 'Mon resto'
  return 'Compte'
})

const quickHistoryDates = computed(() => {
  return menus.value
    .map((m) => m.date)
    .filter((d) => d !== selectedDate.value)
    .slice(0, 3)
})

function apiBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function refreshServerPreview() {
  serverPreviewState.value = 'loading'
  if (!auth.id || !selectedDate.value) {
    serverPreviewUrl.value = ''
    serverPreviewState.value = 'idle'
    return
  }
  // cache-bust so newly uploaded images refresh immediately
  serverPreviewUrl.value = `${apiBase()}/api/public/${auth.id}/menu/${selectedDate.value}?t=${Date.now()}`
}

async function deleteMenuForDate() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    status.value = 'Deleting…'

    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/menu?date=${encodeURIComponent(selectedDate.value)}`,
      {
        method: 'DELETE',
        key: auth.key
      }
    )

    await removeQueuedByDate(selectedDate.value)
    await refreshQueued()

    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }

    refreshServerPreview()

    menus.value = menus.value.filter((m) => m.date !== selectedDate.value)

    status.value = 'Deleted.'
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'delete_error'
  }
}

async function onTakePhotoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  enhanceSession.start(file, selectedDate.value)
  await router.push('/enhance')

  input.value = ''
}
</script>

<template>
  <main class="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">{{ activeTabTitle }}</h1>

      <div class="ml-4 truncate text-sm font-semibold text-secondary">{{ restaurantName || auth.id || '—' }}</div>
    </div>

    <div class="mt-6 flex flex-1 flex-col overflow-hidden">
      <div v-if="activeTab === 'menu'" class="flex flex-1 flex-col overflow-hidden pb-24">
        <div class="flex flex-1 min-h-0 flex-col gap-2 ">
          <div class="flex items-center justify-end gap-3">
            <div class="text-xs text-secondary/80">{{ lastUpdatedText }}</div>
          </div>

          <div class="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/10">
            <img
              v-if="serverPreviewUrl"
              v-show="serverPreviewState === 'loaded'"
              class="h-full w-full object-contain"
              :src="serverPreviewUrl"
              alt="Photo du menu existant"
              @load="serverPreviewState = 'loaded'"
              @error="serverPreviewState = 'missing'"
              @click="openViewer(serverPreviewUrl)"
            />
            <div v-if="!serverPreviewUrl || serverPreviewState === 'loading'" class="flex flex-1 items-center justify-center p-4 text-sm text-primary/70">
              {{ serverPreviewUrl ? 'Chargement…' : "Pas de menu pour aujourd'hui." }}
            </div>
            <div v-else-if="serverPreviewState === 'missing'" class="flex flex-1 items-center justify-center p-4 text-sm text-primary/70">
              Pas de menu pour aujourd'hui.
            </div>
          </div>

          <div class="mt-auto pt-2">
            <button
              class="w-full rounded-xl bg-cta px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20 hover:bg-cta/90"
              type="button"
              @click="selectedMenu ? deleteMenuForDate() : triggerCamera()"
            >
              {{ selectedMenu ? 'Dépublier le menu du jour' : 'Publier le menu du jour' }}
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'resto'" class="grid gap-2 overflow-y-auto pb-24">
        
        <button class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary " type="button" @click="go('/history')">
          <span>Voir tous les menus du jour</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="go('/infos')">
          <span>Infos</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="go('/carte')">
          <span>Carte</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="go('/galerie')">
          <span>Galerie</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="go('/lien-public')">
          <span>Lien public</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div v-else class="grid gap-2 overflow-y-auto pb-24">
        
        <button
          v-if="auth.isMaster"
          class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary hover:bg-black/10"
          type="button"
          @click="go('/qr-access')"
        >
          <span>Accès QR</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl  px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="go('/stats')">
          <span>Stats</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl     px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="logout">
          <span>Déconnexion</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-primary/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div v-if="previewUrl" class="hidden overflow-hidden rounded-2xl bg-black/10">
        <img class="w-full object-cover" :src="previewUrl" alt="Selected menu photo" @click="openViewer(previewUrl)" />
      </div>

    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-[70] border-t border-black/10 bg-background/95 px-4 py-3 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 12px)"
    >
      <div class="mx-auto grid max-w-lg gap-3" :class="isEmployee ? 'grid-cols-1' : 'grid-cols-3'">
        <button
          class="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold"
          :class="activeTab === 'menu' ? 'bg-cta text-background shadow-lg shadow-black/20' : ' text-primary'"
          type="button"
          @click="activeTab = 'menu'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M8 3h8" />
            <path d="M6 7h12" />
            <path d="M6 7v14h12V7" />
            <path d="M10 11h4" />
            <path d="M10 15h4" />
          </svg>
          <span>Menu du jour</span>
        </button>
        <button
          v-if="!isEmployee"
          class="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold"
          :class="activeTab === 'resto' ? 'bg-cta text-background shadow-lg shadow-black/20' : ' text-primary'"
          type="button"
          @click="activeTab = 'resto'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M3 10l9-7 9 7" />
            <path d="M5 10v10h14V10" />
            <path d="M9 20v-6h6v6" />
          </svg>
          <span>Mon resto</span>
        </button>
        <button
          v-if="!isEmployee"
          class="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold"
          :class="activeTab === 'compte' ? 'bg-cta text-background shadow-lg shadow-black/20' : ' text-primary'"
          type="button"
          @click="activeTab = 'compte'"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          </svg>
          <span>Compte</span>
        </button>
      </div>
    </div>

    <input
      ref="cameraInputEl"
      class="sr-only"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onTakePhotoChange"
    />

    <div v-if="viewerOpen" class="fixed inset-0 z-[90] bg-black">
      <img class="absolute inset-0 h-full w-full object-contain" :src="viewerUrl" alt="Full screen menu" />

      <button
        class="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/10 backdrop-blur hover:bg-black/50"
        type="button"
        aria-label="Fermer"
        title="Fermer"
        @click="closeViewer"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </div>

  </main>
</template>
