import { formatMoney } from '../lib/money'
import type { Currency } from '../lib/types'

export function Amount({
  value,
  currency,
  signed = false,
  className,
}: {
  value: number
  currency: Currency
  signed?: boolean
  className?: string
}) {
  const tone = value < 0 ? 'neg' : signed && value > 0 ? 'pos' : ''
  return <span className={['amount', tone, className].filter(Boolean).join(' ')}>{formatMoney(value, currency, { signed })}</span>
}
