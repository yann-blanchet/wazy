export interface Env {
  APP_ORIGIN: string
  PRIVATE_MENUS: R2Bucket
  RESTAURANTS: KVNamespace
}

type Role = 'master' | 'worker'

type RestaurantPublic = {
  id: string
  name: string
  address: string
  phone: string
}

type MenuItem = {
  date: string // YYYY-MM-DD
  objectKey: string
  createdAt: number
}

type RestaurantRecord = {
  id: string
  workerKey: string
  masterKey: string
  public: RestaurantPublic
  menus: MenuItem[]
}

type KeyIndexRecord = {
  id: string
  role: Role
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers
    }
  })
}

function withCors(req: Request, env: Env, res: Response) {
  const origin = req.headers.get('origin')
  const allowed = new Set<string>([
    env.APP_ORIGIN,
    'https://www.wazymenu.fr',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ])
  const allowOrigin = origin && allowed.has(origin) ? origin : env.APP_ORIGIN

  const headers = new Headers(res.headers)
  headers.set('access-control-allow-origin', allowOrigin)
  headers.set('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
  headers.set('access-control-allow-headers', 'content-type,authorization')
  headers.set('access-control-max-age', '86400')

  return new Response(res.body, { status: res.status, headers })
}

async function readJson<T>(req: Request): Promise<T> {
  const text = await req.text()
  if (!text) throw new Error('Missing JSON body')
  return JSON.parse(text) as T
}

function normalizeKey(k: string) {
  return k.trim()
}

function parseAuthKeyFromHeader(req: Request) {
  const h = req.headers.get('authorization')
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  return normalizeKey(m[1])
}

function randomId(len = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

function randomKey(prefix: 'msr' | 'wkr') {
  return `${prefix}_${randomId(26)}`
}

function isValidRestaurantId(id: string) {
  if (id.length < 3 || id.length > 32) return false
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

async function readJsonOptional<T>(req: Request): Promise<T | null> {
  const text = await req.text()
  if (!text) return null
  return JSON.parse(text) as T
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function getRestaurant(env: Env, id: string): Promise<RestaurantRecord | null> {
  const raw = await env.RESTAURANTS.get(`r:${id}`)
  if (!raw) return null
  return JSON.parse(raw) as RestaurantRecord
}

async function putRestaurant(env: Env, rec: RestaurantRecord) {
  await env.RESTAURANTS.put(`r:${rec.id}`, JSON.stringify(rec))
}

async function getKeyIndex(env: Env, key: string): Promise<KeyIndexRecord | null> {
  const raw = await env.RESTAURANTS.get(`k:${key}`)
  if (!raw) return null
  return JSON.parse(raw) as KeyIndexRecord
}

async function putKeyIndex(env: Env, key: string, rec: KeyIndexRecord) {
  await env.RESTAURANTS.put(`k:${key}`, JSON.stringify(rec))
}

async function deleteKeyIndex(env: Env, key: string) {
  await env.RESTAURANTS.delete(`k:${key}`)
}

async function authRestaurant(env: Env, key: string): Promise<{ rec: RestaurantRecord; role: Role } | null> {
  const idx = await getKeyIndex(env, key)
  if (!idx) return null
  const rec = await getRestaurant(env, idx.id)
  if (!rec) return null
  if (idx.role === 'master' && key !== rec.masterKey) return null
  if (idx.role === 'worker' && key !== rec.workerKey) return null
  return { rec, role: idx.role }
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

  if (url.pathname === '/api/account/create' && req.method === 'POST') {
    const body = await readJsonOptional<{ id?: string }>(req)

    let id: string | null = null
    if (body?.id !== undefined) {
      const requested = String(body.id).trim()
      if (!isValidRestaurantId(requested)) return json({ error: 'invalid_id' }, { status: 400 })
      const existing = await getRestaurant(env, requested)
      if (existing) return json({ error: 'id_taken' }, { status: 409 })
      id = requested
    } else {
      for (let i = 0; i < 10; i++) {
        const candidate = randomId(10)
        const existing = await getRestaurant(env, candidate)
        if (!existing) {
          id = candidate
          break
        }
      }
      if (!id) return json({ error: 'id_generation_failed' }, { status: 500 })
    }

    let workerKey: string | null = null
    let masterKey: string | null = null
    for (let i = 0; i < 10; i++) {
      const wk = randomKey('wkr')
      const mk = randomKey('msr')
      const wkExisting = await getKeyIndex(env, wk)
      const mkExisting = await getKeyIndex(env, mk)
      if (!wkExisting && !mkExisting) {
        workerKey = wk
        masterKey = mk
        break
      }
    }
    if (!workerKey || !masterKey) return json({ error: 'key_generation_failed' }, { status: 500 })

    const rec: RestaurantRecord = {
      id,
      workerKey,
      masterKey,
      public: {
        id,
        name: 'New restaurant',
        address: '',
        phone: ''
      },
      menus: []
    }

    await putRestaurant(env, rec)

    await putKeyIndex(env, masterKey, { id, role: 'master' })
    await putKeyIndex(env, workerKey, { id, role: 'worker' })

    return json({ id, workerKey, masterKey })
  }

  if (url.pathname === '/api/auth' && req.method === 'POST') {
    const body = await readJson<{ key: string }>(req)
    const key = normalizeKey(body.key)
    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    return json({ id: auth.rec.id, role: auth.role })
  }

  if (url.pathname === '/api/worker/regenerate' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const oldWorkerKey = auth.rec.workerKey
    let nextWorkerKey: string | null = null
    for (let i = 0; i < 10; i++) {
      const candidate = randomKey('wkr')
      const existing = await getKeyIndex(env, candidate)
      if (!existing) {
        nextWorkerKey = candidate
        break
      }
    }
    if (!nextWorkerKey) return json({ error: 'key_generation_failed' }, { status: 500 })

    auth.rec.workerKey = nextWorkerKey
    await putRestaurant(env, auth.rec)
    await deleteKeyIndex(env, oldWorkerKey)
    await putKeyIndex(env, nextWorkerKey, { id: auth.rec.id, role: 'worker' })

    return json({ workerKey: auth.rec.workerKey })
  }

  if (url.pathname === '/api/keys' && req.method === 'GET') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    return json({ workerKey: auth.rec.workerKey })
  }

  if (url.pathname === '/api/restaurant' && req.method === 'GET') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    return json({ restaurant: auth.rec.public })
  }

  if (url.pathname === '/api/restaurant' && req.method === 'PUT') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const body = await readJson<{ name?: string; address?: string; phone?: string }>(req)

    auth.rec.public = {
      id: auth.rec.id,
      name: typeof body.name === 'string' ? body.name : auth.rec.public.name,
      address: typeof body.address === 'string' ? body.address : auth.rec.public.address,
      phone: typeof body.phone === 'string' ? body.phone : auth.rec.public.phone
    }

    await putRestaurant(env, auth.rec)
    return json({ restaurant: auth.rec.public })
  }

  if (url.pathname === '/api/menu/presign-upload' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const body = await readJson<{ date?: string; contentType?: string }>(req)
    const date = body.date ?? todayISO()

    const objectKey = `menus/${auth.rec.id}/${date}.jpg`

    const presignFn = (env.PRIVATE_MENUS as unknown as { createPresignedUrl?: Function }).createPresignedUrl
    const uploadUrl =
      typeof presignFn === 'function'
        ? await (presignFn as (opts: unknown) => Promise<string>)({
            method: 'PUT',
            key: objectKey,
            expiresIn: 60 * 5,
            headers: body.contentType ? { 'content-type': body.contentType } : undefined
          })
        : null

    const nextMenus = auth.rec.menus.filter((m) => m.date !== date)
    nextMenus.unshift({ date, objectKey, createdAt: Date.now() })
    auth.rec.menus = nextMenus.slice(0, 30)
    await putRestaurant(env, auth.rec)

    return json({ objectKey, uploadUrl })
  }

  if (url.pathname === '/api/menus' && req.method === 'GET') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    return json({
      id: auth.rec.id,
      menus: auth.rec.menus.map((m) => ({ date: m.date, createdAt: m.createdAt }))
    })
  }

  // Proxy upload fallback (when createPresignedUrl is unavailable)
  if (url.pathname === '/api/menu/upload' && req.method === 'PUT') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const date = url.searchParams.get('date') ?? todayISO()
    const contentType = req.headers.get('content-type') ?? 'image/jpeg'

    const objectKey = `menus/${auth.rec.id}/${date}.jpg`
    const body = req.body
    if (!body) return json({ error: 'missing_body' }, { status: 400 })

    await env.PRIVATE_MENUS.put(objectKey, body, {
      httpMetadata: { contentType }
    })

    const nextMenus = auth.rec.menus.filter((m) => m.date !== date)
    nextMenus.unshift({ date, objectKey, createdAt: Date.now() })
    auth.rec.menus = nextMenus.slice(0, 30)
    await putRestaurant(env, auth.rec)

    return json({ ok: true, objectKey })
  }

  if (url.pathname === '/api/menu' && req.method === 'DELETE') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const date = url.searchParams.get('date')
    if (!date) return json({ error: 'missing_date' }, { status: 400 })

    const m = auth.rec.menus.find((x) => x.date === date)
    if (!m) return json({ ok: true, deleted: false })

    await env.PRIVATE_MENUS.delete(m.objectKey)
    auth.rec.menus = auth.rec.menus.filter((x) => x.date !== date)
    await putRestaurant(env, auth.rec)

    return json({ ok: true, deleted: true })
  }

  // Public metadata for /r/:id
  const publicMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+)$/i)
  if (publicMatch && req.method === 'GET') {
    const id = publicMatch[1]
    const rec = await getRestaurant(env, id)
    if (!rec) return json({ error: 'not_found' }, { status: 404 })

    return json({
      restaurant: rec.public,
      menus: rec.menus.slice(0, 3).map((m) => ({ date: m.date }))
    })
  }

  // Public image fetch: redirects to short-lived signed GET
  const imgMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+)\/menu\/([0-9]{4}-[0-9]{2}-[0-9]{2})$/i)
  if (imgMatch && req.method === 'GET') {
    const id = imgMatch[1]
    const date = imgMatch[2]
    const rec = await getRestaurant(env, id)
    if (!rec) return new Response('Not found', { status: 404 })

    const m = rec.menus.find((x) => x.date === date)
    if (!m) return new Response('Not found', { status: 404 })

    const presignFn = (env.PRIVATE_MENUS as unknown as { createPresignedUrl?: Function }).createPresignedUrl
    if (typeof presignFn === 'function') {
      const signed = await (presignFn as (opts: unknown) => Promise<string>)({
        method: 'GET',
        key: m.objectKey,
        expiresIn: 60
      })

      return new Response(null, {
        status: 302,
        headers: {
          location: signed
        }
      })
    }

    const obj = await env.PRIVATE_MENUS.get(m.objectKey)
    if (!obj) return new Response('Not found', { status: 404 })

    const headers = new Headers()
    obj.writeHttpMetadata(headers)
    headers.set('cache-control', 'public, max-age=60')

    return new Response(obj.body, { status: 200, headers })
  }

  return json({ error: 'not_found' }, { status: 404 })
}

export default {
  async fetch(req: Request, env: Env) {
    try {
      const res = await handle(req, env)
      return withCors(req, env, res)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error'
      return withCors(req, env, json({ error: 'server_error', message }, { status: 500 }))
    }
  }
}
