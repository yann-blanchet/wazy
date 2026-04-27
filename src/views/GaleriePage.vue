<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()
const enhanceSession = useEnhanceSessionStore()

const photoFileInputEl = ref<HTMLInputElement | null>(null)

const photosStatus = ref<string>('')
const restaurantPhotos = ref<{ id: string; createdAt: number }[]>([])

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function restaurantPhotoItemUrl(pid: string, t?: number) {
  if (!auth.id) return ''
  const q = typeof t === 'number' && t > 0 ? `?t=${t}` : ''
  return `${apiFetchBase()}/api/public/${auth.id}/photo/${pid}${q}`
}

const viewerOpen = ref<boolean>(false)
const viewerSrc = ref<string>('')
const viewerId = ref<string>('')

function openViewer(id: string, createdAt: number) {
  viewerId.value = id
  viewerSrc.value = restaurantPhotoItemUrl(id, createdAt)
  viewerOpen.value = true
}

function closeViewer() {
  viewerOpen.value = false
  viewerSrc.value = ''
  viewerId.value = ''
}

async function deleteFromViewer() {
  if (!viewerId.value) return
  await deletePhoto(viewerId.value)
  closeViewer()
}

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'resto' } })
}

async function onPhotoPick(e: Event) {
  try {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!auth.key) throw new Error('missing_auth')

    enhanceSession.start(file, '', 'restaurant-photo', '/galerie')
    await router.push('/enhance')

    input.value = ''
  } catch (err) {
    photosStatus.value = err instanceof Error ? err.message : 'upload_error'
  }
}

function triggerPhotoPick() {
  if (!auth.isMaster) return
  photoFileInputEl.value?.click()
}

async function persistOrder() {
  if (!auth.isMaster) return
  if (!auth.key) return
  await apiFetch<{ ok: boolean }>('/api/restaurant-photos/reorder', {
    method: 'POST',
    key: auth.key,
    body: { ids: restaurantPhotos.value.map((p) => p.id) }
  })
}

async function movePhoto(from: number, to: number) {
  if (!auth.isMaster) return
  if (from < 0 || from >= restaurantPhotos.value.length) return
  if (to < 0 || to >= restaurantPhotos.value.length) return
  if (from === to) return

  const next = [...restaurantPhotos.value]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  restaurantPhotos.value = next

  try {
    photosStatus.value = 'Enregistrement…'
    await persistOrder()
    photosStatus.value = 'Ordre mis à jour.'
  } catch (err) {
    photosStatus.value = err instanceof Error ? err.message : 'reorder_error'
  }
}

async function deletePhoto(pid: string) {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    photosStatus.value = 'Suppression…'
    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/restaurant-photos?id=${encodeURIComponent(pid)}`, {
      method: 'DELETE',
      key: auth.key
    })
    restaurantPhotos.value = restaurantPhotos.value.filter((x) => x.id !== pid)
    photosStatus.value = 'Supprimé.'
  } catch (err) {
    photosStatus.value = err instanceof Error ? err.message : 'delete_error'
  }
}

onMounted(async () => {
  try {
    if (!auth.id) return
    const pub = await apiFetch<{ photos?: { id: string; createdAt: number }[] }>(`/api/public/${auth.id}`, {
      method: 'GET'
    })
    restaurantPhotos.value = Array.isArray(pub.photos) ? pub.photos : []
  } catch (e) {
    photosStatus.value = e instanceof Error ? e.message : 'load_error'
  }
})
</script>

<template>
  <main class="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden">
    <div class="sticky top-0 z-[60] px-6 pt-4 backdrop-blur">
      <div class="flex items-center justify-between">
        <div class="text-2xl font-semibold">Galerie</div>
        <div class="w-12" />
        <button class="text-sm text-secondary underline" type="button" @click="goBack">Retour</button>
      </div>
    </div>

    <section class="px-2">
      <div class="rounded-2xl p-5">
        <p class="mt-1 text-sm text-primary/70">Ajoutez des photos de votre restaurant (vitrine, salle, plats…).</p>
      </div>
    </section>

    <section class="flex-1 overflow-y-auto px-6 pb-32 pt-4">
      <div v-if="restaurantPhotos.length === 0" class="rounded-xl bg-black/10 p-4 text-sm text-primary/70">
        Aucune photo pour le moment.
      </div>
      <div v-else class="grid grid-cols-1 gap-3">
        <div v-for="(p, idx) in restaurantPhotos" :key="p.id" class="relative overflow-hidden rounded-2xl bg-black/10">
            <div class="aspect-[4/5] overflow-hidden">
              <button class="block h-full w-full" type="button" @click="openViewer(p.id, p.createdAt)">
                <img class="h-full w-full object-cover" :src="restaurantPhotoItemUrl(p.id, p.createdAt)" :alt="p.id" />
              </button>
            </div>

            <div v-if="auth.isMaster" class="absolute bottom-2 left-2 flex flex-col gap-2">
              <button
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg shadow-black/30 ring-1 ring-black/10 hover:bg-black/70"
                type="button"
                aria-label="Monter"
                title="Monter"
                :disabled="idx === 0"
                :class="idx === 0 ? 'opacity-40' : ''"
                @click.stop="movePhoto(idx, idx - 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                  <path d="M12 19V5" />
                  <path d="M5 12l7-7 7 7" />
                </svg>
              </button>

              <button
                class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-lg shadow-black/30 ring-1 ring-black/10 hover:bg-black/70"
                type="button"
                aria-label="Descendre"
                title="Descendre"
                :disabled="idx === restaurantPhotos.length - 1"
                :class="idx === restaurantPhotos.length - 1 ? 'opacity-40' : ''"
                @click.stop="movePhoto(idx, idx + 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                  <path d="M12 5v14" />
                  <path d="M5 12l7 7 7-7" />
                </svg>
              </button>
            </div>

            <button
              v-if="auth.isMaster"
              class="absolute bottom-2 right-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg shadow-black/30 ring-1 ring-black/10 hover:bg-red-600"
              type="button"
              aria-label="Supprimer"
              title="Supprimer"
              @click.stop="deletePhoto(p.id)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
      </div>

      <div class="mt-4 grid gap-3">
        <div v-if="photosStatus" class="text-sm text-primary/70">{{ photosStatus }}</div>
      </div>
    </section>

    <input ref="photoFileInputEl" class="sr-only" type="file" accept="image/*" @change="onPhotoPick" />

    <div
      class="fixed inset-x-0 bottom-0 z-[80] border-t border-black/10 px-4 py-3 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 12px)"
    >
      <div class="mx-auto max-w-lg">
        <button
          class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20 hover:bg-primary/90"
          type="button"
          @click="triggerPhotoPick"
        >
          Ajouter une photo
        </button>
      </div>
    </div>

    <div v-if="viewerOpen" class="fixed inset-0 z-[90] bg-black">
      <button class="absolute inset-0" type="button" @click="closeViewer" aria-label="Fermer" />
      <div class="absolute inset-0 grid place-items-center">
        <img v-if="viewerSrc" class="max-h-full max-w-full object-contain" :src="viewerSrc" alt="" />
      </div>

      <div
        class="absolute inset-x-0 bottom-0 border-t border-black/10 bg-background/95 px-5 py-4 backdrop-blur"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="mx-auto grid max-w-lg grid-cols-2 gap-3">
          <button
            class="rounded-xl bg-black/10 px-4 py-3 text-sm text-primary hover:bg-black/15"
            :disabled="!auth.isMaster"
            type="button"
            @click="deleteFromViewer"
          >
            Supprimer
          </button>
          <button class="rounded-xl bg-black/10 px-4 py-3 text-sm text-primary hover:bg-black/15" type="button" @click="closeViewer">
            Fermer
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
