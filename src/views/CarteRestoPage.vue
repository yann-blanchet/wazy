<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()
const enhanceSession = useEnhanceSessionStore()

const permanentFileInputEl = ref<HTMLInputElement | null>(null)

const permanentStatus = ref<string>('')
const permanentMenus = ref<{ id: string; createdAt: number }[]>([])

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

const viewerOpen = ref<boolean>(false)
const viewerSrc = ref<string>('')
const viewerId = ref<string>('')

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

async function deleteFromViewer() {
  if (!viewerId.value) return
  await deletePermanentMenu(viewerId.value)
  closeViewer()
}

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'resto' } })
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

function triggerPermanentPick() {
  if (!auth.isMaster) return
  permanentFileInputEl.value?.click()
}

async function persistOrder() {
  if (!auth.isMaster) return
  if (!auth.key) return
  await apiFetch<{ ok: boolean }>('/api/permanent-menus/reorder', {
    method: 'POST',
    key: auth.key,
    body: { ids: permanentMenus.value.map((p) => p.id) }
  })
}

async function movePermanentMenu(from: number, to: number) {
  if (!auth.isMaster) return
  if (from < 0 || from >= permanentMenus.value.length) return
  if (to < 0 || to >= permanentMenus.value.length) return
  if (from === to) return

  const next = [...permanentMenus.value]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  permanentMenus.value = next

  try {
    permanentStatus.value = 'Enregistrement…'
    await persistOrder()
    permanentStatus.value = 'Ordre mis à jour.'
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'reorder_error'
  }
}

async function deletePermanentMenu(pid: string) {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    permanentStatus.value = 'Suppression…'
    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/permanent-menu?id=${encodeURIComponent(pid)}`, {
      method: 'DELETE',
      key: auth.key
    })
    permanentMenus.value = permanentMenus.value.filter((x) => x.id !== pid)
    permanentStatus.value = 'Supprimé.'
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'delete_error'
  }
}

onMounted(async () => {
  try {
    if (!auth.id) return
    const pub = await apiFetch<{ permanentMenus?: { id: string; createdAt: number }[] }>(`/api/public/${auth.id}`, {
      method: 'GET'
    })
    permanentMenus.value = Array.isArray(pub.permanentMenus) ? pub.permanentMenus : []
  } catch (e) {
    permanentStatus.value = e instanceof Error ? e.message : 'load_error'
  }
})
</script>

<template>
  <main class="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden">
    <div class="sticky top-0 z-[60]  px-6 pt-4 backdrop-blur">
      <div class="flex items-center justify-between">
        <div class="text-2xl font-semibold">Carte</div>
          <div class="w-12" />
      <button class="text-sm text-secondary underline" type="button" @click="goBack">Retour</button>
      </div>
    </div>

    <section class="px-2">
      <div class=" p-5">
        <p class="mt-1 text-sm text-primary/70">Carte permanente du restaurant (entrées, plats, desserts).</p>
      </div>
    </section>

    <section class="flex-1 overflow-y-auto px-6 pb-32 pt-4">
      <div v-if="permanentMenus.length === 0" class="rounded-xl bg-black/10 p-4 text-sm text-primary/70">
        Aucune carte permanente pour le moment.
      </div>
      <div v-else class="grid grid-cols-1 gap-3">
        <div v-for="(m, idx) in permanentMenus" :key="m.id" class="relative overflow-hidden rounded-2xl bg-black/10">
          <div class="aspect-[4/5] overflow-hidden">
            <button class="block h-full w-full" type="button" @click="openViewer(m.id, m.createdAt)">
              <img class="h-full w-full object-cover" :src="permanentMenuItemUrl(m.id, m.createdAt)" :alt="m.id" />
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
                @click.stop="movePermanentMenu(idx, idx - 1)"
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
                :disabled="idx === permanentMenus.length - 1"
                :class="idx === permanentMenus.length - 1 ? 'opacity-40' : ''"
                @click.stop="movePermanentMenu(idx, idx + 1)"
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
              @click.stop="deletePermanentMenu(m.id)"
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
        <div v-if="permanentStatus" class="text-sm text-primary/70">{{ permanentStatus }}</div>
      </div>
    </section>

    <input ref="permanentFileInputEl" class="sr-only" type="file" accept="image/*" @change="onPermanentPick" />

    <div
      class="fixed inset-x-0 bottom-0 z-[80] border-t border-black/10 px-4 py-3 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 12px)"
    >
      <div class="mx-auto max-w-lg">
        <button
          class="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20 hover:bg-primary/90"
          type="button"
          @click="triggerPermanentPick"
        >
          Ajouter une carte
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
