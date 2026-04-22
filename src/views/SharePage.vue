<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { apiFetch } from '../lib/api'
import { uploadQueueCount } from '../lib/uploadQueue'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'public' | 'team' | 'stats'>('public')

const workerKey = ref<string>('')
const publicQrDataUrl = ref<string>('')

const workerKeySaving = ref(false)
const workerKeyStatus = ref<string>('')

const workerKeyTrimmed = computed(() => workerKey.value.trim())
const workerKeyValid = computed(() => {
  const k = workerKeyTrimmed.value
  if (k.length < 6 || k.length > 64) return false
  return /^[a-zA-Z0-9_-]+$/.test(k)
})

const queued = ref<number>(0)
const statsMenusCount = ref<number>(0)
const statsPhotosCount = ref<number>(0)
const statsPermanentMenusCount = ref<number>(0)

async function refreshStats() {
  queued.value = await uploadQueueCount()

  try {
    if (auth.key) {
      const res = await apiFetch<{ id: string; menus: { date: string; createdAt: number }[] }>('/api/menus', {
        method: 'GET',
        key: auth.key
      })
      statsMenusCount.value = Array.isArray(res.menus) ? res.menus.length : 0
    } else {
      statsMenusCount.value = 0
    }
  } catch {
    statsMenusCount.value = 0
  }

  try {
    if (auth.id) {
      const pub = await apiFetch<{ photos?: { id: string; createdAt: number }[]; permanentMenus?: { id: string; createdAt: number }[] }>(
        `/api/public/${auth.id}`,
        { method: 'GET' }
      )
      statsPhotosCount.value = Array.isArray(pub.photos) ? pub.photos.length : 0
      statsPermanentMenusCount.value = Array.isArray(pub.permanentMenus) ? pub.permanentMenus.length : 0
    } else {
      statsPhotosCount.value = 0
      statsPermanentMenusCount.value = 0
    }
  } catch {
    statsPhotosCount.value = 0
    statsPermanentMenusCount.value = 0
  }
}

function apiOrigin() {
  return window.location.origin
}

const publicPageUrl = computed(() => {
  if (!auth.id) return ''
  const u = new URL(apiOrigin())
  u.pathname = `/r/${auth.id}`
  return u.toString()
})

const workerLoginUrl = computed(() => {
  if (!workerKey.value) return ''
  const u = new URL(apiOrigin())
  u.pathname = '/login'
  u.searchParams.set('key', workerKey.value)
  return u.toString()
})

async function refreshPublicQr() {
  if (!publicPageUrl.value) {
    publicQrDataUrl.value = ''
    return
  }
  publicQrDataUrl.value = await QRCode.toDataURL(publicPageUrl.value, {
    margin: 1,
    width: 512
  })
}

async function copyText(v: string) {
  if (!v) return
  await navigator.clipboard.writeText(v)
}

function openLink(v: string) {
  if (!v) return
  window.open(v, '_blank')
}

onMounted(async () => {
  await refreshStats()
  await refreshPublicQr()
  try {
    if (!auth.key) return
    if (!auth.isMaster) return
    const k = await apiFetch<{ workerKey: string }>('/api/keys', { method: 'GET', key: auth.key })
    workerKey.value = k.workerKey
  } catch {
    workerKey.value = ''
  }
})

async function regenerateWorkerKey() {
  if (!auth.isMaster) throw new Error('forbidden')
  const res = await auth.regenerateWorkerKey()
  workerKey.value = res.workerKey
  workerKeyStatus.value = ''
}

async function saveWorkerKey() {
  if (!auth.isMaster) return
  workerKeySaving.value = true
  workerKeyStatus.value = ''
  try {
    const res = await auth.setWorkerKey(workerKeyTrimmed.value)
    workerKey.value = res.workerKey
    workerKeyStatus.value = 'Clé mise à jour.'
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'save_error'
    if (raw === 'invalid_worker_key') workerKeyStatus.value = 'Clé invalide. Utilisez 6 à 64 caractères (lettres, chiffres, _ ou -).'
    else if (raw === 'key_taken') workerKeyStatus.value = 'Cette clé est déjà utilisée. Choisissez-en une autre.'
    else if (raw === 'missing_auth') workerKeyStatus.value = 'Session expirée. Reconnectez-vous avec la clé maître.'
    else if (raw === 'forbidden') workerKeyStatus.value = 'Action réservée au compte maître.'
    else if (raw === 'invalid_key') workerKeyStatus.value = 'Clé invalide. Reconnectez-vous.'
    else workerKeyStatus.value = raw
  } finally {
    workerKeySaving.value = false
  }
}

async function logout() {
  auth.logout()
  await router.push('/login')
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <div class="text-2xl font-semibold">QR / Partager</div>
      <button
        class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 text-bordeaux hover:bg-black/15"
        type="button"
        aria-label="Déconnexion"
        title="Déconnexion"
        @click="logout"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
          <path d="M10 16l-4-4 4-4" />
          <path d="M6 12h11" />
          <path d="M15 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" />
        </svg>
      </button>
    </div>

    <div class="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-black/5 p-1">
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'public' ? 'bg-black/10 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
        @click="tab = 'public'"
      >
        Lien public
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'team' ? 'bg-black/10 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
        @click="tab = 'team'"
      >
        Équipe
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'stats' ? 'bg-black/10 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
        @click="tab = 'stats'"
      >
        Stats
      </button>
    </div>

    <section v-if="tab === 'public'" class="mt-6 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold">Lien public</h2>
      <p class="mt-1 text-sm text-bordeaux/70">À partager avec vos clients.</p>

      <div v-if="publicPageUrl" class="mt-4 break-all rounded-xl bg-black/10 p-3 font-mono text-xs text-bordeaux/70">
        {{ publicPageUrl }}
      </div>

      <div v-if="publicQrDataUrl" class="mt-4 overflow-hidden rounded-xl bg-white p-3">
        <img class="w-full" :src="publicQrDataUrl" alt="Public link QR" />
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="rounded-xl bg-black/10 px-4 py-3 text-sm hover:bg-black/15" :disabled="!publicPageUrl" @click="copyText(publicPageUrl)">
          Copier
        </button>
        <button class="rounded-xl bg-black/10 px-4 py-3 text-sm hover:bg-black/15" :disabled="!publicPageUrl" @click="openLink(publicPageUrl)">
          Ouvrir
        </button>
      </div>
    </section>

    <section v-if="tab === 'stats'" class="mt-6 rounded-2xl bg-black/5 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Stats</h2>
        <button class="rounded-xl bg-black/10 px-4 py-2 text-sm hover:bg-black/15" type="button" @click="refreshStats">
          Rafraîchir
        </button>
      </div>
      <p class="mt-1 text-sm text-bordeaux/70">Résumé de votre compte sur cet appareil.</p>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Uploads en attente</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ queued }}</div>
        </div>
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Menus</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ statsMenusCount }}</div>
        </div>
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Photos resto</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ statsPhotosCount }}</div>
        </div>
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Cartes</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ statsPermanentMenusCount }}</div>
        </div>
      </div>
    </section>

    <section v-if="tab === 'team'" class="mt-6 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold">Accès équipe</h2>
      <p class="mt-1 text-sm text-bordeaux/70">Lien de connexion pour l’équipe (upload uniquement).</p>

      <div v-if="!auth.isMaster" class="mt-4 rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
        Seul le compte maître peut voir et régénérer la clé.
      </div>

      <template v-else>
        <div class="mt-4 grid gap-2">
          <div class="text-sm text-bordeaux/70">Clé</div>
          <input
            v-model="workerKey"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <div class="text-xs text-bordeaux/70">6–64 caractères. Lettres, chiffres, <span class="font-mono">_</span> et <span class="font-mono">-</span> uniquement.</div>
        </div>

        <div v-if="workerLoginUrl" class="mt-3 break-all rounded-xl bg-black/10 p-3 font-mono text-xs text-bordeaux/70">
          {{ workerLoginUrl }}
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="rounded-xl bg-black/10 px-4 py-3 text-sm hover:bg-black/15" :disabled="!workerLoginUrl" @click="copyText(workerLoginUrl)">
            Copier le lien
          </button>
          <button class="rounded-xl bg-black/10 px-4 py-3 text-sm hover:bg-black/15" :disabled="!workerLoginUrl" @click="openLink(workerLoginUrl)">
            Ouvrir
          </button>
        </div>

        <div class="mt-4 grid gap-3">
          <button
            class="rounded-xl bg-black/10 px-4 py-3 hover:bg-black/15"
            type="button"
            :disabled="workerKeySaving || !workerKeyValid"
            @click="saveWorkerKey"
          >
            Enregistrer la clé
          </button>

          <button class="rounded-xl bg-black/10 px-4 py-3 hover:bg-black/15" @click="regenerateWorkerKey">
            Régénérer la clé
          </button>

          <div v-if="workerKeyStatus" class="text-sm text-bordeaux/70">{{ workerKeyStatus }}</div>
        </div>
      </template>
    </section>

  </main>
</template>
