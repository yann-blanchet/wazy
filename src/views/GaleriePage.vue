<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()
const enhanceSession = useEnhanceSessionStore()

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
  if (window.history.length > 1) router.back()
  else await router.push('/dashboard')
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
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <button class="text-sm text-bordeaux/70 underline" type="button" @click="goBack">Retour</button>
      <div class="text-2xl font-semibold">Galerie</div>
      <div class="w-12" />
    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Galerie</h2>
      </div>
      <p class="mt-1 text-sm text-bordeaux/70">Ajoutez des photos de votre restaurant (vitrine, salle, plats…).</p>

      <div class="mt-4">
        <div v-if="restaurantPhotos.length === 0" class="rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
          Aucune photo pour le moment.
        </div>
        <div v-else class="grid grid-cols-1 gap-3">
          <div v-for="p in restaurantPhotos" :key="p.id" class="overflow-hidden rounded-2xl bg-black/10">
            <div class="aspect-[4/5] overflow-hidden">
              <button class="block h-full w-full" type="button" @click="openViewer(p.id, p.createdAt)">
                <img class="h-full w-full object-cover" :src="restaurantPhotoItemUrl(p.id, p.createdAt)" :alt="p.id" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <div v-if="photosStatus" class="text-sm text-bordeaux/70">{{ photosStatus }}</div>
      </div>
    </section>

    <label class="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2">
      <input class="hidden" type="file" accept="image/*" @change="onPhotoPick" />
      <span
        class="flex h-16 w-16 items-center justify-center rounded-full bg-bordeaux text-beige shadow-lg shadow-black/30 ring-1 ring-black/10 hover:bg-bordeaux/90"
        :class="!auth.isMaster ? 'pointer-events-none opacity-60' : ''"
        title="Ajouter une photo"
        aria-label="Ajouter une photo"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </span>
    </label>

    <div v-if="viewerOpen" class="fixed inset-0 z-[90] bg-black">
      <button class="absolute inset-0" type="button" @click="closeViewer" aria-label="Fermer" />
      <div class="absolute inset-0 grid place-items-center">
        <img v-if="viewerSrc" class="max-h-full max-w-full object-contain" :src="viewerSrc" alt="" />
      </div>

      <div
        class="absolute inset-x-0 bottom-0 border-t border-black/10 bg-beige/95 px-5 py-4 backdrop-blur"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="mx-auto grid max-w-lg grid-cols-2 gap-3">
          <button
            class="rounded-xl bg-black/10 px-4 py-3 text-sm text-bordeaux hover:bg-black/15"
            :disabled="!auth.isMaster"
            type="button"
            @click="deleteFromViewer"
          >
            Supprimer
          </button>
          <button class="rounded-xl bg-black/10 px-4 py-3 text-sm text-bordeaux hover:bg-black/15" type="button" @click="closeViewer">
            Fermer
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
