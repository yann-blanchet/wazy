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

const menuMode = ref<'menu' | 'event'>('menu')

type EventItem = { date: string; createdAt: number }
const eventItem = ref<EventItem | null>(null)
const eventDate = ref<string>(todayISO())
const eventPreviewUrl = ref<string>('')
const eventPreviewState = ref<'idle' | 'loading' | 'loaded' | 'missing'>('idle')

const restaurantName = ref<string>('')
const restaurantAddress = ref<string>('')
const restaurantCity = ref<string>('')
const restaurantCuisineType = ref<string>('')

type MenuItem = { date: string; createdAt: number }
const menus = ref<MenuItem[]>([])

const cameraInputEl = ref<HTMLInputElement | null>(null)

const takePhotoTarget = ref<'menu' | 'event'>('menu')

function triggerCamera(target: 'menu' | 'event' = 'menu') {
  takePhotoTarget.value = target
  cameraInputEl.value?.click()
}

const activeTab = ref<'menu' | 'resto'>('menu')
const isEmployee = computed(() => auth.role === 'worker')

onMounted(() => {
  const q = route.query.tab
  if (q === 'menu' || q === 'resto') activeTab.value = q
  if (isEmployee.value) activeTab.value = 'menu'
})

watch(
  () => route.query.tab,
  (q) => {
    if (q === 'menu' || q === 'resto') activeTab.value = q
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

  try {
    if (auth.key) {
      const res = await apiFetch<{ id: string; event: EventItem | null }>('/api/event', {
        method: 'GET',
        key: auth.key
      })
      eventItem.value = res.event
      if (res.event?.date) eventDate.value = res.event.date
    }
  } catch {
    eventItem.value = null
  }

  refreshServerPreview()
  refreshEventPreview()
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

function formatDayMonth(iso: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}`
}

const selectedMenu = computed(() => menus.value.find((m) => m.date === selectedDate.value) ?? null)
const lastUpdatedText = computed(() => (selectedMenu.value ? formatRelativeUpdatedAt(selectedMenu.value.createdAt) : '—'))
const lastUpdatedEventText = computed(() => (eventItem.value ? formatRelativeUpdatedAt(eventItem.value.createdAt) : '—'))
const todayDateText = computed(() => formatDayMonth(todayISO()))

const activeTabTitle = computed(() => {
  if (activeTab.value === 'menu') return menuMode.value === 'event' ? 'Événement' : 'Menu du jour'
  if (activeTab.value === 'resto') return 'Mon resto'
  return 'Mon resto'
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

function refreshEventPreview() {
  eventPreviewState.value = 'loading'
  if (!auth.id) {
    eventPreviewUrl.value = ''
    eventPreviewState.value = 'idle'
    return
  }
  eventPreviewUrl.value = `${apiBase()}/api/public/${auth.id}/event?t=${Date.now()}`
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

async function deleteEvent() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    status.value = 'Deleting…'

    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/event`, {
      method: 'DELETE',
      key: auth.key
    })

    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }

    eventItem.value = null
    refreshEventPreview()
    status.value = 'Deleted.'
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'delete_error'
  }
}

async function onTakePhotoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (takePhotoTarget.value === 'event') {
    enhanceSession.start(file, eventDate.value, 'event', '/dashboard?tab=menu')
  } else {
    enhanceSession.start(file, selectedDate.value, 'menu', '/dashboard?tab=menu')
  }
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
          <div v-if="menuMode === 'event'" class="grid gap-2">
            <label class="grid gap-2">
              <span class="text-sm text-primary/70">Date</span>
              <input
                v-model="eventDate"
                class="rounded-xl bg-black/5 px-3 py-3 text-sm text-primary outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-primary"
                type="date"
              />
            </label>

            <div class="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/10">
              <img
                v-if="eventItem"
                v-show="eventPreviewState === 'loaded'"
                class="h-full w-full object-contain"
                :src="eventPreviewUrl"
                alt="Photo de l'événement"
                @load="eventPreviewState = 'loaded'"
                @error="eventPreviewState = 'missing'"
                @click="openViewer(eventPreviewUrl)"
              />
              <div v-if="!eventItem || eventPreviewState === 'loading'" class="flex flex-1 items-center justify-center p-4 text-sm text-primary/70">
                {{ eventItem ? 'Chargement…' : "Pas d'événement." }}
              </div>
              <div v-else-if="eventPreviewState === 'missing'" class="flex flex-1 items-center justify-center p-4 text-sm text-primary/70">
                Pas d'événement.
              </div>
            </div>

            <div class="flex items-center justify-end gap-3">
              <div class="text-xs text-secondary/80">{{ lastUpdatedEventText }}</div>
            </div>

            <div class="mt-auto flex justify-center pt-2">
              <button
                class="inline-flex items-center justify-center rounded-full bg-cta px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20 hover:bg-cta/90"
                type="button"
                @click="eventItem ? deleteEvent() : triggerCamera('event')"
                :aria-label="eventItem ? 'Supprimer l\'événement' : 'Ajouter un événement'"
                :title="eventItem ? 'Supprimer l\'événement' : 'Ajouter un événement'"
              >
                <svg
                  v-if="!eventItem"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-5 w-5"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-5 w-5"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          </div>

          <div v-else class="flex flex-1 min-h-0 flex-col gap-2">
          <div class="flex items-baseline justify-between">
            <div class="text-sm font-semibold text-primary">
              Aujourd'hui <span class="text-xs font-medium text-primary/70">{{ todayDateText }}</span>
            </div>
          </div>
          <div class="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/10">
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

          <div class="flex items-center justify-end gap-3">
            <div class="text-xs text-secondary/80">{{ lastUpdatedText }}</div>
          </div>

          <div class="mt-auto flex justify-center pt-2">
            <button
              class="inline-flex items-center justify-center rounded-full bg-cta px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20 hover:bg-cta/90"
              type="button"
              @click="selectedMenu ? deleteMenuForDate() : triggerCamera()"
              :aria-label="selectedMenu ? 'Dépublier le menu du jour' : 'Publier le menu du jour'"
              :title="selectedMenu ? 'Dépublier le menu du jour' : 'Publier le menu du jour'"
            >
              <svg
                v-if="!selectedMenu"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-5 w-5"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-5 w-5"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
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

        <button class="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-primary hover:bg-black/10" type="button" @click="logout">
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
      <div class="mx-auto grid max-w-lg gap-3" :class="isEmployee ? 'grid-cols-2' : 'grid-cols-3'">
        <button
          class="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold"
          :class="activeTab === 'menu' && menuMode === 'menu' ? 'bg-cta text-background shadow-lg shadow-black/20' : ' text-primary'"
          type="button"
          @click="(activeTab = 'menu'), (menuMode = 'menu')"
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
          class="flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold"
          :class="activeTab === 'menu' && menuMode === 'event' ? 'bg-cta text-background shadow-lg shadow-black/20' : ' text-primary'"
          type="button"
          @click="(activeTab = 'menu'), (menuMode = 'event')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M6 2v4" />
            <path d="M18 2v4" />
            <path d="M3 8h18" />
            <path d="M4 6h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
            <path d="M8 12h8" />
            <path d="M8 16h6" />
          </svg>
          <span>Événement</span>
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
