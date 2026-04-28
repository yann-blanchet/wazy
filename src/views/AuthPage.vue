<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const status = ref<string>('')

const token = computed(() => {
  const t = route.query.t
  return typeof t === 'string' ? t.trim() : ''
})

onMounted(async () => {
  try {
    if (auth.isAuthed) {
      await router.replace('/dashboard')
      return
    }

    if (!token.value) {
      status.value = 'Lien invalide.'
      return
    }

    status.value = 'Connexion…'
    await auth.loginWithQrToken(token.value)
    await router.replace('/dashboard')
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'auth_failed'
  }
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <h1 class="text-2xl font-semibold">Connexion</h1>
    <p class="mt-3 text-sm text-primary/70">{{ status || '—' }}</p>

    <button class="mt-6 rounded-xl bg-primary px-4 py-3 font-medium text-background hover:bg-primary/90" type="button" @click="router.replace('/')">
      Aller à la page de connexion
    </button>
  </main>
</template>
