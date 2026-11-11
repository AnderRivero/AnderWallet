import { adminClient, corsHeaders, isAllowedUser, isCron, json } from '../_shared/guard.ts'
import { BCV_INTERMEDIATE } from './bcv-ca.ts'
import { averageBinancePrice, BINANCE_BODY, parseBcv } from './parse.ts'

type Key = 'bcv_usd' | 'bcv_eur' | 'binance_usdt'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Método no permitido' }, 405)

  const admin = adminClient()
  if (!admin) return json(request, { error: 'Falta la configuración de Supabase.' }, 500)
  if (!isCron(request) && !(await isAllowedUser(request, admin))) return json(request, { error: 'No autorizado' }, 401)

  const errors: string[] = []
  const found: Partial<Record<Key, number>> = {}

  const [bcv, binance] = await Promise.allSettled([fetchBcv(), fetchBinance()])
  if (bcv.status === 'fulfilled') {
    if (bcv.value.usd) found.bcv_usd = bcv.value.usd
    else errors.push('BCV: no se encontró el dólar en la página.')
    if (bcv.value.eur) found.bcv_eur = bcv.value.eur
    else errors.push('BCV: no se encontró el euro en la página.')
  } else {
    errors.push(`BCV: ${reason(bcv.reason)}`)
  }
  if (binance.status === 'fulfilled') found.binance_usdt = binance.value
  else errors.push(`Binance: ${reason(binance.reason)}`)

  const now = new Date().toISOString()
  for (const [source, value] of Object.entries(found) as Array<[Key, number]>) {
    const { error } = await admin.from('rate_snapshots').update({ ves_per_unit: value, fetched_at: now }).eq('source', source)
    if (error) errors.push(`${source}: ${error.message}`)
  }

  if (errors.length) console.warn(`Tasas con avisos: ${errors.join(' | ')}`)
  return json(request, { rates: found, errors })
})

async function fetchBcv(): Promise<{ usd: number | null; eur: number | null }> {
  const extra = Deno.env.get('BCV_CA_CERT')
  const client = Deno.createHttpClient({ caCerts: extra ? [BCV_INTERMEDIATE, extra] : [BCV_INTERMEDIATE] })
  try {
    const response = await fetch('https://www.bcv.org.ve/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (AnderWallet)', Accept: 'text/html' },
      signal: AbortSignal.timeout(15_000),
      client,
    } as RequestInit)
    if (!response.ok) throw new Error(`respondió ${response.status}`)
    return parseBcv(await response.text())
  } catch (error) {
    const message = reason(error)
    if (/certificate|cert|tls|ssl/i.test(message)) {
      throw new Error(`falló el certificado de bcv.org.ve (${message}). Carga BCV_CA_CERT, mira el README.`)
    }
    throw error
  } finally {
    client?.close()
  }
}

async function fetchBinance(): Promise<number> {
  const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (AnderWallet)' },
    body: JSON.stringify(BINANCE_BODY),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`respondió ${response.status}`)
  const value = averageBinancePrice(await response.json())
  if (value == null) throw new Error('no devolvió anuncios válidos.')
  return value
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
