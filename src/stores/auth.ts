import { defineStore } from 'pinia'
import { apiFetch } from '../lib/api'

export type SessionRole = 'owner' | 'staff'

type AuthState = {
  key: string | null
  id: string | null
  role: SessionRole | null
  expiresAt: number | null
}

const LS_KEY = 'vazy_auth'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { key: null, id: null, role: null, expiresAt: null }
    const parsed = JSON.parse(raw) as AuthState
    const expiresAt = typeof parsed.expiresAt === 'number' ? parsed.expiresAt : null
    if (expiresAt !== null && Date.now() > expiresAt) return { key: null, id: null, role: null, expiresAt: null }
    return {
      key: parsed.key ?? null,
      id: parsed.id ?? null,
      role: parsed.role ?? null,
      expiresAt
    }
  } catch {
    return { key: null, id: null, role: null, expiresAt: null }
  }
}

function saveState(s: AuthState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => loadState(),
  getters: {
    isAuthed: (s) => Boolean(s.key && s.id && s.role && (s.expiresAt === null || Date.now() <= s.expiresAt)),
    isMaster: (s) => s.role === 'owner'
  },
  actions: {
    logout() {
      this.key = null
      this.id = null
      this.role = null
      this.expiresAt = null
      saveState(this.$state)
    },
    async loginWithKey(code: string) {
      const res = await apiFetch<{ token: string; role: SessionRole }>('/api/auth/login', {
        method: 'POST',
        body: { code }
      })

      const me = await apiFetch<{ restaurantId: string; role: SessionRole }>('/api/auth/me', {
        method: 'GET',
        key: res.token
      })

      this.key = res.token
      this.id = me.restaurantId
      this.role = res.role
      this.expiresAt = Date.now() + ONE_YEAR_MS
      saveState(this.$state)
    },

    async loginWithQrToken(token: string) {
      await this.loginWithKey(token)
    },
    async createAccount() {
      const res = await apiFetch<{ id: string; workerKey: string; masterKey: string; ownerCode: string; staffCode: string }>(
        '/api/account/create',
        { method: 'POST' }
      )
      return res
    },

    async createAccountWithId(id: string) {
      const res = await apiFetch<{ id: string; workerKey: string; masterKey: string; ownerCode: string; staffCode: string }>(
        '/api/account/create',
        { method: 'POST', body: { id } }
      )
      return res
    },
    async regenerateWorkerKey() {
      if (!this.key) throw new Error('missing_auth')
      const res = await apiFetch<{ workerKey: string }>('/api/worker/regenerate', {
        method: 'POST',
        key: this.key
      })
      return res
    },

    async setWorkerKey(workerKey: string) {
      if (!this.key) throw new Error('missing_auth')
      const res = await apiFetch<{ workerKey: string }>('/api/worker/set-key', {
        method: 'POST',
        key: this.key,
        body: { workerKey }
      })
      return res
    }
  }
})
