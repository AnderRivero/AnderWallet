import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Amount } from '../components/Amount'
import { IconView } from '../components/IconView'
import { CollectModal, ReceivableModal } from '../components/ReceivableModal'
import { useData } from '../data/DataProvider'
import { deleteReceivable } from '../lib/api'
import { errorText } from '../lib/errors'
import { dueLabel, formatDate, todayISO } from '../lib/format'
import { formatMoney, receivableCollected, receivablePending, totals } from '../lib/money'
import type { Receivable } from '../lib/types'
import { daysBetween } from '../../supabase/functions/check-recurring/schedule'

export function ReceivablesPage() {
  const { accounts, movements, rates, receivables, refresh } = useData()
  const [editing, setEditing] = useState<Receivable | null | undefined>(undefined)
  const [collecting, setCollecting] = useState<Receivable | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayISO()
  const summary = useMemo(() => totals(accounts, receivables, movements, rates), [accounts, movements, rates, receivables])

  const rows = receivables
    .map((receivable) => ({
      receivable,
      pending: receivablePending(receivable, movements),
      collected: receivableCollected(receivable, movements),
    }))
    .filter((row) => showClosed || row.pending > 0)
    .sort((a, b) => (a.receivable.dueDate ?? '9999').localeCompare(b.receivable.dueDate ?? '9999'))

  async function remove(receivable: Receivable) {
    const linked = movements.some((item) => item.receivableId === receivable.id)
    const message = linked
      ? `¿Eliminar a ${receivable.person}? También se borran el préstamo y los cobros, y los saldos de tus cuentas cambian.`
      : `¿Eliminar a ${receivable.person}?`
    if (!window.confirm(message)) return
    try {
      await deleteReceivable(receivable.id)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <section className="section-head">
        <div>
          <p className="eyebrow">Te deben</p>
          <h1>Por cobrar</h1>
          <p className="lead amount">{formatMoney(summary.receivablesUsd, 'USD')}</p>
        </div>
        <button className="btn primary" type="button" onClick={() => setEditing(null)}>
          <Plus size={18} /> Nuevo préstamo
        </button>
      </section>
      <label className="check">
        <input type="checkbox" checked={showClosed} onChange={(event) => setShowClosed(event.target.checked)} />
        Mostrar cobrados y perdidos
      </label>
      {error && <p className="error">{error}</p>}

      <section className="stack">
        {rows.length === 0 && <p className="note">Nadie te debe nada por ahora.</p>}
        {rows.map(({ receivable, pending, collected }) => {
          const days = receivable.dueDate ? daysBetween(today, receivable.dueDate) : null
          const meta = [
            collected > 0 ? `cobrado ${formatMoney(collected, receivable.currency)} de ${formatMoney(receivable.principal, receivable.currency)}` : null,
            receivable.dueDate ? `${formatDate(receivable.dueDate)}${pending > 0 && days != null ? ` · ${dueLabel(days)}` : ''}` : null,
            receivable.writtenOff ? 'dado por perdido' : pending === 0 ? 'cobrado' : null,
            receivable.notes,
          ].filter(Boolean)
          return (
            <article key={receivable.id} className={`row-card${pending > 0 && days != null && days < 0 ? ' due-overdue' : ''}`}>
              <IconView icon={receivable.icon} color={receivable.color} size={42} />
              <div className="row-main">
                <strong>{receivable.person}</strong>
                <p className="note">{meta.join(' · ')}</p>
              </div>
              <div className="row-value">
                <Amount value={pending} currency={receivable.currency} />
              </div>
              <div className="row-actions">
                {pending > 0 && (
                  <button className="btn primary compact" type="button" disabled={accounts.length === 0} onClick={() => setCollecting(receivable)}>
                    Cobrar
                  </button>
                )}
                <button className="icon-action" type="button" aria-label="Editar" title="Editar" onClick={() => setEditing(receivable)}>
                  <Pencil size={16} />
                </button>
                <button className="icon-action danger" type="button" aria-label="Eliminar" title="Eliminar" onClick={() => void remove(receivable)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {editing !== undefined && <ReceivableModal receivable={editing} onClose={() => setEditing(undefined)} />}
      {collecting && <CollectModal receivable={collecting} onClose={() => setCollecting(null)} />}
    </>
  )
}
