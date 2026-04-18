<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '../lib/api'

const route = useRoute()
const id = computed(() => String(route.params.id || ''))

type PublicRes = {
  restaurant: { id: string; name: string; address: string; phone: string }
  menus: { date: string }[]
}

const data = ref<PublicRes | null>(null)
const error = ref<string>('')
const today = new Date()
const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
  today.getDate()
).padStart(2, '0')}`

const menuDates = computed(() => data.value?.menus?.map((m) => m.date) ?? [])
const todayDate = computed(() => (menuDates.value.includes(todayISO) ? todayISO : menuDates.value[0] ?? ''))

const todayImgUrl = computed(() => {
  if (!id.value || !todayDate.value) return ''
  return `${apiFetchBase()}/api/public/${id.value}/menu/${todayDate.value}`
})

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

async function load() {
  error.value = ''
  data.value = null
  try {
    data.value = await apiFetch<PublicRes>(`/api/public/${id.value}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'load_error'
  }
}

onMounted(load)
watch(id, load)
</script>

<template>
  <main class="mx-auto max-w-xl p-4">
    <div class="rounded-3xl bg-white/5 p-5">
      <div class="text-sm text-slate-300">Restaurant</div>
      <h1 class="mt-1 text-2xl font-semibold">{{ data?.restaurant.name || id }}</h1>

      <div v-if="error" class="mt-4 rounded-xl bg-white/5 p-4 text-sm text-slate-300">
        {{ error }}
      </div>

      <div class="mt-4 aspect-[4/5] overflow-hidden rounded-2xl bg-black/30">
        <img v-if="todayImgUrl" class="h-full w-full object-cover" :src="todayImgUrl" alt="Today's menu" />
        <div v-else class="flex h-full items-center justify-center text-sm text-slate-400">No menu yet</div>
      </div>

      <div class="mt-5 grid gap-1 text-sm text-slate-300">
        <div>Name: {{ data?.restaurant.name || '—' }}</div>
        <div>Address: {{ data?.restaurant.address || '—' }}</div>
        <div>Phone: {{ data?.restaurant.phone || '—' }}</div>
      </div>

      <div class="mt-6">
        <div class="text-sm font-medium text-slate-200">Last menus</div>
        <div class="mt-3 grid grid-cols-3 gap-2">
          <a
            v-for="d in menuDates"
            :key="d"
            class="aspect-square overflow-hidden rounded-xl bg-black/30"
            :href="`${apiFetchBase()}/api/public/${id}/menu/${d}`"
            target="_blank"
            rel="noreferrer"
          >
            <img class="h-full w-full object-cover" :src="`${apiFetchBase()}/api/public/${id}/menu/${d}`" :alt="d" />
          </a>
        </div>
      </div>
    </div>
  </main>
</template>
