<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const drawerOpen = ref(false)

const showDrawerButton = computed(() => {
  if (!auth.isAuthed) return false
  return route.path === '/dashboard'
})

async function go(path: string) {
  drawerOpen.value = false
  await router.push(path)
}

async function logout() {
  drawerOpen.value = false
  auth.logout()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-dvh">
    <RouterView />

    <button
      v-if="showDrawerButton"
      class="fixed right-4 top-4 z-[80] inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 text-bordeaux hover:bg-black/15"
      type="button"
      aria-label="Menu"
      title="Menu"
      @click="drawerOpen = true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
        <path d="M12 12h.01" />
        <path d="M12 6h.01" />
        <path d="M12 18h.01" />
      </svg>
    </button>

    <div v-if="drawerOpen" class="fixed inset-0 z-[90]">
      <div class="absolute inset-0 bg-black/50" @click="drawerOpen = false" />
      <aside
        class="absolute right-0 top-0 h-full w-72 border-l border-black/10 bg-beige p-4"
        style="padding-top: max(env(safe-area-inset-top), 16px)"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-bordeaux">Menu</div>
          <button class="text-sm text-bordeaux/70 underline" type="button" @click="drawerOpen = false">Fermer</button>
        </div>

        <div class="mt-4 grid gap-2">
          <button class="w-full rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/infos')">
            Infos
          </button>
          <button class="w-full rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/carte')">
            Carte
          </button>
          <button class="w-full rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/galerie')">
            Galerie
          </button>
          <button class="w-full rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/lien-public')">
            Lien public
          </button>
          <button class="w-full rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/equipe')">
            Équipe
          </button>
          <button class="w-full rounded-xl bg-black/5 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/10" type="button" @click="go('/stats')">
            Stats
          </button>
        </div>

        <div class="mt-6 border-t border-black/10 pt-4">
          <button class="w-full rounded-xl bg-black/10 px-4 py-3 text-left text-sm text-bordeaux hover:bg-black/15" type="button" @click="logout">
            Déconnexion
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>
