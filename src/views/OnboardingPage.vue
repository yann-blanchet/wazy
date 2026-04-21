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
const status = ref<string>('')
const saving = ref<boolean>(false)

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

const nameInputEl = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    if (!auth.key) {
      await router.replace('/login')
      return
    }

    const res = await apiFetch<{ restaurant: { name: string; address: string; city?: string; phone: string; cuisineType?: string } }>(
      '/api/restaurant',
      { method: 'GET', key: auth.key }
    )

    name.value = res.restaurant.name ?? ''
    address.value = res.restaurant.address ?? ''
    city.value = res.restaurant.city ?? ''
    phone.value = res.restaurant.phone ?? ''
    cuisineType.value = res.restaurant.cuisineType ?? ''

    queueMicrotask(() => nameInputEl.value?.focus())
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'load_error'
  }
})

async function save() {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    if (name.value.trim().length === 0) throw new Error('missing_name')

    saving.value = true
    status.value = ''

    await apiFetch('/api/restaurant', {
      method: 'PUT',
      key: auth.key,
      body: {
        name: name.value,
        address: address.value,
        city: city.value,
        phone: phone.value
        ,
        cuisineType: cuisineType.value
      }
    })

    await router.replace('/dashboard')
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'save_error'
  } finally {
    saving.value = false
  }
}

async function skip() {
  await router.replace('/dashboard')
}

function pickCuisine(v: string) {
  cuisineType.value = v
  cuisineSheetOpen.value = false
}
</script>

<template>
  <main class="min-h-dvh bg-beige">
    <div
      class="sticky top-0 z-10 border-b border-black/10 bg-beige px-5 py-4"
      style="padding-top: max(env(safe-area-inset-top), 16px)"
    >
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-bordeaux">Create your restaurant</div>
        <button class="text-sm text-bordeaux/70 underline" @click="skip">Skip</button>
      </div>
    </div>

    <div class="mx-auto grid max-w-lg gap-4 px-5 pb-24 pt-6" style="padding-bottom: max(env(safe-area-inset-bottom), 96px)">
      <div class="grid gap-1">
        <div class="text-base font-semibold text-bordeaux">Restaurant details</div>
        <div class="text-sm text-bordeaux/70">Used on your public page.</div>
      </div>

      <div class="grid gap-3 rounded-2xl bg-black/5 p-5">
        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Name</span>
          <input
            v-model="name"
            ref="nameInputEl"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="organization"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Address</span>
          <input
            v-model="address"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="street-address"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">City</span>
          <input
            v-model="city"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="address-level2"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Phone</span>
          <input
            v-model="phone"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="tel"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Type de cuisine</span>
          <input
            v-model="cuisineType"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="off"
            readonly
            @click="cuisineSheetOpen = true"
          />
        </label>

        <button
          class="mt-1 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          :disabled="saving || name.trim().length === 0"
          @click="save"
        >
          Save and continue
        </button>

        <div v-if="status" class="text-sm text-slate-300">{{ status }}</div>
      </div>

      <div class="text-xs text-slate-400">
        You can change this later in Settings.
      </div>
    </div>

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
