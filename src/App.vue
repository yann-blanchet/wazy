<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const showBottomNav = computed(() => {
  return route.path === '/dashboard' || route.path === '/restaurant' || route.path === '/share'
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
      <div class="mx-auto grid max-w-lg grid-cols-3 gap-2">
        <button
          class="grid justify-items-center gap-1 rounded-xl px-2 py-2 text-[11px]"
          :class="active === '/dashboard' ? 'bg-black/5 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
          @click="router.push('/dashboard')"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5">
            <path d="M4 10.5l8-7 8 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M6.5 9.5V20h11V9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Menus
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
            <path
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4.5 12a7.5 7.5 0 0113.39-4.5M19.5 12a7.5 7.5 0 01-13.39 4.5"
            />
            <path
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z"
            />
            <path
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 2.25v2.1M12 19.65v2.1M4.35 12H2.25M21.75 12h-2.1M5.1 5.1l1.49 1.49M17.41 17.41l1.49 1.49M18.9 5.1l-1.49 1.49M6.59 17.41L5.1 18.9"
            />
          </svg>
          Paramètres
        </button>
      </div>
    </div>
  </div>
</template>
