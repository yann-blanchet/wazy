<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

type MenuItem = { date: string; createdAt: number }

const menus = ref<MenuItem[]>([])
const error = ref<string>('')

function apiBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

const tiles = computed(() => {
  const id = auth.id
  if (!id) return [] as { date: string; url: string }[]
  return menus.value.map((m) => ({
    date: m.date,
    url: `${apiBase()}/api/public/${id}/menu/${m.date}`
  }))
})

async function load() {
  error.value = ''
  menus.value = []
  try {
    if (!auth.key) throw new Error('missing_auth')
    const res = await apiFetch<{ id: string; menus: MenuItem[] }>('/api/menus', {
      method: 'GET',
      key: auth.key
    })
    menus.value = res.menus
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'load_error'
  }
}

onMounted(load)
</script>

<template>
  <main class="mx-auto max-w-4xl p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">History</h1>
      <button class="text-sm text-primary/70 underline" @click="router.push('/dashboard')">
        Back
      </button>
    </div>

    <div v-if="error" class="mt-6 rounded-xl bg-black/5 p-4 text-sm text-primary/70">
      {{ error }}
    </div>

    <div v-else class="mt-6">
      <div v-if="tiles.length === 0" class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">
        No photos yet.
      </div>

      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        <a
          v-for="t in tiles"
          :key="t.date"
          class="group overflow-hidden rounded-2xl bg-black/10"
          :href="t.url"
          target="_blank"
          rel="noreferrer"
        >
          <div class="aspect-[4/5] overflow-hidden">
            <img class="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" :src="t.url" :alt="t.date" />
          </div>
          <div class="px-3 py-2 text-xs text-primary/70">{{ t.date }}</div>
        </a>
      </div>
    </div>
  </main>
</template>
