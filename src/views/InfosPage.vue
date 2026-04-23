<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const name = ref<string>('')
const address = ref<string>('')
const city = ref<string>('')
const phone = ref<string>('')
const cuisineType = ref<string>('')
const profileStatus = ref<string>('')

const cuisineSheetOpen = ref<boolean>(false)

const cuisineOptions = [
  'Asiatique',
  'Bistrot',
  'Italien',
  'Indien',
  'Libanais',
  'Mexicain',
  'Burger',
  'Pizza',
  'Crêperie',
  'Boulangerie',
  'Gastronomique',
  'Végétarien'
]

function pickCuisine(v: string) {
  cuisineType.value = v
  cuisineSheetOpen.value = false
}

async function goBack() {
  if (window.history.length > 1) router.back()
  else await router.push('/dashboard')
}

async function saveProfile() {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    profileStatus.value = 'Enregistrement…'
    await apiFetch<{ ok: boolean }>('/api/restaurant', {
      method: 'PUT',
      key: auth.key,
      body: {
        name: name.value,
        address: address.value,
        city: city.value,
        phone: phone.value,
        cuisineType: cuisineType.value
      }
    })
    profileStatus.value = 'Enregistré.'
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'save_error'
  }
}

onMounted(async () => {
  try {
    if (!auth.key) return
    const res = await apiFetch<{ restaurant: { name: string; address: string; city?: string; phone: string; cuisineType?: string } }>(
      '/api/restaurant',
      { method: 'GET', key: auth.key }
    )
    name.value = res.restaurant.name ?? ''
    address.value = res.restaurant.address ?? ''
    city.value = res.restaurant.city ?? ''
    phone.value = res.restaurant.phone ?? ''
    cuisineType.value = res.restaurant.cuisineType ?? ''
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'load_error'
  }
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <div class="w-12" />
      <div class="text-2xl font-semibold">Infos restaurant</div>
      <button class="text-sm text-bordeaux/70 underline" type="button" @click="goBack">Retour</button>
    </div>

    <section class="mt-6 rounded-2xl bg-black/5 p-5">
 
      <div class="mt-4 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Nom</span>
          <input
            v-model="name"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="organization"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Adresse</span>
          <input
            v-model="address"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="street-address"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Ville</span>
          <input
            v-model="city"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="address-level2"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Téléphone</span>
          <input
            v-model="phone"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="tel"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Type de cuisine</span>
          <input
            v-model="cuisineType"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-bordeaux outline-none focus:border-bordeaux/60"
            autocomplete="off"
            readonly
            @click="cuisineSheetOpen = true"
          />
        </label>

        <button class="rounded-xl bg-black/10 px-4 py-3 hover:bg-black/15" :disabled="!auth.isMaster" @click="saveProfile">
          Enregistrer
        </button>

        <div v-if="profileStatus" class="text-sm text-bordeaux/70">{{ profileStatus }}</div>
      </div>
    </section>

    <div v-if="cuisineSheetOpen" class="fixed inset-0 z-[80]">
      <div class="absolute inset-0 bg-black/60" @click="cuisineSheetOpen = false" />
      <div
        class="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-black/10 bg-beige px-5 py-4"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-bordeaux">Type de cuisine</div>
          <button class="text-sm text-bordeaux/70 underline" type="button" @click="cuisineSheetOpen = false">Fermer</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            v-for="c in cuisineOptions"
            :key="c"
            class="rounded-xl bg-black/5 px-4 py-3 text-sm text-bordeaux ring-1 ring-black/10 hover:bg-black/10"
            type="button"
            @click="pickCuisine(c)"
          >
            {{ c }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
