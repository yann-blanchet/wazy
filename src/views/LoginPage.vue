<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = computed(() => {
  const m = route.query.mode
  if (m === 'create') return m
  return 'login'
})
const key = ref('')
const desiredId = ref('')
const createError = ref('')

const recoveryDisabled = true

const autoLoginTried = ref(false)

const qrScannerOpen = ref(false)
const qrScannerError = ref<string>('')
const videoEl = ref<HTMLVideoElement | null>(null)
let scanStream: MediaStream | null = null
let scanTimer: number | null = null
const showManualCode = ref(false)

const canScanQr = computed(() => {
  const w = window as unknown as { BarcodeDetector?: unknown }
  return typeof w.BarcodeDetector === 'function'
})

async function stopQrScan() {
  if (scanTimer !== null) {
    window.clearTimeout(scanTimer)
    scanTimer = null
  }
  if (scanStream) {
    for (const t of scanStream.getTracks()) t.stop()
    scanStream = null
  }
  if (videoEl.value) {
    videoEl.value.srcObject = null
  }
}

async function startQrScan() {
  qrScannerError.value = ''
  if (!canScanQr.value) {
    qrScannerError.value = 'Scan QR non supporté sur cet appareil.'
    return
  }

  qrScannerOpen.value = true
  await stopQrScan()

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    })

    if (!videoEl.value) throw new Error('missing_video')
    videoEl.value.srcObject = scanStream
    await videoEl.value.play()

    const w = window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }
    const detector = new w.BarcodeDetector({ formats: ['qr_code'] })

    const tick = async () => {
      try {
        if (!qrScannerOpen.value || !videoEl.value) return
        const codes = await detector.detect(videoEl.value)
        const raw = codes?.[0]?.rawValue
        if (raw && typeof raw === 'string') {
          let code = ''
          try {
            const u = new URL(raw)
            code = u.searchParams.get('code') ?? u.searchParams.get('c') ?? u.searchParams.get('t') ?? ''
          } catch {
            // allow plain token
            code = raw
          }

          code = code.trim()
          if (code) {
            await stopQrScan()
            qrScannerOpen.value = false
            await auth.loginWithKey(code)
            await router.replace('/dashboard')
            return
          }
        }
      } catch {
        // ignore frame errors
      }
      scanTimer = window.setTimeout(tick, 250)
    }

    tick()
  } catch (e) {
    qrScannerError.value = e instanceof Error ? e.message : 'camera_error'
    await stopQrScan()
    qrScannerOpen.value = false
  }
}

async function closeQrScan() {
  qrScannerOpen.value = false
  await stopQrScan()
}

onBeforeUnmount(() => {
  stopQrScan()
})

watchEffect(() => {
  const qKey = route.query.key
  if (typeof qKey === 'string' && qKey.length > 0) {
    key.value = qKey

    if (!autoLoginTried.value) {
      autoLoginTried.value = true
      auth
        .loginWithKey(qKey)
        .then(async () => {
          await router.replace('/dashboard')
        })
        .catch(() => {
          // keep user on page to allow manual retry
        })
        .finally(async () => {
          if (route.path === '/login' && route.query.key) {
            await router.replace({ path: '/login', query: {} })
          }
        })
    }
  }
})

const ownerCodeShown = ref<string | null>(null)
const staffCodeShown = ref<string | null>(null)

async function useOwnerCodeToLogin() {
  if (!ownerCodeShown.value) return
  key.value = ownerCodeShown.value
  ownerCodeShown.value = null
  staffCodeShown.value = null
  await auth.loginWithKey(key.value)
  await router.push({ path: '/onboarding' })
}

async function createAccount() {
  createError.value = ''
  try {
    const res = desiredId.value.trim().length > 0 ? await auth.createAccountWithId(desiredId.value) : await auth.createAccount()
    ownerCodeShown.value = res.ownerCode
    staffCodeShown.value = res.staffCode
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'create_error'
  }
}

async function login() {
  await auth.loginWithKey(key.value)
  await router.push('/dashboard')
}

function setMode(m: 'login' | 'create') {
  router.push({ path: '/', query: m === 'login' ? {} : { mode: m } })
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <h1 class="text-3xl font-semibold tracking-tight">WAZY</h1>
    <p class="mt-2 text-primary/70">Publiez le menu du jour avec une seule photo.</p>


    <div class="mt-10">
      <h2 class="text-2xl font-semibold">
        {{ mode === 'create' ? 'Créer un compte' : 'Connexion' }}
      </h2>

      <div v-if="mode === 'create'" class="mt-6 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Choisissez votre identifiant public</span>
          <input
            v-model="desiredId"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-primary outline-none focus:border-primary/60"
            placeholder="e.g. le-bistrot"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </label>

        <button
          class="rounded-xl bg-primary px-4 py-3 font-medium text-background hover:bg-primary/90"
          @click="createAccount"
        >
          Créer → obtenir les codes
        </button>

        <div v-if="createError" class="rounded-xl bg-black/10 p-4 text-sm text-primary/70">
          {{ createError }}
        </div>

        <div v-if="ownerCodeShown" class="rounded-xl bg-black/10 p-4">
          <div class="text-sm text-primary/70">Code admin (affiché une seule fois) :</div>
          <div class="mt-2 break-all font-mono text-sm text-primary">{{ ownerCodeShown }}</div>

          <div v-if="staffCodeShown" class="mt-4">
            <div class="text-sm text-primary/70">Code employés (affiché une seule fois) :</div>
            <div class="mt-2 break-all font-mono text-sm text-primary">{{ staffCodeShown }}</div>
          </div>

          <button
            class="mt-4 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background hover:bg-primary/90"
            type="button"
            @click="useOwnerCodeToLogin"
          >
            Se connecter en admin
          </button>
        </div>
      </div>

      <div v-else class="mt-6 grid gap-3">
        <button
          v-if="canScanQr"
          class="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-4 text-base font-semibold text-background shadow-lg shadow-black/20 hover:bg-primary/90"
          type="button"
          @click="startQrScan"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 8h10" />
            <path d="M7 12h10" />
            <path d="M7 16h10" />
          </svg>
          Scanner le QR de connexion
        </button>

        <div v-else class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">Le scan QR n'est pas supporté sur cet appareil. Ouvre le lien du QR dans le navigateur.</div>

        <button
          class="rounded-xl bg-black/10 px-4 py-3 text-left text-sm text-primary hover:bg-black/15"
          type="button"
          @click="showManualCode = !showManualCode"
        >
          {{ showManualCode ? 'Masquer' : 'Utiliser un code' }}
        </button>

        <div v-if="showManualCode" class="grid gap-3 rounded-2xl bg-black/5 p-4">
          <label class="grid gap-2">
            <input
              v-model="key"
              class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-primary outline-none focus:border-primary/60"
              placeholder="code admin ou employés"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
            />
          </label>

          <button
            class="rounded-xl bg-black/10 px-4 py-3 hover:bg-black/15"
            :disabled="key.length === 0"
            @click="login"
          >
            Connexion
          </button>
        </div>

        <div v-if="recoveryDisabled" class="text-sm text-primary/70">Récupération par email bientôt disponible.</div>

        <div class="mt-3 rounded-xl bg-black/5 p-4">
          <div class="text-sm text-primary/70">Pas encore de compte ?</div>
          <button
            class="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-left font-medium text-background hover:bg-primary/90"
            type="button"
            @click="setMode('create')"
          >
            Créer un compte
          </button>
        </div>
      </div>

    </div>

    <div v-if="qrScannerOpen" class="fixed inset-0 z-[90] bg-black">
      <video ref="videoEl" class="absolute inset-0 h-full w-full object-cover" playsinline muted />

      <div class="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4">
        <div class="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/10 backdrop-blur">
          Scanner le QR de connexion
        </div>
        <button
          class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/10 backdrop-blur hover:bg-black/50"
          type="button"
          aria-label="Fermer"
          title="Fermer"
          @click="closeQrScan"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="qrScannerError" class="absolute inset-x-0 bottom-0 p-4">
        <div class="rounded-xl bg-black/50 p-3 text-sm text-white ring-1 ring-white/10 backdrop-blur">{{ qrScannerError }}</div>
      </div>
    </div>
  </main>
</template>
