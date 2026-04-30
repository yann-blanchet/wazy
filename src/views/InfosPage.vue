<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const name = ref<string>('')
const address = ref<string>('')
const city = ref<string>('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const phone = ref<string>('')
const cuisineType = ref<string>('')
const profileStatus = ref<string>('')

type BanFeature = {
  type: 'Feature'
  properties: { label?: string; city?: string }
  geometry: { type: 'Point'; coordinates: [number, number] }
}

const addressSuggestions = ref<BanFeature[]>([])
const addressOpen = ref<boolean>(false)
const addressLoading = ref<boolean>(false)
let addressTimer: number | null = null
let addressAbort: AbortController | null = null

async function searchBan(q: string) {
  const query = q.trim()
  if (query.length < 3) {
    addressSuggestions.value = []
    addressOpen.value = false
    return
  }

  if (addressAbort) addressAbort.abort()
  addressAbort = new AbortController()
  addressLoading.value = true
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=6`
    const res = await fetch(url, { signal: addressAbort.signal })
    const data = (await res.json()) as { features?: BanFeature[] }
    addressSuggestions.value = Array.isArray(data.features) ? data.features : []
    addressOpen.value = addressSuggestions.value.length > 0
  } finally {
    addressLoading.value = false
  }
}

function pickAddress(f: BanFeature) {
  const label = String(f.properties?.label ?? '').trim()
  const nextCity = String(f.properties?.city ?? '').trim()
  const coords = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : null
  if (label) address.value = label
  if (nextCity) city.value = nextCity
  if (coords && coords.length === 2) {
    lng.value = Number(coords[0])
    lat.value = Number(coords[1])
  }
  addressOpen.value = false
  addressSuggestions.value = []
}

function closeAddressSuggestionsLater() {
  globalThis.setTimeout(() => {
    addressOpen.value = false
  }, 150)
}

watch(
  address,
  (v) => {
    if (addressTimer !== null) window.clearTimeout(addressTimer)
    addressTimer = window.setTimeout(() => {
      void searchBan(v)
    }, 250)
  },
  { flush: 'post' }
)

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
  await router.push({ path: '/dashboard', query: { tab: 'resto' } })
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
        lat: lat.value === null ? undefined : lat.value,
        lng: lng.value === null ? undefined : lng.value,
        phone: phone.value,
        cuisineType: cuisineType.value
      }
    })
    profileStatus.value = 'Enregistré.'
    await goBack()
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'save_error'
  }
}

onMounted(async () => {
  try {
    if (!auth.key) return
    const res = await apiFetch<{ restaurant: { name: string; address: string; city?: string; phone: string; cuisineType?: string; lat?: number; lng?: number } }>(
      '/api/restaurant',
      { method: 'GET', key: auth.key }
    )
    name.value = res.restaurant.name ?? ''
    address.value = res.restaurant.address ?? ''
    city.value = res.restaurant.city ?? ''
    phone.value = res.restaurant.phone ?? ''
    cuisineType.value = res.restaurant.cuisineType ?? ''
    lat.value = typeof res.restaurant.lat === 'number' ? res.restaurant.lat : null
    lng.value = typeof res.restaurant.lng === 'number' ? res.restaurant.lng : null
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'load_error'
  }
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <div class="text-2xl font-semibold">Infos restaurant</div>
      <div class="w-12" />
      <button class="text-sm text-secondary underline" type="button" @click="goBack">Retour</button>
    </div>

    <section class="mt-6 rounded-2xl p-5">
 
      <div class="mt-4 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Nom</span>
          <input
            v-model="name"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none focus:border-primary/60"
            autocomplete="organization"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Adresse</span>
          <div class="relative">
            <input
              v-model="address"
              class="w-full rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none focus:border-primary/60"
              autocomplete="street-address"
              @focus="addressOpen = addressSuggestions.length > 0"
              @blur="closeAddressSuggestionsLater"
            />
            <div
              v-if="addressOpen"
              class="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-xl border border-black/10 bg-background shadow-lg"
            >
              <div v-if="addressLoading" class="px-3 py-2 text-xs text-primary/60">Recherche…</div>
              <button
                v-for="s in addressSuggestions"
                :key="String(s.properties?.label ?? '') + String(s.geometry?.coordinates?.[0] ?? '')"
                class="block w-full px-3 py-3 text-left text-sm text-primary hover:bg-black/5"
                type="button"
                @click="pickAddress(s)"
              >
                {{ s.properties?.label ?? '' }}
              </button>
            </div>
          </div>
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Ville</span>
          <input
            v-model="city"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none focus:border-primary/60"
            autocomplete="address-level2"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Téléphone</span>
          <input
            v-model="phone"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none focus:border-primary/60"
            autocomplete="tel"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Type de cuisine</span>
          <input
            v-model="cuisineType"
            class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none focus:border-primary/60"
            autocomplete="off"
            readonly
            @click="cuisineSheetOpen = true"
          />
        </label>

        

        <div v-if="profileStatus" class="text-sm text-primary/70">{{ profileStatus }}</div>
      </div>
    </section>
<div
      class="fixed inset-x-0 bottom-0 z-[80] border-t border-black/10 px-4 py-3 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 12px)"
    >
      <div class="mx-auto max-w-lg">
        <button
          class="w-full rounded-xl bg-cta px-4 py-3 text-sm font-semibold text-background shadow-lg shadow-black/20 hover:bg-primary/90"
          type="button"
          :disabled="!auth.isMaster" @click="saveProfile"
        >
          Enregistrer
        </button>
      </div>
    </div>
    <div v-if="cuisineSheetOpen" class="fixed inset-0 z-[80]">
      <div class="absolute inset-0 bg-black/60" @click="cuisineSheetOpen = false" />
      <div
        class="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-black/10 bg-background px-5 py-4"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-primary">Type de cuisine</div>
          <button class="text-sm text-primary/70 underline" type="button" @click="cuisineSheetOpen = false">Fermer</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            v-for="c in cuisineOptions"
            :key="c"
            class="rounded-xl bg-black/5 px-4 py-3 text-sm text-primary ring-1 ring-black/10 hover:bg-black/10"
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
