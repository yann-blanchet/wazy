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

async function saveProfile() {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    profileStatus.value = 'Saving…'
    await apiFetch('/api/restaurant', {
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
    profileStatus.value = 'Saved.'
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'save_error'
  }
}

async function logout() {
  auth.logout()
  await router.push('/login')
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="text-2xl font-semibold">Restaurant</div>

    <section class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Infos</h2>
      <p class="mt-1 text-sm text-slate-300">Shown on the public page.</p>

      <div class="mt-4 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Name</span>
          <input
            v-model="name"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="organization"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Address</span>
          <input
            v-model="address"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="street-address"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-slate-300">City</span>
          <input
            v-model="city"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="address-level2"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Phone</span>
          <input
            v-model="phone"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="tel"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Type de cuisine</span>
          <input
            v-model="cuisineType"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="off"
            readonly
            @click="cuisineSheetOpen = true"
          />
        </label>

        <button
          class="rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15"
          :disabled="!auth.isMaster"
          @click="saveProfile"
        >
          Save restaurant info
        </button>

        <div v-if="profileStatus" class="text-sm text-slate-300">{{ profileStatus }}</div>
      </div>
    </section>

    <section class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Session</h2>
      <p class="mt-1 text-sm text-slate-300">Sign out from this device.</p>

      <button class="mt-4 w-full rounded-xl bg-white/10 px-4 py-3 hover:bg-white/15" @click="logout">
        Logout
      </button>
    </section>

    <div v-if="cuisineSheetOpen" class="fixed inset-0 z-[80]">
      <div class="absolute inset-0 bg-black/60" @click="cuisineSheetOpen = false" />
      <div
        class="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 bg-slate-950 px-5 py-4"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-slate-200">Type de cuisine</div>
          <button class="text-sm text-slate-300 underline" @click="cuisineSheetOpen = false">Close</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            v-for="c in cuisineOptions"
            :key="c"
            class="rounded-xl bg-white/5 px-4 py-3 text-sm text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
            @click="pickCuisine(c)"
          >
            {{ c }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
