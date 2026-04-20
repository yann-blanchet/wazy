<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import QRCode from 'qrcode'
import { apiFetch } from '../lib/api'

const router = useRouter()
const route = useRoute()

const auth = useAuthStore()

const workerKey = ref<string>('')
const name = ref<string>('')
const address = ref<string>('')
const city = ref<string>('')
const phone = ref<string>('')
const cuisineType = ref<string>('')
const profileStatus = ref<string>('')

const cuisineSheetOpen = ref<boolean>(false)
const cuisineOptions = [
  'Asiatique',
  'Bistrot',
  'Italien',
  'Indien',
  'Libanais',
  'Mexicain',
  'Burger',
  'Pizza',
  'Crêperie',
  'Boulangerie',
  'Gastronomique',
  'Végétarien'
]

const onboarding = computed(() => route.query.onboarding === '1')
const nameInputEl = ref<HTMLInputElement | null>(null)

const tab = ref<'infos' | 'share' | 'history'>('infos')

function pickCuisine(v: string) {
  cuisineType.value = v
  cuisineSheetOpen.value = false
}

onMounted(async () => {
  try {
    if (!auth.key) return
    if (auth.isMaster) {
      const k = await apiFetch<{ workerKey: string }>('/api/keys', { method: 'GET', key: auth.key })
      workerKey.value = k.workerKey
      await refreshQr()
    }
    const res = await apiFetch<{ restaurant: { name: string; address: string; city?: string; phone: string; cuisineType?: string } }>(
      '/api/restaurant',
      { method: 'GET', key: auth.key }
    )
    name.value = res.restaurant.name ?? ''
    address.value = res.restaurant.address ?? ''
    city.value = res.restaurant.city ?? ''
    phone.value = res.restaurant.phone ?? ''
    cuisineType.value = res.restaurant.cuisineType ?? ''

    if (onboarding.value) {
      queueMicrotask(() => nameInputEl.value?.focus())
    }
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'load_error'
  }
})

async function saveProfile() {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    profileStatus.value = 'Saving…'
    await apiFetch('/api/restaurant', {
      method: 'PUT',
      key: auth.key,
      body: {
        name: name.value,
        address: address.value,
        city: city.value,
        phone: phone.value
        ,
        cuisineType: cuisineType.value
      }
    })
    profileStatus.value = 'Saved.'
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'save_error'
  }
}

const workerLoginUrl = computed(() => {
  if (!workerKey.value) return ''
  const u = new URL(window.location.origin)
  u.pathname = '/login'
  u.searchParams.set('key', workerKey.value)
  return u.toString()
})

const publicPageUrl = computed(() => {
  if (!auth.id) return ''
  const u = new URL(window.location.origin)
  u.pathname = `/r/${auth.id}`
  return u.toString()
})

type MenuItem = { date: string; createdAt: number }
const menus = ref<MenuItem[]>([])
const historyError = ref<string>('')
const historyLoading = ref<boolean>(false)

const historyTiles = computed(() => {
  const rid = auth.id
  if (!rid) return [] as { date: string; url: string }[]
  return menus.value.map((m) => ({
    date: m.date,
    url: `${apiFetchBase()}/api/public/${rid}/menu/${m.date}`
  }))
})

async function loadHistory() {
  historyError.value = ''
  historyLoading.value = true
  menus.value = []
  try {
    if (!auth.key) throw new Error('missing_auth')
    const res = await apiFetch<{ id: string; menus: MenuItem[] }>('/api/menus', {
      method: 'GET',
      key: auth.key
    })
    menus.value = res.menus
  } catch (e) {
    historyError.value = e instanceof Error ? e.message : 'load_error'
  } finally {
    historyLoading.value = false
  }
}

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

async function copyPublicLink() {
  if (!publicPageUrl.value) return
  await navigator.clipboard.writeText(publicPageUrl.value)
}

function openPublicLink() {
  if (!publicPageUrl.value) return
  window.open(publicPageUrl.value, '_blank')
}

const qrDataUrl = ref<string>('')

async function refreshQr() {
  if (!workerLoginUrl.value) {
    qrDataUrl.value = ''
    return
  }
  qrDataUrl.value = await QRCode.toDataURL(workerLoginUrl.value, {
    margin: 1,
    width: 512
  })
}

async function regenerateWorkerKey() {
  if (!auth.isMaster) throw new Error('forbidden')
  const res = await auth.regenerateWorkerKey()
  workerKey.value = res.workerKey
  await refreshQr()
}

async function downloadQrPng() {
  if (!qrDataUrl.value) return
  const a = document.createElement('a')
  a.href = qrDataUrl.value
  a.download = 'vazy-worker-qr.png'
  a.click()
}

async function logout() {
  auth.logout()
  await router.push('/login')
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Settings</h1>
      <button class="text-sm text-slate-300 underline" @click="router.push('/dashboard')">
        Back
      </button>
    </div>

    <section class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Session</h2>
      <p class="mt-1 text-sm text-slate-300">Sign out from this device.</p>

      <button class="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15" @click="logout">
        Logout
      </button>
    </section>

    <div v-if="cuisineSheetOpen" class="fixed inset-0 z-[80]">
      <div class="absolute inset-0 bg-black/60" @click="cuisineSheetOpen = false" />
      <div
        class="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 bg-slate-950 px-5 py-4"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-slate-200">Type de cuisine</div>
          <button class="text-sm text-slate-300 underline" @click="cuisineSheetOpen = false">Close</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            v-for="c in cuisineOptions"
            :key="c"
            class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
            @click="pickCuisine(c)"
          >
            {{ c }}
          </button>
        </div>
      </div>
    </div>

  </main>
</template>
