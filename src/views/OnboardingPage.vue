<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const router = useRouter()
const auth = useAuthStore()

const name = ref<string>('')
const address = ref<string>('')
const phone = ref<string>('')
const status = ref<string>('')
const saving = ref<boolean>(false)

const nameInputEl = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  try {
    if (!auth.key) {
      await router.replace('/login')
      return
    }

    const res = await apiFetch<{ restaurant: { name: string; address: string; phone: string } }>(
      '/api/restaurant',
      { method: 'GET', key: auth.key }
    )

    name.value = res.restaurant.name ?? ''
    address.value = res.restaurant.address ?? ''
    phone.value = res.restaurant.phone ?? ''

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
        phone: phone.value
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
</script>

<template>
  <main class="min-h-dvh bg-slate-950">
    <div
      class="sticky top-0 z-10 border-b border-white/10 bg-slate-950 px-5 py-4"
      style="padding-top: max(env(safe-area-inset-top), 16px)"
    >
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-slate-200">Create your restaurant</div>
        <button class="text-sm text-slate-300 underline" @click="skip">Skip</button>
      </div>
    </div>

    <div class="mx-auto grid max-w-lg gap-4 px-5 pb-24 pt-6" style="padding-bottom: max(env(safe-area-inset-bottom), 96px)">
      <div class="grid gap-1">
        <div class="text-base font-semibold text-slate-100">Restaurant details</div>
        <div class="text-sm text-slate-300">Used on your public page.</div>
      </div>

      <div class="grid gap-3 rounded-2xl bg-white/5 p-5">
        <label class="grid gap-2">
          <span class="text-sm text-slate-300">Name</span>
          <input
            v-model="name"
            ref="nameInputEl"
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
          <span class="text-sm text-slate-300">Phone</span>
          <input
            v-model="phone"
            class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            autocomplete="tel"
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
  </main>
</template>
