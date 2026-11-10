import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export function isSupabaseConfigured(): boolean {
  return url.startsWith('https://') && anonKey.length > 20 && !anonKey.includes('tu-anon-key')
}

/** La sesión vive solo en esta pestaña: al cerrarla hay que volver a entrar con Google y el código. */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storage: window.sessionStorage,
        storageKey: 'anderwallet-session',
      },
    })
  : null

export function redirectUrl(): string {
  const current = new URL(window.location.href)
  current.hash = ''
  current.search = ''
  current.pathname = current.pathname.replace(/index\.html$/, '')
  if (!current.pathname.endsWith('/')) current.pathname += '/'
  return current.origin + current.pathname
}
