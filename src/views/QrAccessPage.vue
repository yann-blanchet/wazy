<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as QRCode from 'qrcode'
import { apiFetch } from '../lib/api'
import { useAuthStore } from '../stores/auth'

type Role = 'master' | 'worker'

type QrLinkMeta = {
  tokenHash: string
  role: Role
  createdAt: number
  url?: string
}

const router = useRouter()
const auth = useAuthStore()

const status = ref<string>('')
const items = ref<QrLinkMeta[]>([])

const activeSvgs = ref<Record<string, string>>({})

const lastCreatedUrl = ref<string>('')
const lastCreatedSvg = ref<string>('')

const workerLink = computed(() => items.value.find((it) => it.role === 'worker') ?? null)
const masterLink = computed(() => items.value.find((it) => it.role === 'master') ?? null)

async function computeActiveSvgs(nextItems: QrLinkMeta[]) {
  const next: Record<string, string> = {}
  for (const it of nextItems) {
    if (!it.url) continue
    try {
      next[it.tokenHash] = await (QRCode as unknown as { toString: (text: string, opts: unknown) => Promise<string> }).toString(it.url, {
        type: 'svg',
        margin: 1,
        width: 200
      })
    } catch {
      // ignore per-item failures
    }
  }
  activeSvgs.value = next
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const canUsePage = computed(() => auth.isMaster)

async function goBack() {
  await router.push({ path: '/dashboard', query: { tab: 'compte' } })
}

async function refresh() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    status.value = 'Chargement…'
    const res = await apiFetch<{ items: QrLinkMeta[] }>('/api/qr/list', { method: 'GET', key: auth.key })
    items.value = Array.isArray(res.items) ? res.items : []

    await computeActiveSvgs(items.value)

    status.value = ''
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'load_failed'
  }
}

watch(
  items,
  async (next) => {
    await computeActiveSvgs(next)
  },
  { deep: true }
)

async function createEmployeeQr() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    status.value = 'Génération…'
    lastCreatedUrl.value = ''
    lastCreatedSvg.value = ''

    const res = await apiFetch<{ url: string } & { tokenHash: string }>('/api/qr/create', {
      method: 'POST',
      key: auth.key,
      body: { role: 'worker' }
    })

    lastCreatedUrl.value = res.url
    lastCreatedSvg.value = (await (QRCode as unknown as { toString: (text: string, opts: unknown) => Promise<string> }).toString(res.url, {
      type: 'svg',
      margin: 1,
      width: 240
    }))

    await refresh()
    status.value = 'QR employé mis à jour.'
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'create_failed'
  }
}

async function createOwnerQr() {
  try {
    if (!auth.key) throw new Error('missing_auth')
    status.value = 'Génération…'
    lastCreatedUrl.value = ''
    lastCreatedSvg.value = ''

    const res = await apiFetch<{ url: string } & { tokenHash: string }>('/api/qr/create', {
      method: 'POST',
      key: auth.key,
      body: { role: 'master' }
    })

    lastCreatedUrl.value = res.url
    lastCreatedSvg.value = (await (QRCode as unknown as { toString: (text: string, opts: unknown) => Promise<string> }).toString(res.url, {
      type: 'svg',
      margin: 1,
      width: 240
    }))

    await refresh()
    status.value = 'QR admin mis à jour.'
  } catch (e) {
    status.value = e instanceof Error ? e.message : 'create_failed'
  }
}

async function copyUrl(url: string) {
  await navigator.clipboard.writeText(url)
}

onMounted(async () => {
  if (!canUsePage.value) return
  await refresh()
})
</script>

<template>
  <main class="mx-auto max-w-lg p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Accès QR</h1>
      <button class="text-sm text-secondary underline hover:text-secondary/80" type="button" @click="goBack">Retour</button>
    </div>

    <div v-if="!canUsePage" class="mt-6 rounded-2xl bg-black/5 p-5 text-sm text-primary/70">
      Disponible uniquement avec la clé owner.
    </div>

    <template v-else>
      <section class="mt-6 rounded-2xl bg-black/5 p-5">
        <h2 class="text-lg font-semibold text-primary">QR codes</h2>

        <div v-if="lastCreatedUrl" class="mt-4 grid gap-3">
          <div class="rounded-xl bg-black/10 p-3">
            <div class="text-xs text-primary/70">Lien (à mettre dans un QR)</div>
            <div class="mt-1 break-all font-mono text-xs text-primary">{{ lastCreatedUrl }}</div>
            <div class="mt-3 flex gap-2">
              <button class="rounded-lg bg-black/10 px-3 py-2 text-sm text-primary hover:bg-black/15" type="button" @click="copyUrl(lastCreatedUrl)">
                Copier
              </button>
            </div>
          </div>

          <div class="rounded-xl bg-white p-4" v-html="lastCreatedSvg" />
        </div>

        <div v-if="status" class="mt-4 text-xs text-primary/70">{{ status }}</div>
      </section>

      <section class="mt-4 rounded-2xl bg-black/5 p-5">
        <h2 class="text-lg font-semibold text-primary">QR actifs</h2>

        <div class="mt-3 grid gap-3">
          <div class="rounded-xl bg-black/10 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-primary">Employés</div>
                <div v-if="workerLink" class="text-xs text-primary/70">Créé: {{ formatDate(workerLink.createdAt) }}</div>
                <div v-else class="text-xs text-primary/70">Aucun QR</div>
              </div>
              <button class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-background hover:bg-primary/90" type="button" @click="createEmployeeQr">
                Régénérer
              </button>
            </div>

            <div v-if="workerLink?.url" class="mt-3 grid gap-3">
              <div class="break-all font-mono text-[11px] text-primary/60">{{ workerLink.url }}</div>
              <div v-if="activeSvgs[workerLink.tokenHash]" class="rounded-xl bg-white p-3" v-html="activeSvgs[workerLink.tokenHash]" />
              <div v-else class="rounded-xl bg-white p-3 text-xs text-primary/60 ring-1 ring-black/10">QR non chargé.</div>
            </div>
            <div v-else-if="workerLink" class="mt-3 text-xs text-primary/60">Lien manquant: clique sur Régénérer.</div>
          </div>

          <div class="rounded-xl bg-black/10 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-primary">Admin</div>
                <div v-if="masterLink" class="text-xs text-primary/70">Créé: {{ formatDate(masterLink.createdAt) }}</div>
                <div v-else class="text-xs text-primary/70">Aucun QR</div>
              </div>
              <button class="rounded-xl bg-black/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-black/15" type="button" @click="createOwnerQr">
                Régénérer
              </button>
            </div>

            <div v-if="masterLink?.url" class="mt-3 grid gap-3">
              <div class="break-all font-mono text-[11px] text-primary/60">{{ masterLink.url }}</div>
              <div v-if="activeSvgs[masterLink.tokenHash]" class="rounded-xl bg-white p-3" v-html="activeSvgs[masterLink.tokenHash]" />
              <div v-else class="rounded-xl bg-white p-3 text-xs text-primary/60 ring-1 ring-black/10">QR non chargé.</div>
            </div>
            <div v-else-if="masterLink" class="mt-3 text-xs text-primary/60">Lien manquant: clique sur Régénérer.</div>
          </div>
        </div>
      </section>

      <button class="mt-6 w-full rounded-xl bg-black/10 px-4 py-3 text-sm text-primary hover:bg-black/15" type="button" @click="refresh">
        Rafraîchir
      </button>
    </template>
  </main>
</template>
