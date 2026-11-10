import { describe, expect, it } from 'vitest'
import { accountBalance, crossRate, parseAmount, receivablePending, totals, usdPerUnit } from './money'
import type { Account, Movement, Rates, Receivable } from './types'

const rates: Rates = { bcv_usd: 200, bcv_eur: 220, binance_usdt: 300, manual_usd: 250 }

function account(id: string, currency: Account['currency'], rateSource: Account['rateSource'] = 'bcv'): Account {
  return {
    id,
    name: id,
    kind: 'bank',
    currency,
    rateSource,
    refCurrency: null,
    color: '#22c55e',
    icon: { kind: 'lucide', value: 'Landmark' },
    featured: true,
    notes: null,
    sortOrder: 0,
  }
}

function movement(partial: Partial<Movement> & Pick<Movement, 'accountId' | 'amount' | 'direction' | 'kind'>): Movement {
  return {
    id: Math.random().toString(36),
    categoryId: null,
    occurredOn: '2026-11-10',
    note: null,
    usdRate: null,
    usdAmount: null,
    transferGroup: null,
    receivableId: null,
    receivableAmount: null,
    recurringId: null,
    ...partial,
  }
}

describe('conversión a dólares', () => {
  it('cada cuenta en bolívares usa su propia tasa', () => {
    expect(usdPerUnit('VES', 'bcv', rates)).toBeCloseTo(1 / 200)
    expect(usdPerUnit('VES', 'binance', rates)).toBeCloseTo(1 / 300)
    expect(usdPerUnit('VES', 'manual', rates)).toBeCloseTo(1 / 250)
  })

  it('USDT vale un dólar y el euro cruza por el BCV aunque la cuenta elija Binance', () => {
    expect(usdPerUnit('USDT', 'binance', rates)).toBe(1)
    expect(usdPerUnit('EUR', 'binance', rates)).toBeCloseTo(1.1)
  })

  it('la equivalencia de una cuenta en dólares a bolívares es la tasa de hoy', () => {
    expect(crossRate('USD', 'VES', 'bcv', rates)).toBeCloseTo(200)
    expect(crossRate('USD', 'VES', 'binance', rates)).toBeCloseTo(300)
  })

  it('sin tasa no inventa un número', () => {
    expect(usdPerUnit('VES', 'manual', { ...rates, manual_usd: null })).toBeNull()
    expect(usdPerUnit('VES', 'bcv', { ...rates, bcv_usd: null, manual_usd: null })).toBeNull()
    expect(usdPerUnit('EUR', 'bcv', { ...rates, bcv_eur: null })).toBeNull()
  })

  it('mientras BCV o Binance no respondan, el bolívar usa la tasa manual', () => {
    expect(usdPerUnit('VES', 'bcv', { ...rates, bcv_usd: null })).toBeCloseTo(1 / 250)
    expect(usdPerUnit('VES', 'binance', { ...rates, binance_usdt: null })).toBeCloseTo(1 / 250)
  })
})

describe('saldos y consolidado', () => {
  const accounts = [account('banco', 'VES', 'bcv'), account('zinli', 'USD'), account('binance', 'USDT', 'binance')]
  const receivable: Receivable = {
    id: 'deuda',
    person: 'Pedro',
    currency: 'USD',
    principal: 100,
    dueDate: null,
    notes: null,
    color: '#22c55e',
    icon: { kind: 'lucide', value: 'HandCoins' },
    writtenOff: false,
    createdAt: '2026-11-10T00:00:00Z',
  }
  const movements = [
    movement({ accountId: 'banco', kind: 'opening', direction: 1, amount: 20000 }),
    movement({ accountId: 'zinli', kind: 'income', direction: 1, amount: 500 }),
    movement({ accountId: 'zinli', kind: 'loan_out', direction: -1, amount: 100, receivableId: 'deuda', receivableAmount: 100 }),
    movement({ accountId: 'zinli', kind: 'collection', direction: 1, amount: 30, receivableId: 'deuda', receivableAmount: 30 }),
    movement({ accountId: 'binance', kind: 'expense', direction: -1, amount: 50 }),
  ]

  it('el saldo es la suma firmada y puede quedar negativo', () => {
    expect(accountBalance('zinli', movements)).toBe(430)
    expect(accountBalance('binance', movements)).toBe(-50)
  })

  it('lo pendiente por cobrar baja con cada abono', () => {
    expect(receivablePending(receivable, movements)).toBe(70)
    expect(receivablePending({ ...receivable, writtenOff: true }, movements)).toBe(0)
  })

  it('el neto suma cuentas en dólares y el bruto agrega lo que te deben', () => {
    const result = totals(accounts, [receivable], movements, rates)
    expect(result.netUsd).toBeCloseTo(100 + 430 - 50)
    expect(result.receivablesUsd).toBeCloseTo(70)
    expect(result.grossUsd).toBeCloseTo(550)
    expect(result.missingRates).toEqual([])
  })

  it('avisa qué cuenta quedó fuera por falta de tasa', () => {
    const result = totals(accounts, [], movements, { ...rates, bcv_usd: null, manual_usd: null })
    expect(result.missingRates).toEqual(['banco'])
    expect(result.netUsd).toBeCloseTo(380)
  })
})

describe('montos escritos a mano', () => {
  it('entiende coma decimal y separador de miles', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('12,5')).toBe(12.5)
    expect(parseAmount('abc')).toBeNull()
  })
})
