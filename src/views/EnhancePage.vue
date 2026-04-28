<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { renderEnhanced, type EnhanceOps } from '../lib/enhance'
import { apiBaseUrl, apiFetch } from '../lib/api'
import { enqueueUpload, flushUploadQueue, newUploadId } from '../lib/uploadQueue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const router = useRouter()
const auth = useAuthStore()
const session = useEnhanceSessionStore()

const chosenDate = ref<string>('')

const busy = ref<boolean>(false)
const enhancedUrl = ref<string>('')
const enhancedBlob = ref<Blob | null>(null)

const cropMode = ref<boolean>(false)
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

const ops: EnhanceOps = {
  autobalance: false,
  autocrop: false,
  shadowremoval: false,
  sharpen: false
}

function formatISODate(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function todayISO() {
  return formatISODate(new Date())
}

function tomorrowISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatISODate(d)
}

function nextWeekdayISO(day: number) {
  const d = new Date()
  const delta = (day - d.getDay() + 7) % 7
  d.setDate(d.getDate() + delta)
  return formatISODate(d)
}

function saturdayISO() {
  return nextWeekdayISO(6)
}

function sundayISO() {
  return nextWeekdayISO(0)
}

function formatShortFR(iso: string) {
  const [yyyy, mm, dd] = iso.split('-')
  if (!yyyy || !mm || !dd) return iso
  return `${dd}/${mm}`
}

const eventDateLabel = computed(() => {
  if (session.target !== 'event') return null
  if (!chosenDate.value) return null
  if (chosenDate.value === todayISO()) return 'Ce soir'
  if (chosenDate.value === tomorrowISO()) return 'Demain'
  if (chosenDate.value === saturdayISO()) return 'Samedi'
  if (chosenDate.value === sundayISO()) return 'Dimanche'
  return 'Date'
})

const eventDateDisplay = computed(() => {
  if (session.target !== 'event') return null
  if (!chosenDate.value) return null
  return formatShortFR(chosenDate.value)
})

function setEnhancedPreview(blob: Blob) {
  if (enhancedUrl.value) URL.revokeObjectURL(enhancedUrl.value)
  enhancedUrl.value = URL.createObjectURL(blob)
}

async function recompute() {
  if (!session.file) return
  busy.value = true
  try {
    const res = await renderEnhanced(session.file, ops)
    enhancedBlob.value = res.enhanced.blob
    setEnhancedPreview(res.enhanced.blob)
  } finally {
    busy.value = false
  }
}

function startCrop() {
  if (!enhancedUrl.value) return
  cropMode.value = true
}

function cancelCrop() {
  cropMode.value = false
}

async function applyCrop() {
  const c = cropperRef.value
  if (!c) return
  const result = c.getResult?.()
  const canvas = result?.canvas
  if (!canvas) return

  busy.value = true
  try {
    const out: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob_failed'))), 'image/jpeg', 0.92)
    })
    enhancedBlob.value = out
    setEnhancedPreview(out)
    cancelCrop()
  } finally {
    busy.value = false
  }
}

async function save() {
  if (!auth.key) throw new Error('missing_auth')
  if (!enhancedBlob.value) throw new Error('missing_image')

  if (session.target === 'menu') {
    await enqueueUpload({
      id: newUploadId(),
      createdAt: Date.now(),
      authKey: auth.key,
      date: chosenDate.value,
      contentType: 'image/jpeg',
      blob: enhancedBlob.value
    })

    if (navigator.onLine) await flushUploadQueue({})
    const back = session.returnTo || '/dashboard'
    session.clear()
    await router.push(back)
    return
  }

  if (session.target === 'event') {
    const contentType = 'image/jpeg'
    const presign = await apiFetch<{ objectKey: string; uploadUrl: string | null }>(
      '/api/event/presign-upload',
      {
        method: 'POST',
        key: auth.key,
        body: { date: chosenDate.value, contentType }
      }
    )

    const putRes = presign.uploadUrl
      ? await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': contentType },
          body: enhancedBlob.value
        })
      : await fetch(`${apiBaseUrl()}/api/event/upload?date=${encodeURIComponent(chosenDate.value)}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${auth.key}`,
            'content-type': contentType
          },
          body: enhancedBlob.value
        })

    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    const back = session.returnTo || '/dashboard'
    session.clear()
    await router.push(back)
    return
  }

  const contentType = 'image/jpeg'
  if (session.target === 'permanent-menu') {
    const presign = await apiFetch<{ id: string; objectKey: string; uploadUrl: string | null }>(
      '/api/permanent-menu/presign-upload',
      {
        method: 'POST',
        key: auth.key,
        body: { contentType }
      }
    )

    const putRes = presign.uploadUrl
      ? await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': contentType },
          body: enhancedBlob.value
        })
      : await fetch(`${apiBaseUrl()}/api/permanent-menu/upload?id=${encodeURIComponent(presign.id)}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${auth.key}`,
            'content-type': contentType
          },
          body: enhancedBlob.value
        })

    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    const back = session.returnTo || '/restaurant'
    session.clear()
    await router.push(back)
    return
  }

  if (session.target === 'restaurant-photo') {
    const presign = await apiFetch<{ id: string; objectKey: string; uploadUrl: string | null }>(
      '/api/restaurant-photos/presign-upload',
      {
        method: 'POST',
        key: auth.key,
        body: { contentType }
      }
    )

    const putRes = presign.uploadUrl
      ? await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': contentType },
          body: enhancedBlob.value
        })
      : await fetch(`${apiBaseUrl()}/api/restaurant-photos/upload?id=${encodeURIComponent(presign.id)}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${auth.key}`,
            'content-type': contentType
          },
          body: enhancedBlob.value
        })

    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    const back = session.returnTo || '/restaurant'
    session.clear()
    await router.push(back)
    return
  }
}

async function close() {
  const back = session.returnTo || '/dashboard'
  session.clear()
  await router.push(back)
}

onMounted(async () => {
  if (!session.file) {
    await router.replace('/dashboard')
    return
  }

  chosenDate.value =
    session.target === 'menu'
      ? todayISO()
      : session.target === 'event'
        ? (session.defaultDate || todayISO())
        : ''
  await recompute()
})
</script>

<template>
  <main class="min-h-dvh bg-background">
    <div class="sticky top-0 z-10 border-b border-black/10 bg-background px-5 py-4" style="padding-top: max(env(safe-area-inset-top), 16px)">
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-primary">Nouvelle photo</div>
        <button class="text-sm text-primary/70 underline" @click="close">Fermer</button>
      </div>
    </div>

    <div class="mx-auto max-w-3xl px-5 pb-28 pt-4" style="padding-bottom: max(env(safe-area-inset-bottom), 112px)">
      <div class="relative overflow-hidden rounded-2xl bg-black/10">
        <div v-if="session.target === 'event' && eventDateLabel && eventDateDisplay" class="absolute inset-x-0 top-0 z-10 p-3">
          <div class="inline-flex items-baseline gap-2 rounded-xl bg-black/35 px-3 py-2 text-white backdrop-blur">
            <div class="text-sm font-medium">{{ eventDateLabel }}</div>
            <div class="text-xs text-white/80">{{ eventDateDisplay }}</div>
          </div>
        </div>
        <div class="aspect-[4/5] overflow-hidden">
          <img
            v-if="enhancedUrl"
            class="h-full w-full object-cover"
            :src="enhancedUrl"
            alt="Enhanced"
          />
        </div>
        <div v-if="busy" class="absolute inset-0 grid place-items-center bg-black/35">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        </div>
      </div>

      <div class="mt-4">
        <div class="flex items-center justify-between gap-3">
          <button
            class="rounded-full bg-black/5 px-3 py-2 text-xs text-primary ring-1 ring-black/10 hover:bg-black/10"
            type="button"
            :disabled="busy || cropMode"
            @click="startCrop"
          >
            Recadrer
          </button>

          <div v-if="session.target === 'event'" class="flex flex-wrap justify-end gap-2">
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-black/10"
              :class="chosenDate === todayISO() ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-black/5 text-primary hover:bg-black/10'"
              type="button"
              :disabled="busy"
              @click="chosenDate = todayISO()"
            >
              Ce soir
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-black/10"
              :class="chosenDate === tomorrowISO() ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-black/5 text-primary hover:bg-black/10'"
              type="button"
              :disabled="busy"
              @click="chosenDate = tomorrowISO()"
            >
              Demain
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-black/10"
              :class="chosenDate === saturdayISO() ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-black/5 text-primary hover:bg-black/10'"
              type="button"
              :disabled="busy"
              @click="chosenDate = saturdayISO()"
            >
              Samedi
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-black/10"
              :class="chosenDate === sundayISO() ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-black/5 text-primary hover:bg-black/10'"
              type="button"
              :disabled="busy"
              @click="chosenDate = sundayISO()"
            >
              Dimanche
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="cropMode" class="fixed inset-0 z-50 bg-black/70" style="padding-top: max(env(safe-area-inset-top), 16px); padding-bottom: max(env(safe-area-inset-bottom), 16px)">
      <div class="mx-auto flex h-full max-w-3xl flex-col px-5">
        <div class="flex items-center justify-between py-3">
          <div class="text-sm font-semibold text-white">Recadrer</div>
          <button class="text-sm font-semibold text-white/80 underline" type="button" :disabled="busy" @click="cancelCrop">Fermer</button>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
          <Cropper
            v-if="enhancedUrl"
            ref="cropperRef"
            class="h-full w-full"
            :src="enhancedUrl"
            :stencil-props="{ movable: true, resizable: true }"
            :default-size="({ imageSize }: any) => ({ width: imageSize.width, height: imageSize.height })"
            image-restriction="stencil"
          />
        </div>

        <div class="grid grid-cols-2 gap-3 py-4">
          <button class="w-full rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20" type="button" :disabled="busy" @click="cancelCrop">
            Annuler
          </button>
          <button class="w-full rounded-xl bg-cta px-4 py-3 text-sm font-semibold text-background hover:bg-cta/90" type="button" :disabled="busy" @click="applyCrop">
            Appliquer
          </button>
        </div>
      </div>
    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-background/95 px-5 py-4 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
    >
      <div class="mx-auto grid max-w-3xl gap-3">
        <div class="grid grid-cols-2 gap-3">
          <button class="w-full rounded-xl bg-black/10 px-4 py-3 text-sm text-primary hover:bg-black/15" :disabled="busy" @click="close">
            Annuler
          </button>
          <button
            class="w-full rounded-xl bg-cta px-4 py-3 text-sm font-medium text-background hover:bg-cta/90"
            :disabled="busy || cropMode || ((session.target === 'menu' || session.target === 'event') && chosenDate.length === 0)"
            @click="save"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
