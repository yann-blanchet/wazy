<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <h1 class="text-3xl font-semibold tracking-tight">Vazy</h1>
    <p class="mt-2 text-bordeaux/70">
      Publiez le menu du jour avec une seule photo.
    </p>

    <div class="mt-8 grid gap-3">
      <button
        class="rounded-xl bg-black/10 px-4 py-3 text-left hover:bg-black/15"
        @click="router.push('/login')"
      >
        Connexion
      </button>

      <button
        class="rounded-xl bg-bordeaux px-4 py-3 font-medium text-beige hover:bg-bordeaux/90"
        @click="router.push('/login?mode=create')"
      >
        Créer un compte
      </button>
    </div>

    <p class="mt-8 text-sm text-bordeaux/70">
      Astuce : l’équipe peut se connecter via QR code.
    </p>
  </main>
</template>
