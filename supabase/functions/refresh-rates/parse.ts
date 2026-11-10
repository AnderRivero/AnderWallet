// Lo usan la función y los tests. Sin imports, para que corra igual en Vite y en Deno.

export const BINANCE_BODY = {
  fiat: 'VES',
  page: 1,
  rows: 20,
  tradeType: 'SELL',
  asset: 'USDT',
  countries: [],
  proMerchantAds: false,
  shieldMerchantAds: false,
  filterType: 'tradable',
  periods: [],
  additionalKycVerifyFilter: 0,
  publisherType: null,
  payTypes: [],
  classifies: ['profession'],
  tradedWith: true,
  followed: false,
  merchantCheck: true,
}

const MAX_RATE = 1_000_000_000

/** "36,12345678" o "1.234,56" → número. null si no es una tasa razonable. */
export function parseVes(raw: string): number | null {
  const text = raw.replace(/\s|&nbsp;/g, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(text)) return null
  const value = Number(text.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value < MAX_RATE ? value : null
}

function strongAfter(html: string, index: number): number | null {
  if (index < 0) return null
  const match = html.slice(index, index + 2000).match(/<strong[^>]*>\s*([^<]+?)\s*<\/strong>/i)
  return match ? parseVes(match[1]) : null
}

function byContainer(html: string, id: string): number | null {
  return strongAfter(html, html.search(new RegExp(`id=["']${id}["']`, 'i')))
}

function byLabel(html: string, label: string): number | null {
  return strongAfter(html, html.search(new RegExp(`<span[^>]*>\\s*${label}\\s*</span>`, 'i')))
}

function byCentrado(html: string, position: number): number | null {
  const blocks = [...html.matchAll(/<div[^>]*class="[^"]*centrado[^"]*"[^>]*>\s*<strong[^>]*>\s*([\d\s,.]+)\s*<\/strong>/gi)]
  const value = blocks[position]?.[1]
  return value ? parseVes(value) : null
}

/** Mismo orden de búsqueda que PosVe: contenedor por id, etiqueta, y posición en `.centrado`. */
export function parseBcv(html: string): { usd: number | null; eur: number | null } {
  return {
    usd: byContainer(html, 'dolar') ?? byLabel(html, 'USD') ?? byCentrado(html, 4),
    eur: byContainer(html, 'euro') ?? byLabel(html, 'EUR') ?? byCentrado(html, 0),
  }
}

export function averageBinancePrice(body: unknown): number | null {
  const payload = body as { code?: unknown; data?: unknown }
  if (payload?.code !== '000000' || !Array.isArray(payload.data)) return null
  const prices = payload.data
    .map((item) => Number((item as { adv?: { price?: unknown } })?.adv?.price))
    .filter((value) => Number.isFinite(value) && value > 0 && value < MAX_RATE)
  if (prices.length === 0) return null
  return Math.round((prices.reduce((sum, value) => sum + value, 0) / prices.length) * 1e8) / 1e8
}
