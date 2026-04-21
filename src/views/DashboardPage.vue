<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
const selectedDate = ref<string>(todayISO())
const serverPreviewUrl = ref<string>('')
const serverPreviewState = ref<'idle' | 'loading' | 'loaded' | 'missing'>('idle')

const restaurantName = ref<string>('')
const restaurantAddress = ref<string>('')
const restaurantCity = ref<string>('')
const restaurantCuisineType = ref<string>('')

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

  refreshServerPreview()
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
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">WAZY</h1>
      <button
        class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 text-bordeaux hover:bg-black/15"
        type="button"
        aria-label="Historique"
        title="Historique"
        @click="router.push('/history')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
          <path d="M7 3v3" />
          <path d="M17 3v3" />
          <path d="M4 7h16" />
          <path d="M6 6h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2z" />
          <path d="M8 11h4" />
          <path d="M8 15h6" />
        </svg>
      </button>
    </div>

    <div class="mt-6 grid gap-4">

      <div class="grid gap-1 rounded-xl bg-black/5 p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="grid gap-1">
            <div class="text-xs uppercase tracking-wide text-bordeaux/70">Restaurant</div>
            <div class="text-sm font-medium text-bordeaux">{{ restaurantName || auth.id || '—' }}</div>
          </div>
          <div class="grid justify-items-end gap-1 text-right">
            <div class="text-xs uppercase tracking-wide text-bordeaux/70">Aujourdh'hui</div>
            <div class="font-mono text-sm text-bordeaux">{{ selectedDate }}</div>
          </div>
        </div>
      </div>

      <div v-if="serverPreviewUrl" class="overflow-hidden rounded-2xl bg-black/10">
        <img
          v-show="serverPreviewState === 'loaded'"
          class="w-full object-cover"
          :src="serverPreviewUrl"
          alt="Existing menu photo"
          @load="serverPreviewState = 'loaded'"
          @error="serverPreviewState = 'missing'"
          @click="openViewer(serverPreviewUrl)"
        />
        <div v-if="serverPreviewState === 'loading'" class="p-4 text-sm text-bordeaux/70">Loading…</div>
        <div v-else-if="serverPreviewState === 'missing'" class="p-4 text-sm text-bordeaux/70">
          Pas de menu pour aujourd'hui, cliquez sur l'icône caméra pour en prendre un.
        </div>
      </div>

      <div v-if="previewUrl" class="overflow-hidden rounded-2xl bg-black/10">
        <img class="w-full object-cover" :src="previewUrl" alt="Selected menu photo" @click="openViewer(previewUrl)" />
      </div>

      
    </div>

    <label class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
      <input
        class="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        @change="onTakePhotoChange"
      />
      <span
        class="flex h-16 w-16 items-center justify-center rounded-full bg-bordeaux text-beige shadow-lg shadow-black/30 ring-1 ring-black/10 hover:bg-bordeaux/90"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-7 w-7">
          <path
            d="M9 7l1.2-2.1c.2-.5.7-.9 1.3-.9h1c.6 0 1.1.4 1.3.9L15 7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M6 7h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </label>

    <div v-if="viewerOpen" class="fixed inset-0 z-[70] bg-black">
      <img class="absolute inset-0 h-full w-full object-contain" :src="viewerUrl" alt="Full screen menu" />

      <div
        class="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-black/10 bg-beige/95 px-5 py-4 backdrop-blur"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <button class="rounded-full bg-black/10 px-4 py-2 text-sm text-bordeaux" @click="closeViewer">
          Close
        </button>

        <button class="rounded-full bg-rose-500/20 px-4 py-2 text-sm text-rose-950" @click="deleteMenuForDate(); closeViewer()">
          Delete
        </button>
      </div>
    </div>

  </main>
</template>
