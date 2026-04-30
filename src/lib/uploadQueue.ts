import { apiFetch } from './api'

type UploadRecord = {
  id: string
  createdAt: number
  authKey: string
  date: string
  contentType: string
  blob: Blob
}

const DB_NAME = 'vazy'
const DB_VERSION = 1
const STORE = 'uploads'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('idb_open_failed'))
  })
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    const req = fn(store)

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('idb_tx_failed'))
  })
}

export async function enqueueUpload(rec: UploadRecord) {
  const db = await openDb()
  await tx(db, 'readwrite', (s) => s.put(rec))
  db.close()
}

export async function uploadQueueCount(): Promise<number> {
  const db = await openDb()
  const count = await tx(db, 'readonly', (s) => s.count())
  db.close()
  return count
}

async function listAll(): Promise<UploadRecord[]> {
  const db = await openDb()
  const all = await tx(db, 'readonly', (s) => s.getAll())
  db.close()
  const arr = (all ?? []) as UploadRecord[]
  return arr.sort((a, b) => a.createdAt - b.createdAt)
}

async function remove(id: string) {
  const db = await openDb()
  await tx(db, 'readwrite', (s) => s.delete(id))
  db.close()
}

export async function removeQueuedByDate(date: string) {
  const items = await listAll()
  const toRemove = items.filter((i) => i.date === date)
  if (toRemove.length === 0) return 0

  const db = await openDb()
  const t = db.transaction(STORE, 'readwrite')
  const store = t.objectStore(STORE)
  for (const it of toRemove) store.delete(it.id)

  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error ?? new Error('idb_tx_failed'))
    t.onabort = () => reject(t.error ?? new Error('idb_tx_failed'))
  })
  db.close()
  return toRemove.length
}

export async function flushUploadQueue(opts: {
  onStatus?: (s: string) => void
  maxItems?: number
} = {}) {
  const items = await listAll()
  if (items.length === 0) return { uploaded: 0, remaining: 0 }

  const max = opts.maxItems ?? 20
  let uploaded = 0

  for (const item of items.slice(0, max)) {
    if (!navigator.onLine) break

    if (!item.authKey) {
      await remove(item.id)
      continue
    }

    opts.onStatus?.(`Uploading queued photo… (${uploaded + 1}/${Math.min(items.length, max)})`)

    let presign: { objectKey: string; uploadUrl: string | null } | null = null
    try {
      presign = await apiFetch<{ objectKey: string; uploadUrl: string | null }>(
        '/api/menu/presign-upload',
        {
          method: 'POST',
          key: item.authKey,
          suppressInvalidAuthEvent: true,
          body: { date: item.date, contentType: item.contentType }
        }
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'missing_auth' || msg === 'HTTP_401') {
        await remove(item.id)
        continue
      }
      throw e
    }

    if (!presign) continue

    const putRes = presign.uploadUrl
      ? await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: {
            'content-type': item.contentType
          },
          body: item.blob
        })
      : await fetch(`${apiFetchBase()}/api/menu/upload?date=${encodeURIComponent(item.date)}`, {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${item.authKey}`,
            'content-type': item.contentType
          },
          body: item.blob
        })

    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    await remove(item.id)
    uploaded += 1
  }

  const remaining = await uploadQueueCount()
  if (remaining === 0) opts.onStatus?.('All queued uploads completed.')
  return { uploaded, remaining }
}

function apiFetchBase() {
  const v = import.meta.env.VITE_API_BASE
  const base = typeof v === 'string' && v.length > 0 ? v : 'https://vazy.instant-report.workers.dev'
  return base.replace(/\/+$/, '')
}

export function newUploadId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export type { UploadRecord }
