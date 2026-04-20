<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useEnhanceSessionStore } from '../stores/enhanceSession'
import { renderEnhanced, type EnhanceOps } from '../lib/enhance'
import { enqueueUpload, flushUploadQueue, newUploadId } from '../lib/uploadQueue'

const router = useRouter()
const auth = useAuthStore()
const session = useEnhanceSessionStore()

const chosenDate = ref<string>('')
const showAdjust = ref<boolean>(false)

const busy = ref<boolean>(false)
const enhancedUrl = ref<string>('')
const enhancedBlob = ref<Blob | null>(null)

const imgEl = ref<HTMLImageElement | null>(null)
const cropMode = ref<boolean>(false)
const cropDragging = ref<boolean>(false)
const cropRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const cropStart = ref<{ x: number; y: number } | null>(null)

const cropAspect = 4 / 5

const ops = ref<EnhanceOps>({
  autobalance: true,
  autocrop: true,
  shadowremoval: true,
  sharpen: true
})

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

function setEnhancedPreview(blob: Blob) {
  if (enhancedUrl.value) URL.revokeObjectURL(enhancedUrl.value)
  enhancedUrl.value = URL.createObjectURL(blob)
}

async function recompute() {
  if (!session.file) return
  busy.value = true
  try {
    const res = await renderEnhanced(session.file, ops.value)
    enhancedBlob.value = res.enhanced.blob
    setEnhancedPreview(res.enhanced.blob)
    cropMode.value = false
    cropRect.value = null
  } finally {
    busy.value = false
  }
}

async function toggle(k: keyof EnhanceOps) {
  ops.value = { ...ops.value, [k]: !ops.value[k] }
  await recompute()
}

async function reset() {
  ops.value = { autobalance: false, autocrop: false, shadowremoval: false, sharpen: false }
  await recompute()
}

function startCrop() {
  if (!enhancedUrl.value) return
  cropMode.value = true
  cropRect.value = null
}

function cancelCrop() {
  cropMode.value = false
  cropRect.value = null
  cropDragging.value = false
  cropStart.value = null
}

function clientPointToImagePoint(e: PointerEvent) {
  const el = imgEl.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const x = Math.min(Math.max(e.clientX - r.left, 0), r.width)
  const y = Math.min(Math.max(e.clientY - r.top, 0), r.height)
  return { x, y, w: r.width, h: r.height }
}

function onCropPointerDown(e: PointerEvent) {
  if (!cropMode.value) return
  e.preventDefault()
  const p = clientPointToImagePoint(e)
  if (!p) return
  cropDragging.value = true
  cropStart.value = { x: p.x, y: p.y }
  cropRect.value = { x: p.x, y: p.y, w: 0, h: 0 }
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
}

function onCropPointerMove(e: PointerEvent) {
  if (!cropMode.value || !cropDragging.value) return
  e.preventDefault()
  const start = cropStart.value
  const p = clientPointToImagePoint(e)
  if (!start || !p) return

  const dx = p.x - start.x
  const dy = p.y - start.y
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  let w = absDx
  let h = absDy
  if (w / Math.max(h, 1e-6) > cropAspect) {
    h = w / cropAspect
  } else {
    w = h * cropAspect
  }

  const x2 = start.x + Math.sign(dx || 1) * w
  const y2 = start.y + Math.sign(dy || 1) * h

  const x1 = Math.min(start.x, x2)
  const y1 = Math.min(start.y, y2)
  const x3 = Math.max(start.x, x2)
  const y3 = Math.max(start.y, y2)

  cropRect.value = { x: x1, y: y1, w: x3 - x1, h: y3 - y1 }
}

function onCropPointerUp() {
  if (!cropMode.value) return
  cropDragging.value = false
  cropStart.value = null
}

async function applyCrop() {
  if (!enhancedBlob.value) return
  const el = imgEl.value
  const rect = cropRect.value
  if (!el || !rect) return

  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return

  const minSize = 16
  if (rect.w < minSize || rect.h < minSize) return

  busy.value = true
  try {
    const bmp = await createImageBitmap(enhancedBlob.value)
    const sx = (rect.x / r.width) * bmp.width
    const sy = (rect.y / r.height) * bmp.height
    const sw = (rect.w / r.width) * bmp.width
    const sh = (rect.h / r.height) * bmp.height

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw))
    canvas.height = Math.max(1, Math.round(sh))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no_canvas')
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    const out: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob_failed'))), 'image/jpeg', 0.92)
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

  await enqueueUpload({
    id: newUploadId(),
    createdAt: Date.now(),
    authKey: auth.key,
    date: chosenDate.value,
    contentType: 'image/jpeg',
    blob: enhancedBlob.value
  })

  if (navigator.onLine) await flushUploadQueue({})
  session.clear()
  await router.push('/dashboard')
}

async function close() {
  session.clear()
  await router.push('/dashboard')
}

onMounted(async () => {
  if (!session.file) {
    await router.replace('/dashboard')
    return
  }

  chosenDate.value = session.defaultDate || todayISO()
  await recompute()
})
</script>

<template>
  <main class="min-h-dvh bg-slate-950">
    <div class="sticky top-0 z-10 border-b border-white/10 bg-slate-950 px-5 py-4" style="padding-top: max(env(safe-area-inset-top), 16px)">
      <div class="flex items-center justify-between">
        <div class="text-sm font-medium text-slate-200">Enhance</div>
        <button class="text-sm text-slate-300 underline" @click="close">Close</button>
      </div>
    </div>

    <div class="mx-auto max-w-3xl px-5 pb-28 pt-4" style="padding-bottom: max(env(safe-area-inset-bottom), 112px)">
      <div class="relative overflow-hidden rounded-2xl bg-black/30">
        <div class="aspect-[4/5] overflow-hidden">
          <img
            v-if="enhancedUrl"
            ref="imgEl"
            class="h-full w-full object-cover"
            :src="enhancedUrl"
            alt="Enhanced"
          />
        </div>
        <div v-if="busy" class="absolute inset-0 grid place-items-center bg-black/35">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        </div>

        <div v-if="cropMode" class="absolute inset-0">
          <div
            class="absolute inset-0 cursor-crosshair"
            style="touch-action: none"
            @pointerdown="onCropPointerDown"
            @pointermove="onCropPointerMove"
            @pointerup="onCropPointerUp"
            @pointercancel="onCropPointerUp"
            @pointerleave="onCropPointerUp"
          />
          <div v-if="cropRect" class="absolute border-2 border-emerald-400/80" :style="{ left: cropRect.x + 'px', top: cropRect.y + 'px', width: cropRect.w + 'px', height: cropRect.h + 'px' }" />
          <div v-if="cropRect" class="absolute bg-black/35" :style="{ left: '0px', top: '0px', width: '100%', height: cropRect.y + 'px' }" />
          <div v-if="cropRect" class="absolute bg-black/35" :style="{ left: '0px', top: (cropRect.y + cropRect.h) + 'px', width: '100%', height: 'calc(100% - ' + (cropRect.y + cropRect.h) + 'px)' }" />
          <div v-if="cropRect" class="absolute bg-black/35" :style="{ left: '0px', top: cropRect.y + 'px', width: cropRect.x + 'px', height: cropRect.h + 'px' }" />
          <div v-if="cropRect" class="absolute bg-black/35" :style="{ left: (cropRect.x + cropRect.w) + 'px', top: cropRect.y + 'px', width: 'calc(100% - ' + (cropRect.x + cropRect.w) + 'px)', height: cropRect.h + 'px' }" />
        </div>
      </div>

      <div class="mt-4">
        <div class="flex items-center justify-between gap-3">
          <button
            class="rounded-full bg-white/5 px-3 py-2 text-xs text-slate-200 ring-1 ring-white/10 hover:bg-white/10"
            :disabled="busy"
            @click="showAdjust = !showAdjust"
          >
            {{ showAdjust ? 'Hide' : 'Adjust' }}
          </button>

          <div class="flex flex-wrap gap-2">
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="chosenDate === todayISO() ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="chosenDate = todayISO()"
            >
              Aujourd'hui
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="chosenDate === tomorrowISO() ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="chosenDate = tomorrowISO()"
            >
              Demain
            </button>
          </div>
        </div>

        <div v-if="showAdjust" class="mt-3 grid gap-3">
          <div class="flex flex-wrap gap-2">
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="cropMode ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="cropMode ? cancelCrop() : startCrop()"
            >
              Crop
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="ops.autobalance ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="toggle('autobalance')"
            >
              Autobalance
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="ops.autocrop ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="toggle('autocrop')"
            >
              Autocrop
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="ops.shadowremoval ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="toggle('shadowremoval')"
            >
              Shadowremoval
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="ops.sharpen ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30' : 'bg-white/5 text-slate-200 hover:bg-white/10'"
              :disabled="busy"
              @click="toggle('sharpen')"
            >
              Sharpen
            </button>
            <button
              class="rounded-full px-3 py-2 text-xs ring-1 ring-white/10"
              :class="(ops.autobalance || ops.autocrop || ops.shadowremoval || ops.sharpen) ? 'bg-white/10 text-slate-200 hover:bg-white/15' : 'bg-white/5 text-slate-400'"
              :disabled="busy"
              @click="reset"
            >
              Reset
            </button>
          </div>

          <div v-if="cropMode" class="grid grid-cols-2 gap-2">
            <button class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15" :disabled="busy" @click="cancelCrop">
              Cancel
            </button>
            <button
              class="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
              :disabled="busy || !cropRect"
              @click="applyCrop"
            >
              Apply crop
            </button>
          </div>

          <label class="grid gap-2">
            <span class="text-sm text-slate-300">Date</span>
            <input
              v-model="chosenDate"
              type="date"
              class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            />
          </label>
        </div>
      </div>
    </div>

    <div
      class="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur"
      style="padding-bottom: max(env(safe-area-inset-bottom), 16px)"
    >
      <div class="mx-auto grid max-w-3xl gap-3">
        <button
          class="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          :disabled="busy || chosenDate.length === 0 || cropMode"
          @click="save"
        >
          Save
        </button>
        <div class="text-center text-xs text-slate-400" v-if="cropMode">Finish crop (Apply/Cancel) to save</div>
      </div>
    </div>
  </main>
</template>
