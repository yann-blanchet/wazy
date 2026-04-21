<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const showBottomNav = computed(() => {
  return route.path === '/dashboard' || route.path === '/restaurant' || route.path === '/share' || route.path === '/history'
})

const active = computed(() => route.path)
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
          Dashboard
        </button>
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/restaurant' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push('/restaurant')"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M6 20V9a2 2 0 012-2h8a2 2 0 012 2v11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Restaurant
        </button>
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/share' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push('/share')"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M16 8a3 3 0 10-2.8-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M8 14a3 3 0 100 6 3 3 0 000-6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M17 13a3 3 0 100 6 3 3 0 000-6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M10.6 16.1l4.8 2.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M15.4 5.3l-4.8 2.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          Partager
        </button>
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/history' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push('/history')"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M3 5h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M7 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M17 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M6 9h12v12H6z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M9 13h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M9 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          History
        </button>
      </div>
    </div>
  </div>
</template>
