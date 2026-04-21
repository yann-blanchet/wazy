<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { apiFetch } from '../lib/api'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const enhanceSession = useEnhanceSessionStore()

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

const viewerOpen = ref<boolean>(false)
const viewerSrc = ref<string>('')
const viewerKind = ref<'photo' | 'carte' | null>(null)
const viewerId = ref<string>('')

function normalizeTab(v: unknown): 'infos' | 'carte' | 'photos' {
  return v === 'carte' || v === 'photos' ? v : 'infos'
}

async function setTab(next: 'infos' | 'carte' | 'photos') {
  tab.value = next
  await router.replace({ query: { ...route.query, tab: next } })
}

function openViewer(kind: 'photo' | 'carte', id: string, createdAt: number) {
  viewerKind.value = kind
  viewerId.value = id
  viewerSrc.value = kind === 'photo' ? restaurantPhotoItemUrl(id, createdAt) : permanentMenuItemUrl(id, createdAt)
  viewerOpen.value = true
}

function closeViewer() {
  viewerOpen.value = false
  viewerSrc.value = ''
  viewerKind.value = null
  viewerId.value = ''
}

async function deleteFromViewer() {
  if (!viewerKind.value || !viewerId.value) return
  const kind = viewerKind.value
  const id = viewerId.value
  if (kind === 'photo') await deletePhoto(id)
  else await deletePermanentMenu(id)
  closeViewer()
}
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

    enhanceSession.start(file, '', 'restaurant-photo', '/restaurant?tab=photos')
    await router.push('/enhance')

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
    tab.value = normalizeTab(route.query.tab)

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

watch(
  () => route.query.tab,
  (v) => {
    tab.value = normalizeTab(v)
  }
)

async function onPermanentPick(e: Event) {
  try {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    if (!auth.key) throw new Error('missing_auth')

    enhanceSession.start(file, '', 'permanent-menu', '/restaurant?tab=carte')
    await router.push('/enhance')

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

    <div class="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-black/5 p-1">
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'infos' ? 'bg-black/10 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
        @click="setTab('infos')"
      >
        Infos
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'carte' ? 'bg-black/10 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
        @click="setTab('carte')"
      >
        Carte
      </button>
      <button
        class="rounded-xl px-4 py-3 text-sm"
        :class="tab === 'photos' ? 'bg-black/10 text-bordeaux' : 'text-bordeaux/70 hover:bg-black/5'"
        @click="setTab('photos')"
      >
        Galerie
      </button>
    </div>

    <section v-if="tab === 'infos'" class="mt-6 rounded-2xl bg-black/5 p-5">
      <h2 class="text-lg font-semibold">Infos</h2>
      <p class="mt-1 text-sm text-bordeaux/70">Shown on the public page.</p>

      <div class="mt-4 grid gap-3">
        <label class="grid gap-2">
          <span class="text-sm text-bordeaux/70">Name</span>
          <input
            v-model="name"
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
          class="rounded-xl bg-black/10 px-4 py-3 hover:bg-black/15"
          :disabled="!auth.isMaster"
          @click="saveProfile"
        >
          Save restaurant info
        </button>

        <div v-if="profileStatus" class="text-sm text-bordeaux/70">{{ profileStatus }}</div>
      </div>
    </section>

    <section v-if="tab === 'photos'" class="mt-6 rounded-2xl bg-black/5 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Galerie</h2>

        <label class="shrink-0">
          <input class="hidden" type="file" accept="image/*" @change="onPhotoPick" />
          <span
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 text-bordeaux hover:bg-black/15"
            :class="!auth.isMaster ? 'pointer-events-none opacity-60' : ''"
            title="Ajouter une photo"
            aria-label="Ajouter une photo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
        </label>
      </div>
      <p class="mt-1 text-sm text-bordeaux/70">Ajoutez des photos de votre restaurant (vitrine, salle, plats…).</p>

      <div class="mt-4">
        <div v-if="restaurantPhotos.length === 0" class="rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
          Aucune photo pour le moment.
        </div>
        <div v-else class="grid grid-cols-1 gap-3">
          <div v-for="p in restaurantPhotos" :key="p.id" class="overflow-hidden rounded-2xl bg-black/10">
            <div class="aspect-[4/5] overflow-hidden">
              <button class="block h-full w-full" type="button" @click="openViewer('photo', p.id, p.createdAt)">
                <img class="h-full w-full object-cover" :src="restaurantPhotoItemUrl(p.id, p.createdAt)" :alt="p.id" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <div v-if="photosStatus" class="text-sm text-bordeaux/70">{{ photosStatus }}</div>
      </div>
    </section>

    <section v-if="tab === 'carte'" class="mt-6 rounded-2xl bg-black/5 p-5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-semibold">Carte</h2>

        <label class="shrink-0">
          <input class="hidden" type="file" accept="image/*" @change="onPermanentPick" />
          <span
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/10 text-bordeaux hover:bg-black/15"
            :class="!auth.isMaster ? 'pointer-events-none opacity-60' : ''"
            title="Ajouter une carte permanente"
            aria-label="Ajouter une carte permanente"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </span>
        </label>
      </div>
      <p class="mt-1 text-sm text-bordeaux/70">Toutes les cartes permanentes seront affichées ici.</p>

      <div class="mt-4">
        <div v-if="permanentMenus.length === 0" class="rounded-xl bg-black/10 p-4 text-sm text-bordeaux/70">
          Aucune carte permanente pour le moment.
        </div>
        <div v-else class="grid grid-cols-1 gap-3">
          <div v-for="m in permanentMenus" :key="m.id" class="overflow-hidden rounded-2xl bg-black/10">
            <div class="aspect-[4/5] overflow-hidden">
              <button class="block h-full w-full" type="button" @click="openViewer('carte', m.id, m.createdAt)">
                <img class="h-full w-full object-cover" :src="permanentMenuItemUrl(m.id, m.createdAt)" :alt="m.id" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <div v-if="permanentStatus" class="text-sm text-bordeaux/70">{{ permanentStatus }}</div>
      </div>
    </section>

    <div v-if="viewerOpen" class="fixed inset-0 z-[90] bg-black">
      <button class="absolute inset-0" type="button" @click="closeViewer" aria-label="Fermer" />
      <div class="absolute inset-0 grid place-items-center">
        <img v-if="viewerSrc" class="max-h-full max-w-full object-contain" :src="viewerSrc" alt="" />
      </div>

      <div
        class="absolute inset-x-0 bottom-0 border-t border-black/10 bg-beige/95 px-5 py-4 backdrop-blur"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="mx-auto grid max-w-lg grid-cols-2 gap-3">
          <button
            class="rounded-xl bg-black/10 px-4 py-3 text-sm text-bordeaux hover:bg-black/15"
            :disabled="!auth.isMaster"
            @click="deleteFromViewer"
          >
            Supprimer
          </button>
          <button class="rounded-xl bg-bordeaux px-4 py-3 text-sm font-medium text-beige hover:bg-bordeaux/90" @click="closeViewer">
            Fermer
          </button>
        </div>
      </div>
    </div>

    <div v-if="cuisineSheetOpen" class="fixed inset-0 z-[80]">
      <div class="absolute inset-0 bg-black/60" @click="cuisineSheetOpen = false" />
      <div
        class="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-black/10 bg-beige px-5 py-4"
        style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
      >
        <div class="flex items-center justify-between">
          <div class="text-sm font-medium text-bordeaux">Type de cuisine</div>
          <button class="text-sm text-bordeaux/70 underline" @click="cuisineSheetOpen = false">Close</button>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            v-for="c in cuisineOptions"
            :key="c"
            class="rounded-xl bg-black/5 px-4 py-3 text-sm text-bordeaux ring-1 ring-black/10 hover:bg-black/10"
            @click="pickCuisine(c)"
          >
            {{ c }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
