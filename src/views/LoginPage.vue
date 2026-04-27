<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = computed(() => {
  const m = route.query.mode
  if (m === 'create' || m === 'recover') return m
  return 'login'
})
const key = ref('')
const desiredId = ref('')
const createError = ref('')

const recoveryRestaurantId = ref('')
const recoveryEmail = ref('')
const recoveryToken = ref('')
const recoveryStatus = ref('')
const recoveredMasterKey = ref('')

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
    const res = desiredId.value.trim().length > 0 ? await auth.createAccountWithId(desiredId.value) : await auth.createAccount()
    masterKeyShown.value = res.masterKey
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'create_error'
  }
}

async function login() {
  await auth.loginWithKey(key.value)
  await router.push('/dashboard')
}

async function requestRecoveryToken() {
  try {
    recoveryStatus.value = 'Envoi…'
    recoveredMasterKey.value = ''
    await apiFetch<{ ok: true }>('/api/account/recovery/request', {
      method: 'POST',
      body: { id: recoveryRestaurantId.value, adminEmail: recoveryEmail.value }
    })
    recoveryStatus.value = 'Email envoyé (si l’adresse correspond).'
  } catch (e) {
    recoveryStatus.value = e instanceof Error ? e.message : 'request_error'
  }
}

async function confirmRecoveryToken() {
  try {
    recoveryStatus.value = 'Validation…'
    const res = await apiFetch<{ masterKey: string }>('/api/account/recovery/confirm', {
      method: 'POST',
      body: { id: recoveryRestaurantId.value, token: recoveryToken.value }
    })
    recoveredMasterKey.value = res.masterKey
    recoveryStatus.value = 'Nouvelle clé maître générée.'
  } catch (e) {
    recoveredMasterKey.value = ''
    recoveryStatus.value = e instanceof Error ? e.message : 'confirm_error'
  }
}

async function copyRecoveredMasterKey() {
  if (!recoveredMasterKey.value) return
  await navigator.clipboard.writeText(recoveredMasterKey.value)
}

function setMode(m: 'login' | 'create' | 'recover') {
  router.push({ path: '/', query: m === 'login' ? {} : { mode: m } })
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <h1 class="text-3xl font-semibold tracking-tight">titre menu</h1>
    <p class="mt-2 text-primary/70">Publiez le menu du jour avec une seule photo.</p>


    <div class="mt-10">
      <h2 class="text-2xl font-semibold">
        {{ mode === 'create' ? 'Créer un compte' : mode === 'recover' ? 'Clé oubliée' : 'Connexion' }}
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
        </div>
      </div>

      <div v-else-if="mode === 'recover'" class="mt-6 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Identifiant du restaurant</span>
          <input
            v-model="recoveryRestaurantId"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-primary outline-none focus:border-primary/60"
            placeholder="ex: le-bistrot"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Email admin</span>
          <input
            v-model="recoveryEmail"
            type="email"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-base text-primary outline-none focus:border-primary/60"
            placeholder="admin@restaurant.com"
            autocomplete="email"
          />
        </label>

        <button class="rounded-xl bg-primary px-4 py-3 font-medium text-background hover:bg-primary/90" type="button" @click="requestRecoveryToken">
          Envoyer le code
        </button>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Code reçu par email</span>
          <input
            v-model="recoveryToken"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-primary outline-none focus:border-primary/60"
            placeholder="Code"
            autocomplete="one-time-code"
          />
        </label>

        <button
          class="rounded-xl bg-primary px-4 py-3 font-medium text-background hover:bg-primary/90"
          type="button"
          :disabled="recoveryRestaurantId.trim().length === 0 || recoveryToken.trim().length === 0"
          @click="confirmRecoveryToken"
        >
          Confirmer et régénérer la clé maître
        </button>

        <div v-if="recoveredMasterKey" class="rounded-xl bg-black/10 p-4">
          <div class="text-sm text-primary/70">Nouvelle clé maître :</div>
          <div class="mt-2 break-all font-mono text-sm text-primary">{{ recoveredMasterKey }}</div>
          <button class="mt-3 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15" type="button" @click="copyRecoveredMasterKey">
            Copier
          </button>
        </div>

        <div v-if="recoveryStatus" class="rounded-xl bg-black/10 p-4 text-sm text-primary/70">
          {{ recoveryStatus }}
        </div>

        <button class="text-left text-sm text-secondary underline hover:text-secondary/80" type="button" @click="setMode('login')">Retour à la connexion</button>
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

        <button class="text-left text-sm text-secondary underline hover:text-secondary/80" type="button" @click="setMode('recover')">Clé oubliée ?</button>

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
