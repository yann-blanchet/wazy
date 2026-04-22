<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const showBottomNav = computed(() => {
  return route.path === '/dashboard' || route.path === '/restaurant' || route.path === '/share'
})

const active = computed(() => {
  if (route.path === '/restaurant') {
    const tab = route.query.tab
    if (tab === 'carte') return '/restaurant?tab=carte'
    return '/restaurant?tab=infos'
  }
  return route.path
})
</script>

<template>
  <div class="min-h-dvh">
    <RouterView />

    <div
      v-if="showBottomNav"
      class="fixed inset-x-0 bottom-0 z-[60] border-t border-black/10 bg-beige/95 px-4 py-2 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 8px)"
    >
      <div class="mx-auto grid max-w-lg grid-cols-4 gap-2">
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/dashboard' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push('/dashboard')"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M4 10.5l8-7 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M6.5 9.5V20h11V9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Menu
        </button>
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/restaurant?tab=carte' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push({ path: '/restaurant', query: { tab: 'carte' } })"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M6 4h12a2 2 0 012 2v13a1 1 0 01-1 1H7a1 1 0 01-1-1V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 8h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M8 16h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Carte
        </button>
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/restaurant?tab=infos' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push({ path: '/restaurant', query: { tab: 'infos' } })"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M6 20V9a2 2 0 012-2h8a2 2 0 012 2v11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Resto
        </button>
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/share' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push('/share')"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M12 14h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M12 8h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M3 7l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M3 13l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M3 19l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          QR
        </button>
      </div>
    </div>
  </div>
</template>
