<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiFetch } from '../lib/api'

const router = useRouter()
const route = useRoute()

type FeedItem = {
  restaurant: { id: string; name: string; address: string; city?: string }
  post: { restaurantId: string; type: 'menu' | 'event'; createdAt: number; expiresAt: number }
}

type FeedRes = { items: FeedItem[] }

const cityOptions = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Nice']

const city = ref<string>(String(route.query.city ?? 'Paris'))
const loading = ref<boolean>(false)
const error = ref<string>('')
const items = ref<FeedItem[]>([])

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function menuImgUrl(id: string, createdAt: number) {
  const t = Number.isFinite(createdAt) && createdAt > 0 ? `?t=${createdAt}` : ''
  return `${apiFetchBase()}/api/public/${id}/post/menu${t}`
}

const menuItems = computed(() => items.value.filter((it) => it?.post?.type === 'menu' && it?.restaurant?.id))

async function load() {
  loading.value = true
  error.value = ''
  items.value = []
  try {
    const res = await apiFetch<FeedRes>(`/api/feed?city=${encodeURIComponent(city.value.trim())}`, { method: 'GET' })
    items.value = Array.isArray(res.items) ? res.items : []
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'feed_error'
  } finally {
    loading.value = false
  }
}

function onCityChange() {
  router.replace({ path: '/feed', query: { city: city.value } })
}

function openRestaurant(id: string) {
  if (!id) return
  router.push(`/r/${id}`)
}

onMounted(() => {
  load()
})

watch(
  () => route.query.city,
  (v) => {
    const next = typeof v === 'string' && v.trim().length > 0 ? v.trim() : 'Paris'
    if (next !== city.value) city.value = next
    load()
  }
)
</script>

<template>
  <main class="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden">
    <div class="sticky top-0 z-[60] px-6 pt-4 backdrop-blur">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <select
            v-model="city"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-primary outline-none"
            @change="onCityChange"
          >
            <option v-for="c in cityOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="text-xl font-semibold">Feed</div>
        <div class="w-12" />
      </div>

      <div v-if="error" class="mt-3 rounded-xl bg-black/5 p-4 text-sm text-primary/70">{{ error }}</div>
    </div>

    <section class="flex-1 overflow-y-auto px-6 pb-24 pt-4">
      <div v-if="loading" class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">Chargement…</div>

      <div v-else-if="menuItems.length === 0" class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">
        Aucun menu du jour pour cette ville.
      </div>

      <div v-else class="grid grid-cols-1 gap-4">
        <button
          v-for="it in menuItems"
          :key="`${it.restaurant.id}:${it.post.createdAt}`"
          class="overflow-hidden rounded-2xl bg-black/5 text-left"
          type="button"
          @click="openRestaurant(it.restaurant.id)"
        >
          <div class="aspect-[4/5] overflow-hidden bg-black/10">
            <img class="h-full w-full object-cover" :src="menuImgUrl(it.restaurant.id, it.post.createdAt)" alt="Menu" />
          </div>
          <div class="p-4">
            <div class="text-base font-semibold text-primary">{{ it.restaurant.name }}</div>
            <div class="mt-1 text-sm text-primary/70">{{ it.restaurant.address }}</div>
          </div>
        </button>
      </div>
    </section>
  </main>
</template>
