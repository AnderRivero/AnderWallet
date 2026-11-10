import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const DEFAULT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,https://anderrivero.github.io'

function allowedOrigins(): string[] {
  return (Deno.env.get('APP_ORIGINS') ?? DEFAULT_ORIGINS)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (allowedOrigins().includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

export function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function adminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function isCron(request: Request): boolean {
  return sameSecret(Deno.env.get('CRON_SECRET') ?? '', request.headers.get('x-cron-secret') ?? '')
}

/** Sesión real (la valida Auth), con segundo factor y correo en allowed_users. */
export async function isAllowedUser(request: Request, admin: SupabaseClient): Promise<boolean> {
  const jwt = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt || jwt === (Deno.env.get('SUPABASE_ANON_KEY') ?? '')) return false
  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user?.email) return false
  if (claims(jwt)?.aal !== 'aal2') return false
  const email = data.user.email.toLowerCase()
  const { data: allowed } = await admin.from('allowed_users').select('email').eq('email', email).maybeSingle()
  return Boolean(allowed)
}

function claims(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split('.')[1] ?? ''
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return null
  }
}

function sameSecret(expected: string, provided: string): boolean {
  const left = new TextEncoder().encode(expected)
  const right = new TextEncoder().encode(provided)
  if (left.length < 16 || left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index]
  return diff === 0
}
