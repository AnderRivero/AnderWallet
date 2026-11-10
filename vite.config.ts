import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function contentSecurityPolicy(supabaseUrl: string): Plugin {
  const supabase = supabaseUrl.replace(/\/+$/, '')
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${supabase} ${supabase.replace(/^https:/, 'wss:')} https://api.iconify.design`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    'upgrade-insecure-requests',
  ].join('; ')

  return {
    name: 'anderwallet-csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (!supabase.startsWith('https://')) {
        throw new Error('VITE_SUPABASE_URL tiene que ser https:// para publicar la app.')
      }
      return html.replace(
        '<!-- csp -->',
        `<meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_SUPABASE_URL ?? '')],
    base: './',
    build: { sourcemap: false },
  }
})
