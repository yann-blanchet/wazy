<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { apiFetch } from '../lib/api'

const route = useRoute()
const id = computed(() => String(route.params.id || ''))

type PublicRes = {
  restaurant: { id: string; name: string; address: string; city?: string; phone: string; cuisineType?: string }
  menus: { date: string }[]
  permanentMenu?: { updatedAt: number } | null
  permanentMenus?: { id: string; createdAt: number }[]
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

const permanentMenus = computed(() => data.value?.permanentMenus ?? [])

function permanentMenuItemUrl(pid: string, t?: number) {
  if (!id.value) return ''
  const q = typeof t === 'number' && t > 0 ? `?t=${t}` : ''
  return `${apiFetchBase()}/api/public/${id.value}/permanent-menu/${pid}${q}`
}

const publicPageUrl = computed(() => {
  if (!id.value) return ''
  return `${window.location.origin}/r/${id.value}`
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

function upsertJsonLd() {
  if (typeof document === 'undefined') return
  const r = data.value?.restaurant
  if (!r || !r.name) return

  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: r.name,
    url: publicPageUrl.value,
    telephone: r.phone || undefined,
    servesCuisine: r.cuisineType || undefined,
    address: r.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: r.address,
          addressLocality: r.city || undefined
        }
      : undefined
  }

  const idAttr = 'restaurant-jsonld'
  let el = document.getElementById(idAttr) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = idAttr
    document.head.appendChild(el)
  }
  el.text = JSON.stringify(payload)
}

watch([data, id], () => upsertJsonLd(), { deep: true })

onUnmounted(() => {
  if (typeof document === 'undefined') return
  const el = document.getElementById('restaurant-jsonld')
  el?.remove()
})
</script>

<template>
  <main class="mx-auto max-w-xl p-4">
    <div class="rounded-3xl bg-black/5 p-5">
      <div class="text-sm text-primary/70">Restaurant</div>
      <h1 class="mt-1 text-2xl font-semibold">{{ data?.restaurant.name || id }}</h1>

      <div v-if="error" class="mt-4 rounded-xl bg-black/5 p-4 text-sm text-primary/70">
        {{ error }}
      </div>

      <div class="mt-4 aspect-[4/5] overflow-hidden rounded-2xl bg-black/10">
        <img v-if="todayImgUrl" class="h-full w-full object-cover" :src="todayImgUrl" alt="Today's menu" />
        <div v-else class="flex h-full items-center justify-center text-sm text-primary/70">No menu yet</div>
      </div>

      <div v-if="permanentMenus.length > 0" class="mt-6">
        <div class="text-sm font-medium text-primary">Permanent menu</div>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <a
            v-for="m in permanentMenus"
            :key="m.id"
            class="aspect-[4/5] overflow-hidden rounded-2xl bg-black/10"
            :href="permanentMenuItemUrl(m.id, m.createdAt)"
            target="_blank"
            rel="noreferrer"
          >
            <img class="h-full w-full object-cover" :src="permanentMenuItemUrl(m.id, m.createdAt)" :alt="m.id" />
          </a>
        </div>
      </div>

      <div class="mt-5 grid gap-1 text-sm text-primary/70">
        <div>Name: {{ data?.restaurant.name || '—' }}</div>
        <div>Address: {{ data?.restaurant.address || '—' }}</div>
        <div>City: {{ data?.restaurant.city || '—' }}</div>
        <div>Phone: {{ data?.restaurant.phone || '—' }}</div>
        <div>Type de cuisine: {{ data?.restaurant.cuisineType || '—' }}</div>
      </div>

      <div class="mt-6">
        <div class="text-sm font-medium text-primary">Last menus</div>
        <div class="mt-3 grid grid-cols-3 gap-2">
          <a
            v-for="d in menuDates"
            :key="d"
            class="aspect-square overflow-hidden rounded-xl bg-black/10"
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
