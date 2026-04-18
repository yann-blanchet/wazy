<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <h1 class="text-3xl font-semibold tracking-tight">Vazy</h1>
    <p class="mt-2 text-slate-300">
      Publish today’s menu with one photo.
    </p>

    <div class="mt-8 grid gap-3">
      <button
        class="rounded-xl bg-white/10 px-4 py-3 text-left hover:bg-white/15"
        @click="router.push('/login')"
      >
        Login
      </button>

      <button
        class="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-emerald-950 hover:bg-emerald-400"
        @click="router.push('/login?mode=create')"
      >
        Create account
      </button>
    </div>

    <p class="mt-8 text-sm text-slate-400">
      Tip: staff can login via QR code.
    </p>
  </main>
</template>
