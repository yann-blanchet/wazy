<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { apiFetch } from '../lib/api'

const auth = useAuthStore()

const name = ref<string>('')
const address = ref<string>('')
const city = ref<string>('')
const phone = ref<string>('')
const cuisineType = ref<string>('')
const profileStatus = ref<string>('')

const cuisineSheetOpen = ref<boolean>(false)
const permanentStatus = ref<string>('')
const permanentMenus = ref<{ id: string; createdAt: number }[]>([])
const photosStatus = ref<string>('')
const restaurantPhotos = ref<{ id: string; createdAt: number }[]>([])
const tab = ref<'infos' | 'carte' | 'photos'>('infos')
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

async function onPhotoPick(e: Event) {
  try {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!auth.key) throw new Error('missing_auth')

    photosStatus.value = 'Uploading…'

    const presign = await apiFetch<{ id: string; objectKey: string; uploadUrl: string | null }>(
      '/api/restaurant-photos/presign-upload',
      {
        method: 'POST',
        key: auth.key,
        body: { contentType: file.type || 'image/jpeg' }
      }
    )

    const putRes = presign.uploadUrl
      ? await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: {
            'content-type': file.type || 'image/jpeg'
          },
          body: file
        })
      : await fetch(`${apiFetchBase()}/api/restaurant-photos/upload?id=${encodeURIComponent(presign.id)}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${auth.key}`,
            'content-type': file.type || 'image/jpeg'
          },
          body: file
        })

    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    restaurantPhotos.value = [{ id: presign.id, createdAt: Date.now() }, ...restaurantPhotos.value]
    photosStatus.value = 'Uploaded.'
    input.value = ''
  } catch (err) {
    photosStatus.value = err instanceof Error ? err.message : 'upload_error'
  }
}

async function deletePhoto(pid: string) {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    photosStatus.value = 'Deleting…'
    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/restaurant-photos?id=${encodeURIComponent(pid)}`, {
      method: 'DELETE',
      key: auth.key
    })
    restaurantPhotos.value = restaurantPhotos.value.filter((x) => x.id !== pid)
    photosStatus.value = 'Deleted.'
  } catch (err) {
    photosStatus.value = err instanceof Error ? err.message : 'delete_error'
  }
}

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function permanentMenuItemUrl(pid: string, t?: number) {
  if (!auth.id) return ''
  const q = typeof t === 'number' && t > 0 ? `?t=${t}` : ''
  return `${apiFetchBase()}/api/public/${auth.id}/permanent-menu/${pid}${q}`
}

function restaurantPhotoItemUrl(pid: string, t?: number) {
  if (!auth.id) return ''
  const q = typeof t === 'number' && t > 0 ? `?t=${t}` : ''
  return `${apiFetchBase()}/api/public/${auth.id}/photo/${pid}${q}`
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

    if (auth.id) {
      const pub = await apiFetch<{ permanentMenus?: { id: string; createdAt: number }[]; photos?: { id: string; createdAt: number }[] }>(
        `/api/public/${auth.id}`,
        {
        method: 'GET'
        }
      )
      permanentMenus.value = Array.isArray(pub.permanentMenus) ? pub.permanentMenus : []
      restaurantPhotos.value = Array.isArray(pub.photos) ? pub.photos : []
    }
  } catch (e) {
    profileStatus.value = e instanceof Error ? e.message : 'load_error'
  }
})

async function onPermanentPick(e: Event) {
  try {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!auth.key) throw new Error('missing_auth')

    permanentStatus.value = 'Uploading…'

    const presign = await apiFetch<{ id: string; objectKey: string; uploadUrl: string | null }>(
      '/api/permanent-menu/presign-upload',
      {
        method: 'POST',
        key: auth.key,
        body: { contentType: file.type || 'image/jpeg' }
      }
    )

    const putRes = presign.uploadUrl
      ? await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: {
            'content-type': file.type || 'image/jpeg'
          },
          body: file
        })
      : await fetch(`${apiFetchBase()}/api/permanent-menu/upload?id=${encodeURIComponent(presign.id)}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${auth.key}`,
            'content-type': file.type || 'image/jpeg'
          },
          body: file
        })

    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    permanentMenus.value = [{ id: presign.id, createdAt: Date.now() }, ...permanentMenus.value]
    permanentStatus.value = 'Uploaded.'
    input.value = ''
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'upload_error'
  }
}

async function deletePermanentMenu(pid: string) {
  try {
    if (!auth.isMaster) throw new Error('forbidden')
    if (!auth.key) throw new Error('missing_auth')
    permanentStatus.value = 'Deleting…'
    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/permanent-menu?id=${encodeURIComponent(pid)}`, {
      method: 'DELETE',
      key: auth.key
    })
    permanentMenus.value = permanentMenus.value.filter((x) => x.id !== pid)
    permanentStatus.value = 'Deleted.'
  } catch (err) {
    permanentStatus.value = err instanceof Error ? err.message : 'delete_error'
  }
}

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

</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="text-2xl font-semibold">Restaurant</div>

    <div class="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-1">
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'infos' ? 'bg-white/10 text-slate-100' : 'text-slate-300 hover:bg-white/5'"
        @click="tab = 'infos'"
      >
        Infos
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'carte' ? 'bg-white/10 text-slate-100' : 'text-slate-300 hover:bg-white/5'"
        @click="tab = 'carte'"
      >
        Carte
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'photos' ? 'bg-white/10 text-slate-100' : 'text-slate-300 hover:bg-white/5'"
        @click="tab = 'photos'"
      >
        Photos
      </button>
    </div>

    <section v-if="tab === 'infos'" class="mt-6 rounded-2xl bg-white/5 p-5">
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

    <section v-if="tab === 'photos'" class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Photos</h2>
      <p class="mt-1 text-sm text-slate-300">Ajoutez des photos de votre restaurant (vitrine, salle, plats…).</p>

      <div class="mt-4">
        <div v-if="restaurantPhotos.length === 0" class="rounded-xl bg-white/10 p-4 text-sm text-slate-300">
          Aucune photo pour le moment.
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div v-for="p in restaurantPhotos" :key="p.id" class="overflow-hidden rounded-2xl bg-black/30">
            <div class="aspect-[4/5] overflow-hidden">
              <img class="h-full w-full object-cover" :src="restaurantPhotoItemUrl(p.id, p.createdAt)" :alt="p.id" />
            </div>
            <div class="grid gap-2 p-3">
              <button
                class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                :disabled="!auth.isMaster"
                @click="deletePhoto(p.id)"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <label class="w-full">
          <input class="hidden" type="file" accept="image/*" @change="onPhotoPick" />
          <span class="block w-full rounded-xl bg-white/10 px-4 py-3 text-center hover:bg-white/15">
            Ajouter une photo
          </span>
        </label>

        <div v-if="photosStatus" class="text-sm text-slate-300">{{ photosStatus }}</div>
      </div>
    </section>

    <section v-if="tab === 'carte'" class="mt-6 rounded-2xl bg-white/5 p-5">
      <h2 class="text-lg font-semibold">Carte</h2>
      <p class="mt-1 text-sm text-slate-300">Toutes les cartes permanentes seront affichées ici.</p>

      <div class="mt-4">
        <div v-if="permanentMenus.length === 0" class="rounded-xl bg-white/10 p-4 text-sm text-slate-300">
          Aucune carte permanente pour le moment.
        </div>
        <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div v-for="m in permanentMenus" :key="m.id" class="overflow-hidden rounded-2xl bg-black/30">
            <div class="aspect-[4/5] overflow-hidden">
              <img class="h-full w-full object-cover" :src="permanentMenuItemUrl(m.id, m.createdAt)" :alt="m.id" />
            </div>
            <div class="grid gap-2 p-3">
              <button
                class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
                :disabled="!auth.isMaster"
                @click="deletePermanentMenu(m.id)"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <label class="w-full">
          <input class="hidden" type="file" accept="image/*" @change="onPermanentPick" />
          <span class="block w-full rounded-xl bg-white/10 px-4 py-3 text-center hover:bg-white/15">
            Ajouter une carte permanente
          </span>
        </label>

        <div v-if="permanentStatus" class="text-sm text-slate-300">{{ permanentStatus }}</div>
      </div>
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
