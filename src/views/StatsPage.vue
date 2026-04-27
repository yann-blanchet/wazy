<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'
import { uploadQueueCount } from '../lib/uploadQueue'

const router = useRouter()
const auth = useAuthStore()

const queued = ref<number>(0)
const statsMenusCount = ref<number>(0)
const statsPhotosCount = ref<number>(0)
const statsPermanentMenusCount = ref<number>(0)

async function refreshStats() {
  queued.value = await uploadQueueCount()

  try {
    if (auth.key) {
      const res = await apiFetch<{ id: string; menus: { date: string; createdAt: number }[] }>('/api/menus', {
        method: 'GET',
        key: auth.key
      })
      statsMenusCount.value = Array.isArray(res.menus) ? res.menus.length : 0
    } else {
      statsMenusCount.value = 0
    }
  } catch {
    statsMenusCount.value = 0
  }

  try {
    if (auth.id) {
      const pub = await apiFetch<{ photos?: { id: string; createdAt: number }[]; permanentMenus?: { id: string; createdAt: number }[] }>(
        `/api/public/${auth.id}`,
        { method: 'GET' }
      )
      statsPhotosCount.value = Array.isArray(pub.photos) ? pub.photos.length : 0
      statsPermanentMenusCount.value = Array.isArray(pub.permanentMenus) ? pub.permanentMenus.length : 0
    } else {
      statsPhotosCount.value = 0
      statsPermanentMenusCount.value = 0
    }
  } catch {
    statsPhotosCount.value = 0
    statsPermanentMenusCount.value = 0
  }
}

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'compte' } })
}

onMounted(async () => {
  await refreshStats()
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <div class="w-12" />
      <div class="text-2xl font-semibold">Statistiques</div>
      
            <button class="text-sm text-bordeaux/70 underline" type="button" @click="goBack">Retour</button>

    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
      
      <p class="mt-1 text-sm text-bordeaux/70">Résumé de votre compte sur cet appareil.</p>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Uploads en attente</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ queued }}</div>
        </div>
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Menus</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ statsMenusCount }}</div>
        </div>
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Photos resto</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ statsPhotosCount }}</div>
        </div>
        <div class="rounded-xl bg-black/10 p-3">
          <div class="text-xs text-bordeaux/70">Cartes</div>
          <div class="mt-1 text-lg font-semibold text-bordeaux">{{ statsPermanentMenusCount }}</div>
        </div>
      </div>
    </section>
  </main>
</template>
