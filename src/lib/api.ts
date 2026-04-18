const DEFAULT_API_BASE = 'https://vazy.instant-report.workers.dev'

export function apiBaseUrl() {
  const v = import.meta.env.VITE_API_BASE
  if (typeof v === 'string' && v.length > 0) return v.replace(/\/+$/, '')
  return DEFAULT_API_BASE
}

export type ApiError = {
  error: string
  message?: string
}

async function readJsonSafe(res: Response) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: unknown
    key?: string
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.key) headers.authorization = `Bearer ${opts.key}`

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  })

  const data = (await readJsonSafe(res)) as T | ApiError | null

  if (!res.ok) {
    const e = (data && typeof data === 'object' ? data : null) as ApiError | null
    const msg = e?.message ?? e?.error ?? `HTTP_${res.status}`
    throw new Error(msg)
  }

  return data as T
}
