<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { renderEnhanced, type EnhanceOps } from '../lib/enhance'
import EnhanceBottomSheet from '../components/EnhanceBottomSheet.vue'
import {
  enqueueUpload,
  flushUploadQueue,
  newUploadId,
  todayISO,
  removeQueuedByDate,
  uploadQueueCount
} from '../lib/uploadQueue'
import { apiFetch } from '../lib/api'

const router = useRouter()

const auth = useAuthStore()
const status = ref<string>('')
const queued = ref<number>(0)
const previewUrl = ref<string>('')
const selectedDate = ref<string>(todayISO())
const serverPreviewUrl = ref<string>('')
const serverPreviewState = ref<'idle' | 'loading' | 'loaded' | 'missing'>('idle')

const enhanceOpen = ref<boolean>(false)
const enhanceBusy = ref<boolean>(false)
const pendingFile = ref<File | null>(null)
const originalUrl = ref<string>('')
const enhancedUrl = ref<string>('')
const originalBlob = ref<Blob | null>(null)
const enhancedBlob = ref<Blob | null>(null)
const ops = ref<EnhanceOps>({
  autobalance: false,
  autocrop: false,
  shadowremoval: false,
  sharpen: false
})

async function onEnhanceOpsChange(next: EnhanceOps) {
  ops.value = next
  await recomputeEnhance()
}

function setPreviewFromBlob(blob: Blob) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(blob)
}

function setEnhancePreviews(o: Blob, e: Blob) {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  if (enhancedUrl.value) URL.revokeObjectURL(enhancedUrl.value)
  originalUrl.value = URL.createObjectURL(o)
  enhancedUrl.value = URL.createObjectURL(e)
}

async function recomputeEnhance() {
  if (!pendingFile.value) return
  enhanceBusy.value = true
  try {
    const res = await renderEnhanced(pendingFile.value, ops.value)
    originalBlob.value = res.original.blob
    enhancedBlob.value = res.enhanced.blob
    setEnhancePreviews(res.original.blob, res.enhanced.blob)
  } finally {
    enhanceBusy.value = false
  }
}

async function refreshQueued() {
  queued.value = await uploadQueueCount()
}

async function flush() {
  try {
    await flushUploadQueue({
      onStatus: (s) => (status.value = s)
    })
  } finally {
    await refreshQueued()
  }
}

onMounted(async () => {
  await refreshQueued()
  if (navigator.onLine) await flush()

  refreshServerPreview()
})

function apiBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

function refreshServerPreview() {
  serverPreviewState.value = 'loading'
  if (!auth.id || !selectedDate.value) {
    serverPreviewUrl.value = ''
    serverPreviewState.value = 'idle'
    return
  }
  // cache-bust so newly uploaded images refresh immediately
  serverPreviewUrl.value = `${apiBase()}/api/public/${auth.id}/menu/${selectedDate.value}?t=${Date.now()}`
}

async function deleteMenuForDate() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    status.value = 'Deleting…'

    await apiFetch<{ ok: boolean; deleted: boolean }>(`/api/menu?date=${encodeURIComponent(selectedDate.value)}`,
      {
        method: 'DELETE',
        key: auth.key
      }
    )

    await removeQueuedByDate(selectedDate.value)
    await refreshQueued()

    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }

    refreshServerPreview()

    status.value = 'Deleted.'
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'delete_error'
  }
}

async function onTakePhotoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  pendingFile.value = file
  enhanceOpen.value = true
  ops.value = { autobalance: false, autocrop: false, shadowremoval: false, sharpen: false }
  try {
    await recomputeEnhance()
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'enhance_error'
    enhanceOpen.value = false
  }

  input.value = ''
}

async function confirmUpload(useEnhanced: boolean) {
  try {
    if (!auth.key) throw new Error('missing_auth')

    const blob = useEnhanced ? enhancedBlob.value : originalBlob.value
    if (!blob) throw new Error('missing_image')

    setPreviewFromBlob(blob)
    enhanceOpen.value = false
    status.value = 'Saving offline…'

    await enqueueUpload({
      id: newUploadId(),
      createdAt: Date.now(),
      authKey: auth.key,
      date: selectedDate.value,
      contentType: 'image/jpeg',
      blob
    })

    await refreshQueued()

    if (navigator.onLine) {
      status.value = 'Uploading…'
      await flush()
      refreshServerPreview()
    } else {
      status.value = 'Saved. Will upload when back online.'
    }
  } catch (err) {
    status.value = err instanceof Error ? err.message : 'upload_error'
  }
}

function closeEnhance() {
  enhanceOpen.value = false
  pendingFile.value = null
}
</script>

<template>
  <main class="mx-auto max-w-lg p-6 pb-28">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">WAZY</h1>
      <div class="flex items-center gap-4">
        <button class="text-sm text-slate-300 underline" @click="router.push('/history')">
          History
        </button>
        <button class="text-sm text-slate-300 underline" @click="router.push('/settings')">
          Settings
        </button>
      </div>
    </div>

    <div class="mt-6 grid gap-4">

      <label class="grid gap-2 rounded-xl bg-white/5 p-4">
        <input
          v-model="selectedDate"
          type="date"
          class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
          @change="refreshServerPreview"
        />
      </label>

      <div v-if="serverPreviewUrl" class="overflow-hidden rounded-2xl bg-black/30">
        <img
          v-show="serverPreviewState === 'loaded'"
          class="w-full object-cover"
          :src="serverPreviewUrl"
          alt="Existing menu photo"
          @load="serverPreviewState = 'loaded'"
          @error="serverPreviewState = 'missing'"
        />
        <div v-if="serverPreviewState === 'loading'" class="p-4 text-sm text-slate-400">Loading…</div>
        <div v-else-if="serverPreviewState === 'missing'" class="p-4 text-sm text-slate-400">
          No uploaded photo for this date yet.
        </div>
      </div>

      <div v-if="previewUrl" class="overflow-hidden rounded-2xl bg-black/30">
        <img class="w-full object-cover" :src="previewUrl" alt="Selected menu photo" />
      </div>

      <button
        class="rounded-xl bg-rose-500/15 px-4 py-3 text-sm font-medium text-rose-200 hover:bg-rose-500/20"
        @click="deleteMenuForDate"
      >
        Delete menu for selected date
      </button>

    </div>

    <label class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <input
        class="hidden"
        type="file"
        accept="image/*"
        capture="environment"
        @change="onTakePhotoChange"
      />
      <span
        class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg shadow-black/30 ring-1 ring-white/10 hover:bg-emerald-400"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-7 w-7">
          <path
            d="M9 7l1.2-2.1c.2-.5.7-.9 1.3-.9h1c.6 0 1.1.4 1.3.9L15 7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M6 7h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
    </label>

    <EnhanceBottomSheet
      :open="enhanceOpen"
      :busy="enhanceBusy"
      :original-url="originalUrl"
      :enhanced-url="enhancedUrl"
      :ops="ops"
      @close="closeEnhance"
      @change-ops="onEnhanceOpsChange"
      @use-original="confirmUpload(false)"
      @use-enhanced="confirmUpload(true)"
    />
  </main>
</template>
