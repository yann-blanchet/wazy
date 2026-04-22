<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()
const enhanceSession = useEnhanceSessionStore()

const permanentStatus = ref<string>('')
const permanentMenus = ref<{ id: string; createdAt: number }[]>([])

const permanentCameraInputEl = ref<HTMLInputElement | null>(null)

function triggerPermanentCamera() {
  permanentCameraInputEl.value?.click()
}

function formatUpdatedAt(ts: number) {
  const d = new Date(ts)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const permanentCount = computed(() => permanentMenus.value.length)
const permanentLastUpdatedText = computed(() => {
  const latest = permanentMenus.value.reduce<number | null>((acc, m) => {
    if (!m?.createdAt) return acc
    if (acc === null) return m.createdAt
    return m.createdAt > acc ? m.createdAt : acc
  }, null)
  return latest ? formatUpdatedAt(latest) : '—'
})

const viewerOpen = ref<boolean>(false)
const viewerSrc = ref<string>('')
const viewerId = ref<string>('')

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function permanentMenuItemUrl(pid: string, t?: number) {
  if (!auth.id) return ''
  const q = typeof t === 'number' && t > 0 ? `?t=${t}` : ''
  return `${apiFetchBase()}/api/public/${auth.id}/permanent-menu/${pid}${q}`
}

function openViewer(id: string, createdAt: number) {
  viewerId.value = id
  viewerSrc.value = permanentMenuItemUrl(id, createdAt)
  viewerOpen.value = true
}

function closeViewer() {
  viewerOpen.value = false
  viewerSrc.value = ''
  viewerId.value = ''
}

async function deletePermanentMenu(pid: string) {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    permanentStatus.value = 'Deleting…'
    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/permanent-menu?id=${encodeURIComponent(pid)}`, {
      method: 'DELETE',
      key: auth.key
    })
    permanentMenus.value = permanentMenus.value.filter((x) => x.id !== pid)
    permanentStatus.value = 'Deleted.'
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'delete_error'
  }
}

async function deleteFromViewer() {
  if (!viewerId.value) return
  await deletePermanentMenu(viewerId.value)
  closeViewer()
}

async function onPermanentPick(e: Event) {
  try {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!auth.key) throw new Error('missing_auth')

    enhanceSession.start(file, '', 'permanent-menu', '/carte')
    await router.push('/enhance')

    input.value = ''
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'upload_error'
  }
}

onMounted(async () => {
  await router.replace({ path: '/restaurant', query: { tab: 'carte' } })
  try {
    if (!auth.id) return
    const pub = await apiFetch<{ permanentMenus?: { id: string; createdAt: number }[] }>(`/api/public/${auth.id}`, {
      method: 'GET'
    })
    permanentMenus.value = Array.isArray(pub.permanentMenus) ? pub.permanentMenus : []
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'load_error'
  }
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Carte</h1>
      <div class="text-xs text-bordeaux/70">{{ permanentCount }} • MAJ: {{ permanentLastUpdatedText }}</div>
    </div>

    <p class="mt-1 text-sm text-bordeaux/70">Toutes les cartes permanentes seront affichées ici.</p>

    <div class="mt-4">
      <div v-if="permanentMenus.length === 0" class="rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
        Aucune carte permanente pour le moment.
      </div>
      <div v-else class="grid grid-cols-1 gap-3">
        <div v-for="m in permanentMenus" :key="m.id" class="overflow-hidden rounded-2xl bg-black/10">
          <div class="aspect-[4/5] overflow-hidden">
            <button class="block h-full w-full" type="button" @click="openViewer(m.id, m.createdAt)">
              <img class="h-full w-full object-cover" :src="permanentMenuItemUrl(m.id, m.createdAt)" :alt="m.id" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4 grid gap-3">
      <div v-if="permanentStatus" class="text-sm text-bordeaux/70">{{ permanentStatus }}</div>
    </div>

    <label class="fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
      <input
        ref="permanentCameraInputEl"
        class="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        :disabled="!auth.isMaster"
        @change="onPermanentPick"
      />
      <button
        class="flex h-16 w-16 items-center justify-center rounded-full bg-bordeaux text-beige shadow-lg shadow-black/30 ring-1 ring-black/10 hover:bg-bordeaux/90"
        :class="!auth.isMaster ? 'pointer-events-none opacity-60' : ''"
        type="button"
        aria-label="Ajouter une carte"
        title="Ajouter une carte"
        @click="triggerPermanentCamera"
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
      </button>
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
            @click="deleteFromViewer"
          >
            Supprimer
          </button>
          <button class="rounded-xl bg-bordeaux px-4 py-3 text-sm font-medium text-beige hover:bg-bordeaux/90" @click="closeViewer">
            Fermer
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
