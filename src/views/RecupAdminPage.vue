<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const adminEmail = ref<string>('')
const adminEmailStatus = ref<string>('')

const recoveryEmail = ref<string>('')
const recoveryToken = ref<string>('')
const recoveryStatus = ref<string>('')
const recoveredMasterKey = ref<string>('')

onMounted(async () => {
  try {
    if (!auth.key || !auth.isMaster) return
    const res = await apiFetch<{ adminEmail: string }>('/api/account/admin-email', {
      method: 'GET',
      key: auth.key
    })
    adminEmail.value = res.adminEmail ?? ''
    recoveryEmail.value = adminEmail.value
  } catch {
    adminEmail.value = ''
  }
})

async function saveAdminEmail() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    if (!auth.isMaster) throw new Error('forbidden')
    adminEmailStatus.value = 'Enregistrement…'
    const res = await apiFetch<{ adminEmail: string }>('/api/account/admin-email', {
      method: 'PUT',
      key: auth.key,
      body: { adminEmail: adminEmail.value }
    })
    adminEmail.value = res.adminEmail ?? ''
    recoveryEmail.value = adminEmail.value
    adminEmailStatus.value = 'Enregistré.'
  } catch (e) {
    adminEmailStatus.value = e instanceof Error ? e.message : 'save_error'
  }
}

async function requestRecoveryToken() {
  try {
    recoveryStatus.value = 'Envoi…'
    recoveredMasterKey.value = ''
    await apiFetch<{ ok: true }>('/api/account/recovery/request', {
      method: 'POST',
      body: { id: auth.id ?? '', adminEmail: recoveryEmail.value }
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
      body: { id: auth.id ?? '', token: recoveryToken.value }
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

async function back() {
  await router.push({ path: '/dashboard', query: { tab: 'compte' } })
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Admin</h1>
      <button class="text-sm text-bordeaux/70 underline" type="button" @click="back">Retour</button>
    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold text-bordeaux">Email admin</h2>
      <p class="mt-1 text-sm text-bordeaux/70">Utilisé pour récupérer et régénérer la clé maître.</p>

      <div v-if="auth.isMaster" class="mt-4 grid gap-2">
        <input
          v-model="adminEmail"
          type="email"
          class="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
          placeholder="admin@restaurant.com"
          autocomplete="email"
        />
        <button
          class="w-full rounded-xl bg-black/10 px-4 py-3 text-sm text-bordeaux hover:bg-black/15"
          type="button"
          @click="saveAdminEmail"
        >
          Enregistrer l’email admin
        </button>
        <div v-if="adminEmailStatus" class="text-xs text-bordeaux/70">{{ adminEmailStatus }}</div>
      </div>

      <div v-else class="mt-4 text-sm text-bordeaux/70">Disponible uniquement avec la clé maître.</div>
    </section>

    <section class="mt-4 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold text-bordeaux">Récupération clé maître</h2>
      <p class="mt-1 text-sm text-bordeaux/70">Envoie un code par email, puis régénère la clé maître.</p>

      <div class="mt-4 grid gap-2">
        <input
          v-model="recoveryEmail"
          type="email"
          class="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
          placeholder="Email admin"
          autocomplete="email"
        />

        <button
          class="w-full rounded-xl bg-black/10 px-4 py-3 text-sm text-bordeaux hover:bg-black/15"
          type="button"
          @click="requestRecoveryToken"
        >
          Envoyer le code
        </button>

        <input
          v-model="recoveryToken"
          class="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-bordeaux outline-none focus:border-bordeaux/60"
          placeholder="Code reçu par email"
          autocomplete="one-time-code"
        />

        <button
          class="w-full rounded-xl bg-bordeaux px-4 py-3 text-sm font-semibold text-beige hover:bg-bordeaux/90"
          type="button"
          :disabled="recoveryToken.trim().length === 0"
          @click="confirmRecoveryToken"
        >
          Confirmer et régénérer la clé maître
        </button>

        <div v-if="recoveredMasterKey" class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Nouvelle clé maître :</div>
          <div class="mt-1 break-all font-mono text-sm text-bordeaux">{{ recoveredMasterKey }}</div>
          <button
            class="mt-2 rounded-lg bg-black/10 px-3 py-2 text-sm text-bordeaux hover:bg-black/15"
            type="button"
            @click="copyRecoveredMasterKey"
          >
            Copier
          </button>
        </div>

        <div v-if="recoveryStatus" class="text-xs text-bordeaux/70">{{ recoveryStatus }}</div>
      </div>
    </section>
  </main>
</template>
