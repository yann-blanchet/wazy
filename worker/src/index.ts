export interface Env {
  APP_ORIGIN: string
  RESEND_API_KEY: string
  RESEND_FROM: string
  PRIVATE_MENUS: R2Bucket
  RESTAURANTS: KVNamespace
}

function normalizeRestaurantPhotos(rec: RestaurantRecord): RestaurantPhotoItem[] {
  const anyRec = rec as unknown as { photos?: RestaurantPhotoItem[] }
  if (Array.isArray(anyRec.photos)) return anyRec.photos
  ;(rec as unknown as { photos?: RestaurantPhotoItem[] }).photos = []
  return []
}

type Role = 'master' | 'worker'

type RestaurantPublic = {
  id: string
  name: string
  address: string
  city?: string
  phone: string
  cuisineType?: string
}

type MenuItem = {
  date: string // YYYY-MM-DD
  objectKey: string
  createdAt: number
}

type PermanentMenu = {
  objectKey: string
  updatedAt: number
}

type PermanentMenuItem = {
  id: string
  objectKey: string
  createdAt: number
}

type RestaurantPhotoItem = {
  id: string
  objectKey: string
  createdAt: number
}

type RestaurantRecord = {
  id: string
  workerKey: string
  masterKey: string
  adminEmail?: string
  public: RestaurantPublic
  menus: MenuItem[]
  permanentMenu?: PermanentMenu
  permanentMenus?: PermanentMenuItem[]
  photos?: RestaurantPhotoItem[]
}

function normalizePermanentMenus(rec: RestaurantRecord): PermanentMenuItem[] {
  const anyRec = rec as unknown as { permanentMenus?: PermanentMenuItem[]; permanentMenu?: PermanentMenu }
  if (Array.isArray(anyRec.permanentMenus)) return anyRec.permanentMenus
  if (anyRec.permanentMenu?.objectKey) {
    const migrated: PermanentMenuItem[] = [
      {
        id: 'legacy',
        objectKey: anyRec.permanentMenu.objectKey,
        createdAt: anyRec.permanentMenu.updatedAt
      }
    ]
    ;(rec as unknown as { permanentMenus?: PermanentMenuItem[] }).permanentMenus = migrated
    ;(rec as unknown as { permanentMenu?: PermanentMenu }).permanentMenu = undefined
    return migrated
  }
  ;(rec as unknown as { permanentMenus?: PermanentMenuItem[] }).permanentMenus = []
  return []
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

function normalizeEmail(v: string) {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string) {
  if (v.length < 3 || v.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const bytes = new Uint8Array(buf)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

type RecoveryTokenRecord = {
  id: string
  adminEmail: string
  createdAt: number
}

async function sendRecoveryEmail(
  env: Env,
  opts: {
    to: string
    restaurantId: string
    token: string
  }
) {
  const fromEmail = env.RESEND_FROM
  if (!fromEmail) throw new Error('mail_from_missing')

  const apiKey = env.RESEND_API_KEY
  if (!apiKey) throw new Error('mail_api_key_missing')

  const origin = env.APP_ORIGIN.replace(/\/+$/, '')
  const subject = `Récupération de votre clé maître (${opts.restaurantId})`
  const text =
    `Bonjour,\n\n` +
    `Voici votre code de récupération : ${opts.token}\n\n` +
    `Restaurant : ${opts.restaurantId}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n`

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.4">
    <h2 style="margin: 0 0 12px">Récupération de clé maître</h2>
    <p style="margin: 0 0 12px">Restaurant : <b>${opts.restaurantId}</b></p>
    <p style="margin: 0 0 8px">Code de récupération :</p>
    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 18px; padding: 12px; background: #f3f4f6; border-radius: 12px; display: inline-block">${opts.token}</div>
    <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    <p style="margin: 12px 0 0; color: #6b7280; font-size: 12px">Origine : ${origin}</p>
  </div>
  `.trim()

  const payload = {
    from: fromEmail,
    to: [opts.to],
    subject,
    text,
    html
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`mail_send_failed_${res.status}${t ? `:${t}` : ''}`)
  }
}

function isValidRestaurantId(id: string) {
  if (id.length < 3 || id.length > 32) return false
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

function isValidWorkerKey(k: string) {
  if (k.length < 6 || k.length > 64) return false
  return /^[a-zA-Z0-9_-]+$/.test(k)
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
      adminEmail: undefined,
      public: {
        id,
        name: 'New restaurant',
        address: '',
        city: '',
        phone: '',
        cuisineType: ''
      },
      menus: [],
      permanentMenu: undefined,
      permanentMenus: [],
      photos: []
    }

    await putRestaurant(env, rec)

    await putKeyIndex(env, masterKey, { id, role: 'master' })
    await putKeyIndex(env, workerKey, { id, role: 'worker' })

    return json({ id, workerKey, masterKey })
  }

  if (url.pathname === '/api/account/admin-email' && req.method === 'GET') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    return json({ adminEmail: auth.rec.adminEmail ?? '' })
  }

  if (url.pathname === '/api/account/admin-email' && req.method === 'PUT') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const body = await readJsonOptional<{ adminEmail?: string | null }>(req)
    const nextRaw = typeof body?.adminEmail === 'string' ? body.adminEmail : ''
    const next = normalizeEmail(nextRaw)
    if (next.length > 0 && !isValidEmail(next)) return json({ error: 'invalid_email' }, { status: 400 })

    auth.rec.adminEmail = next.length > 0 ? next : undefined
    await putRestaurant(env, auth.rec)
    return json({ adminEmail: auth.rec.adminEmail ?? '' })
  }

  if (url.pathname === '/api/account/recovery/request' && req.method === 'POST') {
    const body = await readJsonOptional<{ id?: string; adminEmail?: string }>(req)
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const email = typeof body?.adminEmail === 'string' ? normalizeEmail(body.adminEmail) : ''
    if (!id) return json({ error: 'missing_id' }, { status: 400 })
    if (!email) return json({ error: 'missing_email' }, { status: 400 })
    if (!isValidEmail(email)) return json({ error: 'invalid_email' }, { status: 400 })

    const rec = await getRestaurant(env, id)
    if (!rec) return json({ ok: true })

    const stored = normalizeEmail(rec.adminEmail ?? '')
    if (!stored || stored !== email) return json({ ok: true })

    const token = randomId(32)
    const tokenHash = await sha256Hex(`recovery:${token}`)
    const tokenRec: RecoveryTokenRecord = {
      id: rec.id,
      adminEmail: stored,
      createdAt: Date.now()
    }

    await env.RESTAURANTS.put(`recovery:${tokenHash}`, JSON.stringify(tokenRec), {
      expirationTtl: 60 * 15
    })

    await sendRecoveryEmail(env, { to: stored, restaurantId: rec.id, token })

    return json({ ok: true })
  }

  if (url.pathname === '/api/account/recovery/confirm' && req.method === 'POST') {
    const body = await readJsonOptional<{ id?: string; token?: string }>(req)
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    if (!id) return json({ error: 'missing_id' }, { status: 400 })
    if (!token) return json({ error: 'missing_token' }, { status: 400 })

    const tokenHash = await sha256Hex(`recovery:${token}`)
    const raw = await env.RESTAURANTS.get(`recovery:${tokenHash}`)
    if (!raw) return json({ error: 'invalid_token' }, { status: 400 })

    const tokenRec = JSON.parse(raw) as RecoveryTokenRecord
    if (!tokenRec?.id || tokenRec.id !== id) return json({ error: 'invalid_token' }, { status: 400 })

    const rec = await getRestaurant(env, id)
    if (!rec) return json({ error: 'not_found' }, { status: 404 })

    const oldMasterKey = rec.masterKey
    let nextMasterKey: string | null = null
    for (let i = 0; i < 10; i++) {
      const candidate = randomKey('msr')
      const existing = await getKeyIndex(env, candidate)
      if (!existing) {
        nextMasterKey = candidate
        break
      }
    }
    if (!nextMasterKey) return json({ error: 'key_generation_failed' }, { status: 500 })

    rec.masterKey = nextMasterKey
    await putRestaurant(env, rec)
    await deleteKeyIndex(env, oldMasterKey)
    await putKeyIndex(env, nextMasterKey, { id: rec.id, role: 'master' })

    await env.RESTAURANTS.delete(`recovery:${tokenHash}`)

    return json({ masterKey: nextMasterKey })
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

  if (url.pathname === '/api/worker/set-key' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const body = await readJsonOptional<{ workerKey?: string }>(req)
    const nextWorkerKey = normalizeKey(String(body?.workerKey ?? ''))
    if (!isValidWorkerKey(nextWorkerKey)) return json({ error: 'invalid_worker_key' }, { status: 400 })
    if (nextWorkerKey === auth.rec.masterKey) return json({ error: 'invalid_worker_key' }, { status: 400 })

    const existing = await getKeyIndex(env, nextWorkerKey)
    if (existing && !(existing.id === auth.rec.id && existing.role === 'worker')) {
      return json({ error: 'key_taken' }, { status: 409 })
    }

    const oldWorkerKey = auth.rec.workerKey
    auth.rec.workerKey = nextWorkerKey
    await putRestaurant(env, auth.rec)

    if (oldWorkerKey !== nextWorkerKey) {
      await deleteKeyIndex(env, oldWorkerKey)
      await putKeyIndex(env, nextWorkerKey, { id: auth.rec.id, role: 'worker' })
    }

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

    const body = await readJson<{ name?: string; address?: string; city?: string; phone?: string; cuisineType?: string }>(req)

    auth.rec.public = {
      id: auth.rec.id,
      name: typeof body.name === 'string' ? body.name : auth.rec.public.name,
      address: typeof body.address === 'string' ? body.address : auth.rec.public.address,
      city: typeof body.city === 'string' ? body.city : auth.rec.public.city,
      phone: typeof body.phone === 'string' ? body.phone : auth.rec.public.phone,
      cuisineType: typeof body.cuisineType === 'string' ? body.cuisineType : auth.rec.public.cuisineType
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

  if (url.pathname === '/api/permanent-menu/presign-upload' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const body = await readJson<{ contentType?: string }>(req)

    const pid = randomId(12)
    const objectKey = `permanent/${auth.rec.id}/${pid}.jpg`

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

    const items = normalizePermanentMenus(auth.rec)
    items.unshift({ id: pid, objectKey, createdAt: Date.now() })
    ;(auth.rec as unknown as { permanentMenus?: PermanentMenuItem[] }).permanentMenus = items.slice(0, 30)
    await putRestaurant(env, auth.rec)

    return json({ id: pid, objectKey, uploadUrl })
  }

  if (url.pathname === '/api/permanent-menus/reorder' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const body = await readJsonOptional<{ ids?: string[] }>(req)
    const ids = Array.isArray(body?.ids) ? body?.ids : null
    if (!ids) return json({ error: 'invalid_body' }, { status: 400 })

    const items = normalizePermanentMenus(auth.rec)
    const byId = new Map(items.map((x) => [x.id, x] as const))

    const next: PermanentMenuItem[] = []
    for (const id of ids) {
      if (typeof id !== 'string' || id.length === 0) continue
      const item = byId.get(id)
      if (item) next.push(item)
    }

    if (next.length !== items.length) return json({ error: 'invalid_ids' }, { status: 400 })

    ;(auth.rec as unknown as { permanentMenus?: PermanentMenuItem[] }).permanentMenus = next
    await putRestaurant(env, auth.rec)

    return json({ ok: true })
  }

  if (url.pathname === '/api/restaurant-photos/reorder' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const body = await readJsonOptional<{ ids?: string[] }>(req)
    const ids = Array.isArray(body?.ids) ? body?.ids : null
    if (!ids) return json({ error: 'invalid_body' }, { status: 400 })

    const items = normalizeRestaurantPhotos(auth.rec)
    const byId = new Map(items.map((x) => [x.id, x] as const))

    const next: RestaurantPhotoItem[] = []
    for (const id of ids) {
      if (typeof id !== 'string' || id.length === 0) continue
      const item = byId.get(id)
      if (item) next.push(item)
    }

    if (next.length !== items.length) return json({ error: 'invalid_ids' }, { status: 400 })

    ;(auth.rec as unknown as { photos?: RestaurantPhotoItem[] }).photos = next
    await putRestaurant(env, auth.rec)

    return json({ ok: true })
  }

  if (url.pathname === '/api/restaurant-photos/presign-upload' && req.method === 'POST') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const body = await readJson<{ contentType?: string }>(req)

    const pid = randomId(12)
    const objectKey = `photos/${auth.rec.id}/${pid}.jpg`

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

    const items = normalizeRestaurantPhotos(auth.rec)
    items.unshift({ id: pid, objectKey, createdAt: Date.now() })
    ;(auth.rec as unknown as { photos?: RestaurantPhotoItem[] }).photos = items.slice(0, 30)
    await putRestaurant(env, auth.rec)

    return json({ id: pid, objectKey, uploadUrl })
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

  // Proxy upload fallback (when createPresignedUrl is unavailable)
  if (url.pathname === '/api/restaurant-photos/upload' && req.method === 'PUT') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const pid = url.searchParams.get('id')
    if (!pid) return json({ error: 'missing_id' }, { status: 400 })

    const items = normalizeRestaurantPhotos(auth.rec)
    const item = items.find((x) => x.id === pid)
    if (!item) return json({ error: 'unknown_id' }, { status: 400 })

    const contentType = req.headers.get('content-type') ?? 'image/jpeg'
    const body = req.body
    if (!body) return json({ error: 'missing_body' }, { status: 400 })

    await env.PRIVATE_MENUS.put(item.objectKey, body, {
      httpMetadata: { contentType }
    })

    await putRestaurant(env, auth.rec)
    return json({ ok: true, objectKey: item.objectKey })
  }

  // Proxy upload fallback (when createPresignedUrl is unavailable)
  if (url.pathname === '/api/permanent-menu/upload' && req.method === 'PUT') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })

    const pid = url.searchParams.get('id')
    if (!pid) return json({ error: 'missing_id' }, { status: 400 })

    const items = normalizePermanentMenus(auth.rec)
    const item = items.find((x) => x.id === pid)
    if (!item) return json({ error: 'unknown_id' }, { status: 400 })

    const contentType = req.headers.get('content-type') ?? 'image/jpeg'
    const objectKey = item.objectKey
    const body = req.body
    if (!body) return json({ error: 'missing_body' }, { status: 400 })

    await env.PRIVATE_MENUS.put(objectKey, body, {
      httpMetadata: { contentType }
    })

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

  if (url.pathname === '/api/restaurant-photos' && req.method === 'DELETE') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const pid = url.searchParams.get('id')
    if (!pid) return json({ error: 'missing_id' }, { status: 400 })

    const items = normalizeRestaurantPhotos(auth.rec)
    const item = items.find((x) => x.id === pid)
    if (!item) return json({ ok: true, deleted: false })

    await env.PRIVATE_MENUS.delete(item.objectKey)
    ;(auth.rec as unknown as { photos?: RestaurantPhotoItem[] }).photos = items.filter((x) => x.id !== pid)
    await putRestaurant(env, auth.rec)

    return json({ ok: true, deleted: true })
  }

  if (url.pathname === '/api/permanent-menu' && req.method === 'DELETE') {
    const key = parseAuthKeyFromHeader(req)
    if (!key) return json({ error: 'missing_auth' }, { status: 401 })

    const auth = await authRestaurant(env, key)
    if (!auth) return json({ error: 'invalid_key' }, { status: 401 })
    if (auth.role !== 'master') return json({ error: 'forbidden' }, { status: 403 })

    const pid = url.searchParams.get('id')
    if (!pid) return json({ error: 'missing_id' }, { status: 400 })

    const items = normalizePermanentMenus(auth.rec)
    const item = items.find((x) => x.id === pid)
    if (!item) return json({ ok: true, deleted: false })

    await env.PRIVATE_MENUS.delete(item.objectKey)
    ;(auth.rec as unknown as { permanentMenus?: PermanentMenuItem[] }).permanentMenus = items.filter((x) => x.id !== pid)
    await putRestaurant(env, auth.rec)

    return json({ ok: true, deleted: true })
  }

  // Public metadata for /r/:id
  const publicMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+)$/i)
  if (publicMatch && req.method === 'GET') {
    const id = publicMatch[1]
    const rec = await getRestaurant(env, id)
    if (!rec) return json({ error: 'not_found' }, { status: 404 })

    const permanentMenus = normalizePermanentMenus(rec)
    const photos = normalizeRestaurantPhotos(rec)

    return json({
      restaurant: rec.public,
      menus: rec.menus.slice(0, 3).map((m) => ({ date: m.date })),
      permanentMenu: null,
      permanentMenus: permanentMenus.slice(0, 30).map((m) => ({ id: m.id, createdAt: m.createdAt })),
      photos: photos.slice(0, 30).map((p) => ({ id: p.id, createdAt: p.createdAt }))
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

  const photoItemMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+)\/photo\/([a-z0-9_-]+)$/i)
  if (photoItemMatch && req.method === 'GET') {
    const id = photoItemMatch[1]
    const pid = photoItemMatch[2]
    const rec = await getRestaurant(env, id)
    if (!rec) return new Response('Not found', { status: 404 })

    const photos = normalizeRestaurantPhotos(rec)
    const item = photos.find((x) => x.id === pid)
    if (!item) return new Response('Not found', { status: 404 })

    const presignFn = (env.PRIVATE_MENUS as unknown as { createPresignedUrl?: Function }).createPresignedUrl
    if (typeof presignFn === 'function') {
      const signed = await (presignFn as (opts: unknown) => Promise<string>)({
        method: 'GET',
        key: item.objectKey,
        expiresIn: 60
      })

      return new Response(null, {
        status: 302,
        headers: {
          location: signed
        }
      })
    }

    const obj = await env.PRIVATE_MENUS.get(item.objectKey)
    if (!obj) return new Response('Not found', { status: 404 })

    const headers = new Headers()
    obj.writeHttpMetadata(headers)
    headers.set('cache-control', 'public, max-age=60')

    return new Response(obj.body, { status: 200, headers })
  }

  const permItemMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+)\/permanent-menu\/([a-z0-9_-]+)$/i)
  if (permItemMatch && req.method === 'GET') {
    const id = permItemMatch[1]
    const pid = permItemMatch[2]
    const rec = await getRestaurant(env, id)
    if (!rec) return new Response('Not found', { status: 404 })

    const permanentMenus = normalizePermanentMenus(rec)
    const item = permanentMenus.find((x) => x.id === pid)
    if (!item) return new Response('Not found', { status: 404 })

    const presignFn = (env.PRIVATE_MENUS as unknown as { createPresignedUrl?: Function }).createPresignedUrl
    if (typeof presignFn === 'function') {
      const signed = await (presignFn as (opts: unknown) => Promise<string>)({
        method: 'GET',
        key: item.objectKey,
        expiresIn: 60
      })

      return new Response(null, {
        status: 302,
        headers: {
          location: signed
        }
      })
    }

    const obj = await env.PRIVATE_MENUS.get(item.objectKey)
    if (!obj) return new Response('Not found', { status: 404 })

    const headers = new Headers()
    obj.writeHttpMetadata(headers)
    headers.set('cache-control', 'public, max-age=60')

    return new Response(obj.body, { status: 200, headers })
  }

  const permMatch = url.pathname.match(/^\/api\/public\/([a-z0-9]+)\/permanent-menu$/i)
  if (permMatch && req.method === 'GET') {
    const id = permMatch[1]
    const rec = await getRestaurant(env, id)
    if (!rec) return new Response('Not found', { status: 404 })

    const permanentMenus = normalizePermanentMenus(rec)
    const objectKey = permanentMenus[0]?.objectKey
    if (!objectKey) return new Response('Not found', { status: 404 })

    const presignFn = (env.PRIVATE_MENUS as unknown as { createPresignedUrl?: Function }).createPresignedUrl
    if (typeof presignFn === 'function') {
      const signed = await (presignFn as (opts: unknown) => Promise<string>)({
        method: 'GET',
        key: objectKey,
        expiresIn: 60
      })

      return new Response(null, {
        status: 302,
        headers: {
          location: signed
        }
      })
    }

    const obj = await env.PRIVATE_MENUS.get(objectKey)
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
