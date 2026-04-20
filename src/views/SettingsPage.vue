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
const phone = ref<string>('')
const profileStatus = ref<string>('')

const onboarding = computed(() => route.query.onboarding === '1')
const nameInputEl = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    if (!auth.key) return
    if (auth.isMaster) {
      const k = await apiFetch<{ workerKey: string }>('/api/keys', { method: 'GET', key: auth.key })
      workerKey.value = k.workerKey
      await refreshQr()
    }
    const res = await apiFetch<{ restaurant: { name: string; address: string; phone: string } }>(
      '/api/restaurant',
      { method: 'GET', key: auth.key }
    )
    name.value = res.restaurant.name ?? ''
    address.value = res.restaurant.address ?? ''
    phone.value = res.restaurant.phone ?? ''

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
        phone: phone.value
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
      <h2 class="text-lg font-semibold">Restaurant</h2>
      <p class="mt-1 text-sm text-slate-300">Shown on the public page.</p>
      <p v-if="onboarding" class="mt-2 text-sm text-slate-200">Set your restaurant name, address and phone.</p>

      <div class="mt-4 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Name</span>
          <input
            v-model="name"
            ref="nameInputEl"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="organization"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Address</span>
          <input
            v-model="address"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="street-address"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Phone</span>
          <input
            v-model="phone"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="tel"
          />
        </label>

        <button
          class="rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15"
          :disabled="!auth.isMaster"
          @click="saveProfile"
        >
          Save restaurant info
        </button>

        <div v-if="profileStatus" class="text-sm text-slate-300">{{ profileStatus }}</div>
      </div>
    </section>

    <section class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Public link</h2>
      <p class="mt-1 text-sm text-slate-300">Share with customers.</p>

      <div v-if="publicPageUrl" class="mt-4 break-all rounded-xl bg-black/30 p-3 font-mono text-xs text-slate-300">
        {{ publicPageUrl }}
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15" :disabled="!publicPageUrl" @click="copyPublicLink">
          Copy
        </button>
        <button class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15" :disabled="!publicPageUrl" @click="openPublicLink">
          Open
        </button>
      </div>
    </section>

    <section class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Worker key</h2>
      <p class="mt-1 text-sm text-slate-300">Staff upload-only key (regeneratable).</p>

      <div class="mt-4 break-all rounded-xl bg-black/30 p-3 font-mono text-sm">
        {{ workerKey }}
      </div>

      <div v-if="workerLoginUrl" class="mt-3 break-all rounded-xl bg-black/30 p-3 font-mono text-xs text-slate-300">
        {{ workerLoginUrl }}
      </div>

      <div v-if="qrDataUrl" class="mt-4 rounded-xl bg-white p-3">
        <img class="w-full" :src="qrDataUrl" alt="Worker login QR" />
      </div>

      <div class="mt-4 grid gap-3">
        <button class="rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15" @click="regenerateWorkerKey">
          Regenerate worker key
        </button>

        <button
          class="rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15"
          :disabled="!qrDataUrl"
          @click="downloadQrPng"
        >
          Download QR (PNG)
        </button>
      </div>
    </section>

    <section class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Session</h2>
      <p class="mt-1 text-sm text-slate-300">Sign out from this device.</p>

      <button class="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15" @click="logout">
        Logout
      </button>
    </section>
  </main>
</template>
