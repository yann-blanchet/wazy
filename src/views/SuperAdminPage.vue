<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../lib/api'

const router = useRouter()

function goBack() {
  router.back()
}

const LS_KEY = 'vazy_admin_token'

const token = ref<string>('')
const status = ref<string>('')
const tab = ref<'actions' | 'restaurants'>('actions')

const city = ref<string>('Toulouse')
const centerLat = ref<string>('43.6045')
const centerLng = ref<string>('1.4440')
const radiusMeters = ref<string>('1000')

const osmLimit = ref<string>('200')
const importingOsm = ref<boolean>(false)

const purgeAllConfirm = ref<string>('')
const purgingAll = ref<boolean>(false)

type AdminRestaurantItem = {
  id: string
  public: { id: string; name: string; address: string; city?: string; lat?: number; lng?: number }
}

async function purgeAll() {
  try {
    status.value = ''
    purgingAll.value = true

    let cursor: string | null = null
    let totalRestaurants = 0
    let totalObjects = 0

    type PurgeAllRes = { ok: boolean; deletedRestaurants: number; deletedR2Objects: number; cursor: string | null; done: boolean }

    for (let i = 0; i < 200; i++) {
      const res: PurgeAllRes = await apiFetch<PurgeAllRes>('/api/admin/purge-all', {
        method: 'POST',
        key: bearer(),
        body: { confirm: purgeAllConfirm.value, cursor }
      })

      totalRestaurants += res.deletedRestaurants
      totalObjects += res.deletedR2Objects
      cursor = res.cursor
      status.value = `Purge en cours… ${totalRestaurants} restaurants, ${totalObjects} objets (lot ${i + 1})`

      if (res.done) {
        status.value = `OK: purge-all — ${totalRestaurants} restaurants supprimés, ${totalObjects} objets R2 supprimés.`
        break
      }
    }
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'purge_all_error'
  } finally {
    purgingAll.value = false
  }
}

const restaurants = ref<AdminRestaurantItem[]>([])
const restaurantsCursor = ref<string | null>(null)
const restaurantsLoading = ref<boolean>(false)
const restaurantsError = ref<string>('')

const menuUploadingFor = ref<string>('')
const menuFileInput = ref<HTMLInputElement | null>(null)
const menuTargetRestaurantId = ref<string>('')

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function triggerAddMenu(restaurantId: string) {
  if (!restaurantId) return
  menuTargetRestaurantId.value = restaurantId
  menuFileInput.value?.click()
}

async function onPickMenuFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const restaurantId = menuTargetRestaurantId.value
  menuTargetRestaurantId.value = ''
  if (!restaurantId) return

  try {
    status.value = ''
    menuUploadingFor.value = restaurantId

    const contentType = file.type || 'image/jpeg'
    const date = todayISO()

    const presign = await apiFetch<{ objectKey: string; uploadUrl: string | null }>('/api/admin/menu/presign-upload', {
      method: 'POST',
      key: bearer(),
      body: { restaurantId, date, contentType }
    })

    if (presign.uploadUrl) {
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: file
      })
      if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

      await apiFetch<{ ok: boolean }>('/api/admin/menu/finalize', {
        method: 'POST',
        key: bearer(),
        body: { restaurantId, date }
      })
    } else {
      const putRes = await fetch(
        `${apiFetchBase()}/api/admin/menu/upload?restaurantId=${encodeURIComponent(restaurantId)}&date=${encodeURIComponent(date)}`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${bearer()}`,
            'content-type': contentType
          },
          body: file
        }
      )
      if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)
    }
    status.value = `OK: menu du jour uploadé pour ${restaurantId}.`
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'menu_upload_error'
  } finally {
    menuUploadingFor.value = ''
  }
}

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function bearer() {
  const t = token.value.trim()
  if (!t) throw new Error('missing_admin_token')
  return t
}

async function loadRestaurants(reset = false) {
  try {
    restaurantsError.value = ''
    restaurantsLoading.value = true
    if (reset) {
      restaurants.value = []
      restaurantsCursor.value = null
    }

    const cursor = reset ? null : restaurantsCursor.value
    const qs = new URLSearchParams()
    qs.set('limit', '50')
    if (cursor) qs.set('cursor', cursor)

    const res = await apiFetch<{ items: AdminRestaurantItem[]; cursor: string | null }>(`/api/admin/restaurants?${qs.toString()}`, {
      method: 'GET',
      key: bearer()
    })

    restaurants.value = [...restaurants.value, ...(Array.isArray(res.items) ? res.items : [])]
    restaurantsCursor.value = res.cursor
  } catch (e) {
    restaurantsError.value = e instanceof Error ? e.message : 'restaurants_load_error'
  } finally {
    restaurantsLoading.value = false
  }
}

watch(
  tab,
  async (t: 'actions' | 'restaurants') => {
    if (t === 'restaurants' && restaurants.value.length === 0 && !restaurantsLoading.value) {
      await loadRestaurants(true)
    }
  },
  { flush: 'post' }
)

async function importOsm() {
  try {
    status.value = ''
    importingOsm.value = true

    const limit = Number(osmLimit.value)
    const lat = Number(centerLat.value)
    const lng = Number(centerLng.value)
    const radius = Number(radiusMeters.value)

    if (!Number.isFinite(limit) || limit <= 0 || limit > 200) throw new Error('invalid_limit')
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('invalid_lat')
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('invalid_lng')
    if (!Number.isFinite(radius) || radius <= 0 || radius > 10000) throw new Error('invalid_radius')
    if (city.value.trim().length === 0) throw new Error('missing_city')

    type ImportOsmRes = {
      ok: boolean
      requested: number
      found: number
      imported: number
      created: number
      updated: number
      ids: string[]
      cursor: number | null
      done: boolean
    }

    let cursor: number | null = 0
    let totalImported = 0
    let totalCreated = 0
    let totalUpdated = 0
    let found = 0

    for (let i = 0; i < 50; i++) {
      const res: ImportOsmRes = await apiFetch<ImportOsmRes>('/api/admin/import-osm', {
        method: 'POST',
        key: bearer(),
        body: {
          city: city.value.trim(),
          centerLat: lat,
          centerLng: lng,
          radiusMeters: radius,
          limit,
          cursor
        }
      })

      found = res.found
      totalImported += res.imported
      totalCreated += res.created
      totalUpdated += res.updated
      cursor = res.cursor

      status.value = `Import OSM… ${totalImported}/${found} (créés ${totalCreated}, maj ${totalUpdated})`

      if (res.done) {
        status.value = `OK: ${totalCreated} créés, ${totalUpdated} mis à jour. (${totalImported}/${found})`
        break
      }
    }

    await loadRestaurants(true)
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'import_osm_error'
  } finally {
    importingOsm.value = false
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
      </div>
    </section>

    <section class="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/5 p-2">
      <button
        class="rounded-xl px-4 py-3 text-sm font-medium"
        type="button"
        :class="tab === 'actions' ? 'bg-black/10 text-primary' : 'text-primary/70 hover:bg-black/5'"
        @click="tab = 'actions'"
      >
        Actions
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm font-medium"
        type="button"
        :class="tab === 'restaurants' ? 'bg-black/10 text-primary' : 'text-primary/70 hover:bg-black/5'"
        @click="tab = 'restaurants'"
      >
        Restaurants
      </button>
    </section>

    <section v-if="tab === 'actions'" class="mt-4 grid gap-4">
      <section class="grid gap-4 rounded-2xl bg-black/5 p-5">
        <div class="text-sm font-semibold text-primary">Importer depuis OSM (amenity=restaurant)</div>

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

          <label class="grid gap-2">
            <span class="text-sm text-primary/70">Rayon (m)</span>
            <input v-model="radiusMeters" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
          </label>

          <label class="grid gap-2">
            <span class="text-sm text-primary/70">Limite (max 200)</span>
            <input v-model="osmLimit" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
          </label>

          <button class="rounded-xl bg-black/10 px-4 py-3 text-sm font-medium text-primary hover:bg-black/15" type="button" @click="importOsm" :disabled="importingOsm">
            Importer les restaurants (fiche seulement)
          </button>

          <div v-if="status" class="text-sm text-primary/70">{{ status }}</div>
        </div>
      </section>

      <section class="grid gap-4 rounded-2xl bg-black/5 p-5">
        <div class="text-sm font-semibold text-primary">Danger zone</div>

        <label class="grid gap-2">
          <span class="text-sm text-primary/70">Confirmation (tape: PURGE_ALL)</span>
          <input v-model="purgeAllConfirm" class="rounded-xl border border-black/10 bg-black/5 px-3 py-3 font-mono text-sm text-primary outline-none" />
        </label>

        <button
          class="rounded-xl bg-red-600/90 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600"
          type="button"
          :disabled="purgingAll || purgeAllConfirm.trim() !== 'PURGE_ALL'"
          @click="purgeAll"
        >
          Supprimer TOUS les restaurants + photos
        </button>

        <div v-if="status" class="text-sm text-primary/70">{{ status }}</div>
      </section>
    </section>

    <section v-else class="mt-4 grid gap-4 rounded-2xl bg-black/5 p-5">
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold text-primary">Restaurants</div>
        <button class="text-sm text-secondary underline" type="button" @click="loadRestaurants(true)" :disabled="restaurantsLoading">Rafraîchir</button>
      </div>

      <div v-if="restaurantsError" class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">{{ restaurantsError }}</div>

      <div v-if="restaurants.length === 0 && restaurantsLoading" class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">Chargement…</div>
      <div v-else-if="restaurants.length === 0" class="rounded-xl bg-black/5 p-4 text-sm text-primary/70">Aucun restaurant.</div>

      <div v-else class="grid gap-2">
        <div
          v-for="r in restaurants"
          :key="r.id"
          class="rounded-xl bg-black/5 p-4 hover:bg-black/10"
        >
          <a class="block" :href="`/r/${r.id}`" target="_blank" rel="noreferrer">
            <div class="text-sm font-semibold text-primary">{{ r.public.name || r.id }}</div>
            <div class="mt-1 text-xs text-primary/70">{{ r.public.address || '—' }}</div>
            <div class="mt-1 text-xs text-primary/50">{{ r.public.city || '—' }} — {{ r.id }}</div>
          </a>

          <div class="mt-3 flex items-center justify-between">
            <button
              class="rounded-lg bg-black/10 px-3 py-2 text-xs font-medium text-primary hover:bg-black/15"
              type="button"
              :disabled="menuUploadingFor === r.id"
              @click="triggerAddMenu(r.id)"
            >
              {{ menuUploadingFor === r.id ? 'Upload…' : 'Add menu' }}
            </button>
          </div>
        </div>
      </div>

      <button
        v-if="restaurantsCursor"
        class="rounded-xl bg-black/10 px-4 py-3 text-sm font-medium text-primary hover:bg-black/15"
        type="button"
        @click="loadRestaurants(false)"
        :disabled="restaurantsLoading"
      >
        Charger plus
      </button>
    </section>

    <input ref="menuFileInput" class="sr-only" type="file" accept="image/*" @change="onPickMenuFile" />
  </main>
</template>
