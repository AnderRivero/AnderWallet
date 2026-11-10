import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Amount } from '../components/Amount'
import { IconView } from '../components/IconView'
import { MovementRow, movementTitle } from '../components/MovementRow'
import { ConfirmRecurringModal } from '../components/RecurringModal'
import { useData } from '../data/DataProvider'
import { ACCOUNT_KIND_LABEL, dueLabel, monthKey, monthLabel, todayISO } from '../lib/format'
import { accountBalance, crossRate, formatMoney, formatRate, SOURCE_LABEL, totals } from '../lib/money'
import type { Recurring } from '../lib/types'
import { dueState } from '../../supabase/functions/check-recurring/schedule'

export function HomePage() {
  const data = useData()
  const { accounts, categories, movements, receivables, recurring, rates } = data
  const [paying, setPaying] = useState<Recurring | null>(null)
  const today = todayISO()
  const summary = useMemo(() => totals(accounts, receivables, movements, rates), [accounts, movements, rates, receivables])
  const featured = accounts.filter((account) => account.featured)
  const upcoming = recurring
    .filter((item) => item.active)
    .map((item) => ({ item, due: dueState(item, today) }))
    .filter(({ due }) => due.status !== 'later')
    .sort((a, b) => a.due.dueDate.localeCompare(b.due.dueDate))

  const month = monthKey(today)
  const spending = useMemo(() => {
    const byCategory = new Map<string, number>()
    let total = 0
    let missing = 0
    for (const movement of movements) {
      if (movement.kind !== 'expense' || monthKey(movement.occurredOn) !== month) continue
      if (movement.usdAmount == null) {
        missing += 1
        continue
      }
      const key = movement.categoryId ?? ''
      byCategory.set(key, (byCategory.get(key) ?? 0) + movement.usdAmount)
      total += movement.usdAmount
    }
    const rows = [...byCategory.entries()].map(([id, value]) => ({ category: categories.find((item) => item.id === id), value }))
    return { rows: rows.sort((a, b) => b.value - a.value), total, missing }
  }, [categories, month, movements])

  if (accounts.length === 0) {
    return (
      <section className="hero">
        <p className="eyebrow">Empecemos</p>
        <h1>Crea tu primera cuenta</h1>
        <p className="lead">Un banco, una billetera digital o tu USDT. Después anotas su saldo inicial y listo.</p>
        <div className="hero-actions">
          <Link className="btn primary" to="/cuentas">
            Ir a cuentas
          </Link>
          <Link className="btn ghost" to="/tasas">
            Revisar tasas
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="totals">
        <article className="total-card main">
          <span>Neto</span>
          <strong className="amount">{formatMoney(summary.netUsd, 'USD')}</strong>
          <small>Lo que hay en tus cuentas, en dólares de hoy</small>
        </article>
        <article className="total-card">
          <span>Bruto</span>
          <strong className="amount">{formatMoney(summary.grossUsd, 'USD')}</strong>
          <small>
            Neto + <span className="amount">{formatMoney(summary.receivablesUsd, 'USD')}</span> por cobrar
          </small>
        </article>
      </section>
      {summary.missingRates.length > 0 && (
        <p className="warning">
          <AlertTriangle size={16} />
          Sin tasa para convertir: {summary.missingRates.join(', ')}. <Link to="/tasas">Revisar tasas</Link>
        </p>
      )}

      <section className="rate-strip">
        <span>BCV $ {rates.bcv_usd ? formatRate(rates.bcv_usd) : '—'}</span>
        <span>BCV € {rates.bcv_eur ? formatRate(rates.bcv_eur) : '—'}</span>
        <span>Binance {rates.binance_usdt ? formatRate(rates.binance_usdt) : '—'}</span>
        {rates.manual_usd && <span>Manual {formatRate(rates.manual_usd)}</span>}
        <Link to="/tasas">Tasas</Link>
      </section>

      <section className="account-grid">
        {featured.map((account) => {
          const balance = accountBalance(account.id, movements)
          const ref = account.refCurrency ? crossRate(account.currency, account.refCurrency, account.rateSource, rates) : null
          return (
            <article key={account.id} className="account-card" style={{ borderColor: `${account.color}55` }}>
              <div className="account-head">
                <IconView icon={account.icon} color={account.color} size={38} />
                <div>
                  <strong>{account.name}</strong>
                  <p className="note">
                    {ACCOUNT_KIND_LABEL[account.kind]} · {SOURCE_LABEL[account.rateSource]}
                  </p>
                </div>
              </div>
              <Amount value={balance} currency={account.currency} className="big" />
              {account.refCurrency && (
                <p className="note">
                  {ref != null ? (
                    <>
                      ≈ <span className="amount">{formatMoney(balance * ref, account.refCurrency)}</span> · 1 {account.currency} ={' '}
                      {formatRate(ref)} {account.refCurrency}
                    </>
                  ) : (
                    'Sin tasa para la equivalencia'
                  )}
                </p>
              )}
            </article>
          )
        })}
      </section>

      {upcoming.length > 0 && (
        <section className="stack">
          <h2>Pagos fijos próximos</h2>
          {upcoming.map(({ item, due }) => (
            <article key={item.id} className={`row-card due-${due.status}`}>
              <IconView icon={item.icon} color={item.color} size={40} />
              <div className="row-main">
                <strong>{item.name}</strong>
                <p className="note">{dueLabel(due.daysLeft)}</p>
              </div>
              <div className="row-value">
                <Amount value={item.amount} currency={item.currency} />
              </div>
              <button className="btn primary compact" type="button" onClick={() => setPaying(item)}>
                {item.kind === 'expense' ? 'Pagar' : 'Cobrar'}
              </button>
            </article>
          ))}
        </section>
      )}

      <div className="two">
        <section className="stack">
          <h2>Gastos de {monthLabel(month)}</h2>
          {spending.rows.length === 0 ? (
            <p className="note">Sin gastos este mes.</p>
          ) : (
            <>
              <p className="lead amount">{formatMoney(spending.total, 'USD')}</p>
              {spending.rows.map(({ category, value }) => (
                <div key={category?.id ?? 'none'} className="bar-row">
                  <span className="bar-label">{category?.name ?? 'Sin categoría'}</span>
                  <span className="bar-track">
                    <span className="bar" style={{ width: `${Math.max(4, (value / spending.total) * 100)}%`, background: category?.color }} />
                  </span>
                  <span className="amount">{formatMoney(value, 'USD')}</span>
                </div>
              ))}
            </>
          )}
          {spending.missing > 0 && <p className="note">{spending.missing} gastos sin tasa no entran en este total.</p>}
        </section>

        <section className="stack">
          <h2>Últimos movimientos</h2>
          {movements.length === 0 && <p className="note">Todavía no hay movimientos.</p>}
          {movements.slice(0, 6).map((movement) => (
            <MovementRow
              key={movement.id}
              movement={movement}
              account={accounts.find((item) => item.id === movement.accountId)}
              category={categories.find((item) => item.id === movement.categoryId)}
              title={movementTitle(movement, data)}
            />
          ))}
          <Link to="/movimientos">Ver todos</Link>
        </section>
      </div>

      {paying && <ConfirmRecurringModal recurring={paying} onClose={() => setPaying(null)} />}
    </>
  )
}
