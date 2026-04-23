<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const workerKey = ref<string>('')
const workerKeySaving = ref(false)
const workerKeyStatus = ref<string>('')

const workerKeyTrimmed = computed(() => workerKey.value.trim())
const workerKeyValid = computed(() => {
  const k = workerKeyTrimmed.value
  if (k.length < 6 || k.length > 64) return false
  return /^[a-zA-Z0-9_-]+$/.test(k)
})
const workerKeyHasInput = computed(() => workerKeyTrimmed.value.length > 0)

async function goBack() {
  if (window.history.length > 1) router.back()
  else await router.push('/dashboard')
}

async function saveWorkerKey() {
  if (!auth.isMaster) return
  workerKeySaving.value = true
  workerKeyStatus.value = ''
  try {
    const res = await auth.setWorkerKey(workerKeyTrimmed.value)
    workerKey.value = res.workerKey
    workerKeyStatus.value = 'Code de connexion mis à jour.'
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'save_error'
    if (raw === 'invalid_worker_key') workerKeyStatus.value = 'Code invalide. Utilisez 6 à 64 caractères (lettres, chiffres, _ ou -).'
    else if (raw === 'key_taken') workerKeyStatus.value = 'Ce code est déjà utilisé. Choisissez-en un autre.'
    else if (raw === 'missing_auth') workerKeyStatus.value = 'Session expirée. Reconnectez-vous avec le compte maître.'
    else if (raw === 'forbidden') workerKeyStatus.value = 'Action réservée au compte maître.'
    else if (raw === 'invalid_key') workerKeyStatus.value = 'Code invalide. Reconnectez-vous.'
    else workerKeyStatus.value = raw
  } finally {
    workerKeySaving.value = false
  }
}

onMounted(async () => {
  try {
    if (!auth.key) return
    if (!auth.isMaster) return
    const k = await apiFetch<{ workerKey: string }>('/api/keys', { method: 'GET', key: auth.key })
    workerKey.value = k.workerKey
  } catch {
    workerKey.value = ''
  }
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <button class="text-sm text-bordeaux/70 underline" type="button" @click="goBack">Retour</button>
      <div class="text-2xl font-semibold">Équipe</div>
      <div class="w-12" />
    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold">Accès équipe</h2>

      <div v-if="!auth.isMaster" class="mt-4 rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
        Seul le compte maître peut voir et modifier le code de connexion.
      </div>

      <template v-else>
        <div class="mt-4 grid gap-2">
          <div class="text-sm text-bordeaux/70">Code de connexion pour l'équipe</div>
          <input
            v-model="workerKey"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
          />
          <div class="text-xs text-bordeaux/70">6–64 caractères. Lettres, chiffres, <span class="font-mono">_</span> et <span class="font-mono">-</span> uniquement.</div>
          <div v-if="workerKeyHasInput" class="text-xs" :class="workerKeyValid ? 'text-green-700' : 'text-red-700'">
            {{ workerKeyValid ? 'Code valide' : 'Code invalide' }}
          </div>
        </div>

        <div class="mt-4 grid gap-3">
          <button
            class="rounded-xl bg-black/10 px-4 py-3 hover:bg-black/15"
            type="button"
            :disabled="workerKeySaving || !workerKeyHasInput || !workerKeyValid"
            @click="saveWorkerKey"
          >
            Enregistrer le code
          </button>

          <div v-if="workerKeyStatus" class="text-sm text-bordeaux/70">{{ workerKeyStatus }}</div>
        </div>
      </template>
    </section>
  </main>
</template>
