<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const adminEmail = ref<string>('')
const adminEmailStatus = ref<string>('')

const recoveryDisabled = true

onMounted(async () => {
  try {
    if (!auth.key || !auth.isMaster) return
    const res = await apiFetch<{ adminEmail: string }>('/api/account/admin-email', {
      method: 'GET',
      key: auth.key
    })
    adminEmail.value = res.adminEmail ?? ''
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
    adminEmailStatus.value = 'Enregistré.'
  } catch (e) {
    adminEmailStatus.value = e instanceof Error ? e.message : 'save_error'
  }
}

async function back() {
  await router.push({ path: '/dashboard', query: { tab: 'compte' } })
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Admin</h1>
      <button class="text-sm text-secondary underline hover:text-secondary/80" type="button" @click="back">Retour</button>
    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold text-primary">Email admin</h2>
      <p class="mt-1 text-sm text-primary/70">Utilisé pour récupérer et régénérer la clé maître.</p>

      <div v-if="auth.isMaster" class="mt-4 grid gap-2">
        <input
          v-model="adminEmail"
          type="email"
          class="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none focus:border-primary/60"
          placeholder="admin@restaurant.com"
          autocomplete="email"
        />
        <button
          class="w-full rounded-xl bg-black/10 px-4 py-3 text-sm text-primary hover:bg-black/15"
          type="button"
          @click="saveAdminEmail"
        >
          Enregistrer l’email admin
        </button>
        <div v-if="adminEmailStatus" class="text-xs text-primary/70">{{ adminEmailStatus }}</div>
      </div>

      <div v-else class="mt-4 text-sm text-primary/70">Disponible uniquement avec la clé maître.</div>
    </section>

    <section v-if="recoveryDisabled" class="mt-4 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold text-primary">Récupération clé maître</h2>
      <p class="mt-1 text-sm text-primary/70">Désactivé pour le moment.</p>
    </section>
  </main>
</template>
