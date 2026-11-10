import { describe, expect, it } from 'vitest'
import { buildBackup, parseBackup } from './backup'
import type { Account, Movement } from './types'

const account: Account = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Banco',
  kind: 'bank',
  currency: 'VES',
  rateSource: 'bcv',
  refCurrency: 'USD',
  color: '#22c55e',
  icon: { kind: 'lucide', value: 'Landmark' },
  featured: true,
  notes: null,
  sortOrder: 0,
}

function movement(id: string, transferGroup: string | null): Movement {
  return {
    id,
    accountId: account.id,
    categoryId: null,
    kind: transferGroup ? 'transfer' : 'opening',
    direction: 1,
    amount: 10,
    occurredOn: '2026-11-10',
    note: null,
    usdRate: 0.005,
    usdAmount: 0.05,
    transferGroup,
    receivableId: null,
    receivableAmount: null,
    recurringId: null,
  }
}

function file(movements: Movement[]) {
  return buildBackup({ accounts: [account], categories: [], receivables: [], recurring: [], movements, manualUsdRate: 250 })
}

describe('respaldo', () => {
  it('ida y vuelta conserva los datos y no guarda el USD calculado', () => {
    const parsed = parseBackup(JSON.stringify(file([movement('22222222-2222-4222-8222-222222222222', null)])))
    expect(parsed.accounts).toHaveLength(1)
    expect(parsed.manualUsdRate).toBe(250)
    expect('usdAmount' in parsed.movements[0]).toBe(false)
  })

  it('rechaza otra app y transferencias a medias', () => {
    expect(() => parseBackup(JSON.stringify({ ...file([]), app: 'LuzMonitor' }))).toThrow(/AnderWallet/)
    const half = file([movement('33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')])
    expect(() => parseBackup(JSON.stringify(half))).toThrow(/incompleta/)
  })
})
