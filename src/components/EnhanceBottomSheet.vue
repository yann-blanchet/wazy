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
  <div v-if="open" class="fixed inset-0 z-[60] bg-black/70">
    <div
      class="absolute bottom-0 left-0 right-0 mx-auto flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-slate-950 ring-1 ring-white/10"
      style="padding-bottom: max(env(safe-area-inset-bottom), 0px)"
    >
      <div class="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950 px-5 py-4">
        <div class="text-sm font-medium text-slate-200">Enhance</div>
        <button class="text-sm text-slate-300 underline" @click="emit('close')">Close</button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 pb-5 pt-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="hidden overflow-hidden rounded-2xl bg-black/30 sm:block">
            <div class="px-3 py-2 text-xs text-slate-300">Original</div>
            <div class="aspect-[4/5] overflow-hidden">
              <img v-if="originalUrl" class="h-full w-full object-cover" :src="originalUrl" alt="Original" />
            </div>
          </div>
          <div class="overflow-hidden rounded-2xl bg-black/30">
            <div class="px-3 py-2 text-xs text-slate-300">Enhanced</div>
            <div class="aspect-[4/5] overflow-hidden">
              <img v-if="enhancedUrl" class="h-full w-full object-cover" :src="enhancedUrl" alt="Enhanced" />
            </div>
          </div>
        </div>
      </div>

      <div class="border-t border-white/10 p-4">
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

        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            class="rounded-xl bg-white/10 px-4 py-3 text-sm hover:bg-white/15"
            :disabled="busy"
            @click="emit('useOriginal')"
          >
            Use original
          </button>
          <button
            class="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
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
