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

watchEffect(() => {
  const qKey = route.query.key
  if (typeof qKey === 'string' && qKey.length > 0) key.value = qKey
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
      {{ mode === 'create' ? 'Create account' : 'Login' }}
    </h1>

    <div v-if="mode === 'create'" class="mt-6 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm text-bordeaux/70">Choose your public id</span>
        <input
          v-model="desiredId"
          class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 font-mono text-sm outline-none focus:border-emerald-400/60"
          placeholder="e.g. le-bistrot"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>

      <button
        class="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-emerald-950 hover:bg-emerald-400"
        @click="createAccount"
      >
        Create → get master key
      </button>

      <div v-if="createError" class="rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
        {{ createError }}
      </div>

      <div v-if="masterKeyShown" class="rounded-xl bg-black/10 p-4">
        <div class="text-sm text-bordeaux/70">Master key (shown once):</div>
        <div class="mt-2 break-all font-mono text-sm">{{ masterKeyShown }}</div>
        <button
          class="mt-3 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15"
          @click="useMasterKeyToLogin"
        >
          Use this key to login
        </button>
      </div>
    </div>

    <div v-else class="mt-6 grid gap-3">
      <label class="grid gap-2">
        <span class="text-sm text-bordeaux/70">Key</span>
        <input
          v-model="key"
          class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 font-mono text-sm outline-none focus:border-emerald-400/60"
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
        Login
      </button>
    </div>

    <button class="mt-8 text-sm text-bordeaux/70 underline" @click="router.push('/')">
      Back
    </button>
  </main>
</template>
