<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'
import * as QRCode from 'qrcode'

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

const masterKeyShown = ref<string | null>(null)
const ownerQrUrl = ref<string>('')
const ownerQrSvg = ref<string>('')
const ownerQrToken = ref<string>('')

async function generateOwnerQr(masterKey: string) {
  const res = await apiFetch<{ token: string; url: string }>('/api/qr/create', {
    method: 'POST',
    key: masterKey,
    body: { role: 'master' }
  })

  ownerQrUrl.value = res.url
  ownerQrToken.value = res.token
  ownerQrSvg.value = (await (QRCode as unknown as { toString: (text: string, opts: unknown) => Promise<string> }).toString(res.url, {
    type: 'svg',
    margin: 1,
    width: 240
  }))
}

async function copyOwnerQrUrl() {
  if (!ownerQrUrl.value) return
  await navigator.clipboard.writeText(ownerQrUrl.value)
}

async function loginWithOwnerQr() {
  if (!ownerQrToken.value) return
  await auth.loginWithQrToken(ownerQrToken.value)
  await router.push({ path: '/onboarding' })
}

async function useMasterKeyToLogin() {
  if (!masterKeyShown.value) return
  key.value = masterKeyShown.value
  masterKeyShown.value = null
  await auth.loginWithKey(key.value)
  await router.push({ path: '/onboarding' })
}

async function createAccount() {
  createError.value = ''
  try {
    ownerQrUrl.value = ''
    ownerQrSvg.value = ''
    ownerQrToken.value = ''
    const res = desiredId.value.trim().length > 0 ? await auth.createAccountWithId(desiredId.value) : await auth.createAccount()
    masterKeyShown.value = res.masterKey
    await generateOwnerQr(res.masterKey)
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
          Créer → obtenir la clé maître
        </button>

        <div v-if="createError" class="rounded-xl bg-black/10 p-4 text-sm text-primary/70">
          {{ createError }}
        </div>

        <div v-if="masterKeyShown" class="rounded-xl bg-black/10 p-4">
          <div class="text-sm text-primary/70">Clé maître (affichée une seule fois) :</div>
          <div class="mt-2 break-all font-mono text-sm text-primary">{{ masterKeyShown }}</div>
          <button
            class="mt-3 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15"
            @click="useMasterKeyToLogin"
          >
            Se connecter avec cette clé
          </button>

          <div v-if="ownerQrUrl" class="mt-4 grid gap-3">
            <div class="text-sm text-primary/70">QR owner (connexion) :</div>
            <div class="rounded-xl bg-white p-4" v-html="ownerQrSvg" />
            <div class="rounded-xl bg-black/5 p-3">
              <div class="text-xs text-primary/70">Lien :</div>
              <div class="mt-1 break-all font-mono text-xs text-primary">{{ ownerQrUrl }}</div>
              <div class="mt-3 flex gap-2">
                <button class="rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15" type="button" @click="copyOwnerQrUrl">Copier le lien</button>
                <button class="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background hover:bg-primary/90" type="button" @click="loginWithOwnerQr">Se connecter sur cet appareil</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="mt-6 grid gap-3">
        <label class="grid gap-2">
          
          <input
            v-model="key"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-primary outline-none focus:border-primary/60"
            placeholder="code"
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
  </main>
</template>
