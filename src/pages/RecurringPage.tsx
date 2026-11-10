import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Amount } from '../components/Amount'
import { IconView } from '../components/IconView'
import { ConfirmRecurringModal, RecurringModal } from '../components/RecurringModal'
import { useData } from '../data/DataProvider'
import { deleteRecurring, skipRecurring } from '../lib/api'
import { errorText } from '../lib/errors'
import { CADENCE_LABEL, dueLabel, formatDate, todayISO } from '../lib/format'
import { formatMoney, sourceForCurrency, usdPerUnit } from '../lib/money'
import type { Recurring } from '../lib/types'
import { dueState } from '../../supabase/functions/check-recurring/schedule'

const PER_MONTH = { weekly: 52 / 12, monthly: 1, yearly: 1 / 12 }

export function RecurringPage() {
  const { accounts, rates, recurring, refresh } = useData()
  const [editing, setEditing] = useState<Recurring | null | undefined>(undefined)
  const [paying, setPaying] = useState<Recurring | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()

  const rows = recurring
    .map((item) => ({ item, due: dueState(item, today) }))
    .sort((a, b) => Number(b.item.active) - Number(a.item.active) || a.due.dueDate.localeCompare(b.due.dueDate))

  let monthly = 0
  for (const item of recurring) {
    if (!item.active || item.kind !== 'expense') continue
    const usd = usdPerUnit(item.currency, sourceForCurrency(item.currency, accounts), rates)
    if (usd != null) monthly += item.amount * usd * PER_MONTH[item.cadence]
  }

  async function run(action: () => Promise<void>) {
    try {
      await action()
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <section className="section-head">
        <div>
          <p className="eyebrow">Se repiten</p>
          <h1>Pagos fijos</h1>
          <p className="lead">
            <span className="amount">{formatMoney(monthly, 'USD')}</span> al mes en pagos activos
          </p>
        </div>
        <button className="btn primary" type="button" onClick={() => setEditing(null)}>
          <Plus size={18} /> Nuevo pago fijo
        </button>
      </section>
      <p className="note">Te avisamos aquí y por correo. El movimiento se anota solo cuando confirmas.</p>
      {error && <p className="error">{error}</p>}

      <section className="stack">
        {rows.length === 0 && <p className="note">Agrega tus suscripciones, servicios o alquiler.</p>}
        {rows.map(({ item, due }) => (
          <article key={item.id} className={`row-card${item.active ? ` due-${due.status}` : ' inactive'}`}>
            <IconView icon={item.icon} color={item.color} size={42} />
            <div className="row-main">
              <strong>{item.name}</strong>
              <p className="note">
                {CADENCE_LABEL[item.cadence]} · {item.kind === 'expense' ? 'pago' : 'cobro'} ·{' '}
                {item.active ? `${formatDate(due.dueDate)} · ${dueLabel(due.daysLeft)}` : 'pausado'}
              </p>
            </div>
            <div className="row-value">
              <Amount value={item.amount} currency={item.currency} />
            </div>
            <div className="row-actions">
              {item.active && (
                <>
                  <button className="btn primary compact" type="button" disabled={accounts.length === 0} onClick={() => setPaying(item)}>
                    {item.kind === 'expense' ? 'Pagar' : 'Cobrar'}
                  </button>
                  <button
                    className="btn ghost compact"
                    type="button"
                    title="Saltar esta fecha sin anotar movimiento"
                    onClick={() => {
                      if (window.confirm(`¿Omitir el pago del ${formatDate(due.dueDate)}?`)) {
                        void run(() => skipRecurring(item.id, item.paidCount))
                      }
                    }}
                  >
                    Omitir
                  </button>
                </>
              )}
              <button className="icon-action" type="button" aria-label="Editar" title="Editar" onClick={() => setEditing(item)}>
                <Pencil size={16} />
              </button>
              <button
                className="icon-action danger"
                type="button"
                aria-label="Eliminar"
                title="Eliminar"
                onClick={() => {
                  if (window.confirm(`¿Eliminar ${item.name}? Los movimientos ya anotados se quedan.`)) {
                    void run(() => deleteRecurring(item.id))
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </section>

      {editing !== undefined && <RecurringModal recurring={editing} onClose={() => setEditing(undefined)} />}
      {paying && <ConfirmRecurringModal recurring={paying} onClose={() => setPaying(null)} />}
    </>
  )
}
