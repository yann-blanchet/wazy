<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../lib/api'

const router = useRouter()

const LS_KEY = 'vazy_admin_token'

const token = ref<string>('')
const status = ref<string>('')
const seeding = ref<boolean>(false)
const purging = ref<boolean>(false)

const city = ref<string>('Paris')
const centerLat = ref<string>('48.8566')
const centerLng = ref<string>('2.3522')
const radiusMeters = ref<string>('2000')
const count = ref<string>('20')

const imagePrefix = ref<string>('seeds/photos/')

function bearer() {
  const t = token.value.trim()
  if (!t) throw new Error('missing_admin_token')
  return t
}

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'resto' } })
}

async function seed() {
  try {
    status.value = ''
    seeding.value = true

    const n = Number(count.value)
    const lat = Number(centerLat.value)
    const lng = Number(centerLng.value)
    const r = Number(radiusMeters.value)

    if (!Number.isFinite(n) || n <= 0 || n > 200) throw new Error('invalid_count')
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('invalid_lat')
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('invalid_lng')
    if (!Number.isFinite(r) || r <= 0 || r > 20000) throw new Error('invalid_radius')
    if (city.value.trim().length === 0) throw new Error('missing_city')
    if (imagePrefix.value.trim().length === 0) throw new Error('missing_image_prefix')

    const res = await apiFetch<{ ok: boolean; created: Array<{ id: string; ownerCode: string; staffCode: string }> }>('/api/admin/seed', {
      method: 'POST',
      key: bearer(),
      body: {
        count: n,
        city: city.value.trim(),
        centerLat: lat,
        centerLng: lng,
        radiusMeters: r,
        imagePrefix: imagePrefix.value.trim()
      }
    })

    status.value = `OK: ${res.created.length} restaurants créés.`
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'seed_error'
  } finally {
    seeding.value = false
  }
}

async function purgeSeed() {
  try {
    status.value = ''
    purging.value = true

    const res = await apiFetch<{ ok: boolean; deleted: number }>('/api/admin/purge-seed', {
      method: 'POST',
      key: bearer()
    })

    status.value = `OK: ${res.deleted} restaurants seed supprimés.`
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'purge_error'
  } finally {
    purging.value = false
  }
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) token.value = raw
  } catch {
    // ignore
  }
})

function saveToken() {
  try {
    localStorage.setItem(LS_KEY, token.value.trim())
    status.value = 'Token enregistré.'
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'token_save_error'
  }
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <div class="text-2xl font-semibold">SuperAdmin</div>
      <button class="text-sm text-secondary underline" type="button" @click="goBack">Retour</button>
    </div>

    <section class="mt-6 grid gap-4 rounded-2xl bg-black/5 p-5">
      <label class="grid gap-2">
        <span class="text-sm text-primary/70">Admin token</span>
        <input v-model="token" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <button class="rounded-xl bg-black/10 px-4 py-3 text-sm font-medium text-primary hover:bg-black/15" type="button" @click="saveToken">
          Enregistrer token
        </button>
        <button class="rounded-xl bg-black/10 px-4 py-3 text-sm font-medium text-primary hover:bg-black/15" type="button" @click="purgeSeed" :disabled="purging">
          Purger seed
        </button>
      </div>
    </section>

    <section class="mt-4 grid gap-4 rounded-2xl bg-black/5 p-5">
      <div class="text-sm font-semibold text-primary">Seed (prod)</div>

      <div class="grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Ville</span>
          <input v-model="city" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 text-sm text-primary outline-none" />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-2">
            <span class="text-sm text-primary/70">Centre lat</span>
            <input v-model="centerLat" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
          </label>
          <label class="grid gap-2">
            <span class="text-sm text-primary/70">Centre lng</span>
            <input v-model="centerLng" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-2">
            <span class="text-sm text-primary/70">Rayon (m)</span>
            <input v-model="radiusMeters" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
          </label>
          <label class="grid gap-2">
            <span class="text-sm text-primary/70">Nombre restos</span>
            <input v-model="count" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
          </label>
        </div>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Préfixe R2 (dossier) contenant les images</span>
          <input v-model="imagePrefix" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" placeholder="seeds/photos/" />
        </label>

        <button class="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-background hover:bg-primary/90" type="button" @click="seed" :disabled="seeding">
          Seed restaurants + menu + event
        </button>

        <div v-if="status" class="text-sm text-primary/70">{{ status }}</div>
      </div>
    </section>
  </main>
</template>
