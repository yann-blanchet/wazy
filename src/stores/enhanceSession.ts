import { defineStore } from 'pinia'

export type EnhanceTarget = 'menu' | 'event' | 'permanent-menu' | 'restaurant-photo'

type EnhanceSessionState = {
  file: File | null
  defaultDate: string
  target: EnhanceTarget
  returnTo: string
}

export const useEnhanceSessionStore = defineStore('enhanceSession', {
  state: (): EnhanceSessionState => ({
    file: null,
    defaultDate: '',
    target: 'menu',
    returnTo: '/dashboard'
  }),
  actions: {
    start(file: File, defaultDate: string, target: EnhanceTarget = 'menu', returnTo = '/dashboard') {
      this.file = file
      this.defaultDate = defaultDate
      this.target = target
      this.returnTo = returnTo
    },
    clear() {
      this.file = null
      this.defaultDate = ''
      this.target = 'menu'
      this.returnTo = '/dashboard'
    }
  }
})
