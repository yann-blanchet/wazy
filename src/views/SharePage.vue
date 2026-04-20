<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import QRCode from 'qrcode'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const tab = ref<'public' | 'team' | 'session'>('public')

const workerKey = ref<string>('')
const qrDataUrl = ref<string>('')

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

async function copyText(v: string) {
  if (!v) return
  await navigator.clipboard.writeText(v)
}

function openLink(v: string) {
  if (!v) return
  window.open(v, '_blank')
}

onMounted(async () => {
  try {
    if (!auth.key) return
    if (!auth.isMaster) return
    const k = await apiFetch<{ workerKey: string }>('/api/keys', { method: 'GET', key: auth.key })
    workerKey.value = k.workerKey
    await refreshQr()
  } catch {
    workerKey.value = ''
    qrDataUrl.value = ''
  }
})

async function regenerateWorkerKey() {
  if (!auth.isMaster) throw new Error('forbidden')
  const res = await auth.regenerateWorkerKey()
  workerKey.value = res.workerKey
  await refreshQr()
}

async function logout() {
  auth.logout()
  await router.push('/login')
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="text-2xl font-semibold">Partager</div>

    <div class="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-1">
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'public' ? 'bg-white/10 text-slate-100' : 'text-slate-300 hover:bg-white/5'"
        @click="tab = 'public'"
      >
        Lien public
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'team' ? 'bg-white/10 text-slate-100' : 'text-slate-300 hover:bg-white/5'"
        @click="tab = 'team'"
      >
        Équipe
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'session' ? 'bg-white/10 text-slate-100' : 'text-slate-300 hover:bg-white/5'"
        @click="tab = 'session'"
      >
        Session
      </button>
    </div>

    <section v-if="tab === 'public'" class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Public link</h2>
      <p class="mt-1 text-sm text-slate-300">Share with customers.</p>

      <div v-if="publicPageUrl" class="mt-4 break-all rounded-xl bg-black/30 p-3 font-mono text-xs text-slate-300">
        {{ publicPageUrl }}
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15" :disabled="!publicPageUrl" @click="copyText(publicPageUrl)">
          Copy
        </button>
        <button class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15" :disabled="!publicPageUrl" @click="openLink(publicPageUrl)">
          Open
        </button>
      </div>
    </section>

    <section v-if="tab === 'team'" class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Worker access</h2>
      <p class="mt-1 text-sm text-slate-300">Staff upload-only key (regeneratable).</p>

      <div v-if="!auth.isMaster" class="mt-4 rounded-xl bg-white/10 p-4 text-sm text-slate-300">
        Only the master account can view and regenerate the worker key.
      </div>

      <template v-else>
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
        </div>
      </template>
    </section>

    <section v-if="tab === 'session'" class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Session</h2>
      <p class="mt-1 text-sm text-slate-300">Déconnexion de cette session.</p>

      <button class="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15" @click="logout">
        Déconnexion
      </button>
    </section>
  </main>
</template>
