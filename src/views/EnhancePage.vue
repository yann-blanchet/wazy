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

const step = ref<1 | 2>(1)
const chosenDate = ref<string>('')

const busy = ref<boolean>(false)
const enhancedUrl = ref<string>('')
const enhancedBlob = ref<Blob | null>(null)

const ops = ref<EnhanceOps>({
  autobalance: false,
  autocrop: false,
  shadowremoval: false,
  sharpen: false
})

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

  step.value = 1
  chosenDate.value = session.defaultDate
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
          <img v-if="enhancedUrl" class="h-full w-full object-cover" :src="enhancedUrl" alt="Enhanced" />
        </div>
        <div v-if="busy" class="absolute inset-0 grid place-items-center bg-black/35">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        </div>
      </div>

      <div class="mt-4">
        <div v-if="step === 1">
          <div class="flex flex-wrap gap-2">
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

          <button
            class="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
            :disabled="busy"
            @click="step = 2"
          >
            Next
          </button>
        </div>

        <div v-else class="grid gap-3">
          <label class="grid gap-2">
            <span class="text-sm text-slate-300">Date</span>
            <input
              v-model="chosenDate"
              type="date"
              class="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none focus:border-emerald-400/60"
            />
          </label>

          <div class="grid grid-cols-2 gap-2">
            <button class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15" :disabled="busy" @click="step = 1">
              Back
            </button>
            <button
              class="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
              :disabled="busy || chosenDate.length === 0"
              @click="save"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
