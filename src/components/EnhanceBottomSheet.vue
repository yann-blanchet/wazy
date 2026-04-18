<script setup lang="ts">
import type { EnhanceOps } from '../lib/enhance'

type OpsKey = keyof EnhanceOps

const props = defineProps<{
  open: boolean
  busy: boolean
  originalUrl: string
  enhancedUrl: string
  ops: EnhanceOps
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'changeOps', next: EnhanceOps): void
  (e: 'useOriginal'): void
  (e: 'useEnhanced'): void
}>()

function toggle(k: OpsKey) {
  emit('changeOps', { ...props.ops, [k]: !props.ops[k] })
}

function reset() {
  emit('changeOps', { autobalance: false, autocrop: false, shadowremoval: false, sharpen: false })
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-[60] bg-black/70 p-4">
    <div class="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-slate-950 ring-1 ring-white/10">
      <div class="flex items-center justify-between px-5 py-4">
        <div class="text-sm font-medium text-slate-200">Enhance</div>
        <button class="text-sm text-slate-300 underline" @click="emit('close')">Close</button>
      </div>

      <div class="grid flex-1 grid-cols-2 gap-3 px-5 pb-5">
        <div class="overflow-hidden rounded-2xl bg-black/30">
          <div class="px-3 py-2 text-xs text-slate-300">Original</div>
          <img v-if="originalUrl" class="w-full object-cover" :src="originalUrl" alt="Original" />
        </div>
        <div class="overflow-hidden rounded-2xl bg-black/30">
          <div class="px-3 py-2 text-xs text-slate-300">Enhanced</div>
          <img v-if="enhancedUrl" class="w-full object-cover" :src="enhancedUrl" alt="Enhanced" />
        </div>
      </div>

      <div class="border-t border-white/10 p-4">
        <div class="grid grid-cols-5 gap-2">
          <button
            class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            :disabled="busy"
            @click="toggle('autobalance')"
          >
            Autobalance
          </button>
          <button
            class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            :disabled="busy"
            @click="toggle('autocrop')"
          >
            Autocrop
          </button>
          <button
            class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            :disabled="busy"
            @click="toggle('shadowremoval')"
          >
            Shadowremoval
          </button>
          <button
            class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            :disabled="busy"
            @click="toggle('sharpen')"
          >
            Sharpen
          </button>
          <button
            class="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15"
            :disabled="busy"
            @click="reset"
          >
            Reset
          </button>
        </div>

        <div class="mt-3 flex gap-2">
          <button
            class="flex-1 rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15"
            :disabled="busy"
            @click="emit('useOriginal')"
          >
            Use original
          </button>
          <button
            class="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
            :disabled="busy"
            @click="emit('useEnhanced')"
          >
            Use enhanced
          </button>
        </div>

        <div v-if="busy" class="mt-2 text-xs text-slate-400">Processing…</div>
      </div>
    </div>
  </div>
</template>
