<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import QRCode from 'qrcode'

const router = useRouter()
const auth = useAuthStore()

const publicQrDataUrl = ref<string>('')

function apiOrigin() {
  return window.location.origin
}

const publicPageUrl = computed(() => {
  if (!auth.id) return ''
  const u = new URL(apiOrigin())
  u.pathname = `/r/${auth.id}`
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

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'resto' } })
}

onMounted(async () => {
  await refreshPublicQr()
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
       <div class="w-12" />
     <div class="text-2xl font-semibold">Lien public</div>
      <button class="text-sm text-primary/70 underline" type="button" @click="goBack">Retour</button>
    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
      <p class="mt-1 text-sm text-primary/70">Lien public à partager avec vos clients.</p>

      <div v-if="publicPageUrl" class="mt-4 break-all rounded-xl bg-black/10 p-3 font-mono text-xs text-primary/70">
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
  </main>
</template>
