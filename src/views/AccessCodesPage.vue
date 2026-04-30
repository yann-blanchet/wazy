<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const canUsePage = computed(() => auth.isMaster)

const status = ref<string>('')
const ownerCode = ref<string>('')
const staffCode = ref<string>('')

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'resto' } })
}

async function resetCodes() {
  status.value = ''
  ownerCode.value = ''
  staffCode.value = ''
  try {
    if (!auth.key) throw new Error('missing_auth')
    if (!auth.isMaster) throw new Error('forbidden')
    status.value = 'Génération…'
    const res = await apiFetch<{ ownerCode: string; staffCode: string }>('/api/auth/reset', {
      method: 'POST',
      key: auth.key
    })
    ownerCode.value = res.ownerCode
    staffCode.value = res.staffCode
    status.value = 'OK'
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'reset_failed'
  }
}

async function copyCode(v: string) {
  if (!v) return
  await navigator.clipboard.writeText(v)
}

onMounted(async () => {
  if (!canUsePage.value) return
  status.value = 'Clique sur “Régénérer” pour obtenir les codes.'
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Codes d’accès</h1>
      <button class="text-sm text-secondary underline hover:text-secondary/80" type="button" @click="goBack">Retour</button>
    </div>

    <div v-if="!canUsePage" class="mt-6 rounded-2xl bg-black/5 p-5 text-sm text-primary/70">
      Disponible uniquement avec le code admin.
    </div>

    <template v-else>
      <section class="mt-6 rounded-2xl bg-black/5 p-5">
        <h2 class="text-lg font-semibold text-primary">Régénération</h2>
        <p class="mt-1 text-sm text-primary/70">Les anciens codes seront invalides.</p>

        <button
          class="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-background hover:bg-primary/90"
          type="button"
          @click="resetCodes"
        >
          Régénérer les codes
        </button>

        <div v-if="status" class="mt-3 text-xs text-primary/70">{{ status }}</div>

        <div v-if="ownerCode" class="mt-4 rounded-xl bg-black/10 p-4">
          <div class="text-xs text-primary/70">Code admin</div>
          <div class="mt-1 break-all font-mono text-sm text-primary">{{ ownerCode }}</div>
          <button class="mt-3 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15" type="button" @click="copyCode(ownerCode)">
            Copier
          </button>
        </div>

        <div v-if="staffCode" class="mt-3 rounded-xl bg-black/10 p-4">
          <div class="text-xs text-primary/70">Code employés</div>
          <div class="mt-1 break-all font-mono text-sm text-primary">{{ staffCode }}</div>
          <button class="mt-3 rounded-lg bg-black/10 px-3 py-2 text-sm hover:bg-black/15" type="button" @click="copyCode(staffCode)">
            Copier
          </button>
        </div>
      </section>
    </template>
  </main>
</template>
