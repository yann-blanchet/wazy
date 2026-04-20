import { defineStore } from 'pinia'

type EnhanceSessionState = {
  file: File | null
  defaultDate: string
}

export const useEnhanceSessionStore = defineStore('enhanceSession', {
  state: (): EnhanceSessionState => ({
    file: null,
    defaultDate: ''
  }),
  actions: {
    start(file: File, defaultDate: string) {
      this.file = file
      this.defaultDate = defaultDate
    },
    clear() {
      this.file = null
      this.defaultDate = ''
    }
  }
})
