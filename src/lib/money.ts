import type { Account, Currency, Movement, RateSource, Rates, Receivable } from './types'

export const SOURCE_LABEL: Record<RateSource, string> = {
  bcv: 'BCV',
  binance: 'Binance',
  manual: 'Manual',
}

/**
 * Dólares que vale 1 unidad de `currency`, con la tasa que eligió la cuenta.
 * Si BCV o Binance todavía no tienen valor, el bolívar usa la tasa manual. null si no hay ninguna.
 */
export function usdPerUnit(currency: Currency, source: RateSource, rates: Rates): number | null {
  if (currency === 'USD' || currency === 'USDT') return 1
  if (currency === 'EUR') {
    if (!rates.bcv_eur || !rates.bcv_usd) return null
    return rates.bcv_eur / rates.bcv_usd
  }
  const chosen = source === 'bcv' ? rates.bcv_usd : source === 'binance' ? rates.binance_usdt : rates.manual_usd
  const vesPerUsd = chosen ?? rates.manual_usd
  return vesPerUsd ? 1 / vesPerUsd : null
}

/** Cuántas unidades de `to` vale 1 unidad de `from`, con la misma fuente de tasa. */
export function crossRate(from: Currency, to: Currency, source: RateSource, rates: Rates): number | null {
  if (from === to) return 1
  const fromUsd = usdPerUnit(from, source, rates)
  const toUsd = usdPerUnit(to, source, rates)
  if (fromUsd == null || toUsd == null) return null
  return fromUsd / toUsd
}

/** Euro siempre cruza por el BCV: Binance no publica EUR. */
export function euroCrossesBcv(account: Pick<Account, 'currency' | 'refCurrency' | 'rateSource'>): boolean {
  return account.rateSource !== 'bcv' && (account.currency === 'EUR' || account.refCurrency === 'EUR')
}

export function signedAmount(movement: Pick<Movement, 'amount' | 'direction'>): number {
  return movement.amount * movement.direction
}

export function accountBalance(accountId: string, movements: Movement[]): number {
  return round(
    movements.filter((movement) => movement.accountId === accountId).reduce((sum, movement) => sum + signedAmount(movement), 0),
  )
}

export function receivablePending(receivable: Receivable, movements: Movement[]): number {
  if (receivable.writtenOff) return 0
  const collected = movements
    .filter((movement) => movement.receivableId === receivable.id && movement.kind === 'collection')
    .reduce((sum, movement) => sum + (movement.receivableAmount ?? 0), 0)
  return Math.max(0, round(receivable.principal - collected))
}

export function receivableCollected(receivable: Receivable, movements: Movement[]): number {
  return round(
    movements
      .filter((movement) => movement.receivableId === receivable.id && movement.kind === 'collection')
      .reduce((sum, movement) => sum + (movement.receivableAmount ?? 0), 0),
  )
}

/** Fuente para convertir algo que no es una cuenta: la de la primera cuenta en esa moneda, o BCV. */
export function sourceForCurrency(currency: Currency, accounts: Account[]): RateSource {
  return accounts.find((account) => account.currency === currency)?.rateSource ?? 'bcv'
}

export type Totals = {
  netUsd: number
  receivablesUsd: number
  grossUsd: number
  missingRates: string[]
}

export function totals(accounts: Account[], receivables: Receivable[], movements: Movement[], rates: Rates): Totals {
  const missing: string[] = []
  let netUsd = 0
  for (const account of accounts) {
    const balance = accountBalance(account.id, movements)
    if (balance === 0) continue
    const factor = usdPerUnit(account.currency, account.rateSource, rates)
    if (factor == null) {
      missing.push(account.name)
      continue
    }
    netUsd += balance * factor
  }
  let receivablesUsd = 0
  for (const receivable of receivables) {
    const pending = receivablePending(receivable, movements)
    if (pending === 0) continue
    const factor = usdPerUnit(receivable.currency, sourceForCurrency(receivable.currency, accounts), rates)
    if (factor == null) {
      missing.push(receivable.person)
      continue
    }
    receivablesUsd += pending * factor
  }
  return {
    netUsd: round(netUsd),
    receivablesUsd: round(receivablesUsd),
    grossUsd: round(netUsd + receivablesUsd),
    missingRates: missing,
  }
}

export function round(value: number, digits = 8): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const SYMBOL: Record<Currency, string> = { USD: '$', VES: 'Bs.', EUR: '€', USDT: '₮' }

export function formatMoney(value: number, currency: Currency, options: { signed?: boolean } = {}): string {
  const number = new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))
  const sign = value < 0 ? '−' : options.signed && value > 0 ? '+' : ''
  return `${sign}${SYMBOL[currency]} ${number}`
}

export function formatRate(value: number): string {
  return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

export function parseAmount(raw: string): number | null {
  let text = raw.trim().replace(/\s/g, '')
  if (!text) return null
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma > lastDot) text = text.replace(/\./g, '').replace(',', '.')
  else if (lastDot > lastComma && lastComma !== -1) text = text.replace(/,/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

export function amountInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return String(round(value, 8)).replace('.', ',')
}
