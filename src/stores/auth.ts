import { defineStore } from 'pinia'
import { apiFetch } from '../lib/api'

export type Role = 'master' | 'worker'

type AuthState = {
  key: string | null
  id: string | null
  role: Role | null
}

const LS_KEY = 'vazy_auth'

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { key: null, id: null, role: null }
    const parsed = JSON.parse(raw) as AuthState
    return {
      key: parsed.key ?? null,
      id: parsed.id ?? null,
      role: parsed.role ?? null
    }
  } catch {
    return { key: null, id: null, role: null }
  }
}

function saveState(s: AuthState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => loadState(),
  getters: {
    isAuthed: (s) => Boolean(s.key && s.id && s.role),
    isMaster: (s) => s.role === 'master'
  },
  actions: {
    logout() {
      this.key = null
      this.id = null
      this.role = null
      saveState(this.$state)
    },
    async loginWithKey(key: string) {
      const res = await apiFetch<{ id: string; role: Role }>('/api/auth', {
        method: 'POST',
        body: { key }
      })

      this.key = key
      this.id = res.id
      this.role = res.role
      saveState(this.$state)
    },
    async createAccount() {
      const res = await apiFetch<{ id: string; workerKey: string; masterKey: string }>(
        '/api/account/create',
        { method: 'POST' }
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
    }
  }
})
