<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mode = computed(() => (route.query.mode === 'create' ? 'create' : 'login'))
const key = ref('')
const desiredId = ref('')
const createError = ref('')

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
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <h1 class="text-2xl font-semibold">
      {{ mode === 'create' ? 'Créer un compte' : 'Connexion' }}
    </h1>

    <div v-if="mode === 'create'" class="mt-6 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm text-bordeaux/70">Choisissez votre identifiant public</span>
        <input
          v-model="desiredId"
          class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-bordeaux outline-none focus:border-bordeaux/60"
          placeholder="e.g. le-bistrot"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>

      <button
        class="rounded-xl bg-bordeaux px-4 py-3 font-medium text-beige hover:bg-bordeaux/90"
        @click="createAccount"
      >
        Créer → obtenir la clé maître
      </button>

      <div v-if="createError" class="rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
        {{ createError }}
      </div>

      <div v-if="masterKeyShown" class="rounded-xl bg-black/10 p-4">
        <div class="text-sm text-bordeaux/70">Clé maître (affichée une seule fois) :</div>
        <div class="mt-2 break-all font-mono text-sm text-bordeaux">{{ masterKeyShown }}</div>
        <button
          class="mt-3 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15"
          @click="useMasterKeyToLogin"
        >
          Se connecter avec cette clé
        </button>
      </div>
    </div>

    <div v-else class="mt-6 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm text-bordeaux/70">Clé</span>
        <input
          v-model="key"
          class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-base text-bordeaux outline-none focus:border-bordeaux/60"
          placeholder="{id} or {id}-master"
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

    <button class="mt-8 text-sm text-bordeaux/70 underline" @click="router.push('/')">
      Retour
    </button>
  </main>
</template>
