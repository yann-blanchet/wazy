<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

onMounted(async () => {
  auth.logout()
  await router.replace('/login')
})
</script>

<template>
  <main class="min-h-dvh bg-background" />
</template>
