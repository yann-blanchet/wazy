<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import {
  flushUploadQueue,
  todayISO,
  removeQueuedByDate,
  uploadQueueCount
} from '../lib/uploadQueue'
import { apiFetch } from '../lib/api'

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
  <main class="mx-auto flex min-h-dvh max-w-lg flex-col p-6 pb-28">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">WAZY</h1>

      <div class="ml-4 truncate text-sm font-semibold text-bordeaux">{{ restaurantName || auth.id || '—' }}</div>
    </div>

    <div class="mt-6 grid gap-4">
      <div class="flex flex-col gap-2 rounded-xl bg-black/5 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-xs uppercase tracking-wide text-bordeaux/70">Menu du jour</div>
          <div class="text-xs text-bordeaux/70">Dernière mise à jour: {{ lastUpdatedText }}</div>
        </div>

        <div class="flex overflow-hidden rounded-2xl bg-black/10">
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
          <div v-if="!serverPreviewUrl || serverPreviewState === 'loading'" class="flex flex-1 items-center justify-center p-4 text-sm text-bordeaux/70">
            {{ serverPreviewUrl ? 'Chargement…' : "Pas de menu pour aujourd'hui." }}
          </div>
          <div v-else-if="serverPreviewState === 'missing'" class="flex flex-1 items-center justify-center p-4 text-sm text-bordeaux/70">
            Pas de menu pour aujourd'hui.
          </div>
        </div>

        <div class="mt-auto grid grid-cols-1 items-center pt-2">
          
          <button
            class="justify-self-center rounded-lg bg-bordeaux px-4 py-2 text-xs font-medium text-beige hover:bg-bordeaux/90"
            type="button"
            @click="triggerCamera"
          >
            Ajouter un menu du jour
          </button>
          
        </div>
      </div>

      <div class="grid gap-2">
        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/history')">
          <span>Voir tous les menus du jour</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/infos')">
          <span>Infos</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/carte')">
          <span>Carte</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/galerie')">
          <span>Galerie</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/lien-public')">
          <span>Lien public</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/equipe')">
          <span>Équipe</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/stats')">
          <span>Stats</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <button class="flex w-full items-center justify-between rounded-xl bg-black/10 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/15" type="button" @click="logout">
          <span>Déconnexion</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 text-bordeaux/60">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div v-if="previewUrl" class="hidden overflow-hidden rounded-2xl bg-black/10">
        <img class="w-full object-cover" :src="previewUrl" alt="Selected menu photo" @click="openViewer(previewUrl)" />
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

    <div v-if="viewerOpen" class="fixed inset-0 z-[70] bg-black">
      <img class="absolute inset-0 h-full w-full object-contain" :src="viewerUrl" alt="Full screen menu" />

      <div
        class="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-black/10 bg-beige/95 px-5 py-4 backdrop-blur"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <button class="rounded-full bg-black/10 px-4 py-2 text-sm text-bordeaux" @click="closeViewer">
          Fermer
        </button>

        <button class="rounded-full bg-rose-500/20 px-4 py-2 text-sm text-rose-950" @click="deleteMenuForDate(); closeViewer()">
          Supprimer
        </button>
      </div>
    </div>

  </main>
</template>
