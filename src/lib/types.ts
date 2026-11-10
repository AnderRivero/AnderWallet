export type Currency = 'USD' | 'VES' | 'EUR' | 'USDT'
export type AccountKind = 'bank' | 'wallet' | 'crypto'
export type RateSource = 'bcv' | 'binance' | 'manual'
export type RateKey = 'bcv_usd' | 'bcv_eur' | 'binance_usdt' | 'manual_usd'
export type IconKind = 'lucide' | 'url' | 'brand'
export type FlowKind = 'income' | 'expense'
export type Cadence = 'weekly' | 'monthly' | 'yearly'
export type MovementKind = 'opening' | 'adjustment' | 'income' | 'expense' | 'transfer' | 'loan_out' | 'collection'

export const CURRENCIES: Currency[] = ['USD', 'VES', 'EUR', 'USDT']

export type Icon = { kind: IconKind; value: string }

export type Rates = Record<RateKey, number | null>

export type RateSnapshot = {
  source: RateKey
  vesPerUnit: number | null
  fetchedAt: string | null
}

export type Account = {
  id: string
  name: string
  kind: AccountKind
  currency: Currency
  rateSource: RateSource
  refCurrency: Currency | null
  color: string
  icon: Icon
  featured: boolean
  notes: string | null
  sortOrder: number
}

export type Category = {
  id: string
  name: string
  kind: FlowKind
  color: string
  icon: Icon
}

export type Movement = {
  id: string
  accountId: string
  categoryId: string | null
  kind: MovementKind
  direction: 1 | -1
  amount: number
  occurredOn: string
  note: string | null
  usdRate: number | null
  usdAmount: number | null
  transferGroup: string | null
  receivableId: string | null
  receivableAmount: number | null
  recurringId: string | null
}

export type Receivable = {
  id: string
  person: string
  currency: Currency
  principal: number
  dueDate: string | null
  notes: string | null
  color: string
  icon: Icon
  writtenOff: boolean
  createdAt: string
}

export type Recurring = {
  id: string
  name: string
  kind: FlowKind
  amount: number
  currency: Currency
  accountId: string | null
  categoryId: string | null
  cadence: Cadence
  anchorDate: string
  paidCount: number
  leadDays: number
  color: string
  icon: Icon
  active: boolean
  notes: string | null
}
