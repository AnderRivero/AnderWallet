import { useState } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { AccountModal } from '../components/AccountModal'
import { Amount } from '../components/Amount'
import { IconView } from '../components/IconView'
import { MovementModal } from '../components/MovementModal'
import { useData } from '../data/DataProvider'
import { deleteAccount } from '../lib/api'
import { errorText } from '../lib/errors'
import { ACCOUNT_KIND_LABEL } from '../lib/format'
import { accountBalance, formatMoney, SOURCE_LABEL, usdPerUnit } from '../lib/money'
import type { Account } from '../lib/types'

export function AccountsPage() {
  const { accounts, movements, rates, refresh } = useData()
  const [editing, setEditing] = useState<Account | null | undefined>(undefined)
  const [opening, setOpening] = useState<Account | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(account: Account) {
    if (!window.confirm(`¿Eliminar la cuenta ${account.name}?`)) return
    try {
      await deleteAccount(account.id)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <section className="section-head">
        <div>
          <p className="eyebrow">Dónde está tu dinero</p>
          <h1>Cuentas</h1>
        </div>
        <button className="btn primary" type="button" onClick={() => setEditing(null)}>
          <Plus size={18} /> Nueva cuenta
        </button>
      </section>
      {error && <p className="error">{error}</p>}
      {accounts.length === 0 && <p className="note">Crea una cuenta para empezar a anotar movimientos.</p>}

      <section className="stack">
        {accounts.map((account) => {
          const balance = accountBalance(account.id, movements)
          const used = movements.some((item) => item.accountId === account.id)
          const usd = usdPerUnit(account.currency, account.rateSource, rates)
          return (
            <article key={account.id} className="row-card">
              <IconView icon={account.icon} color={account.color} size={44} />
              <div className="row-main">
                <strong>
                  {account.name} {account.featured && <Star size={14} className="star" aria-label="En el inicio" />}
                </strong>
                <p className="note">
                  {ACCOUNT_KIND_LABEL[account.kind]} · {account.currency} · tasa {SOURCE_LABEL[account.rateSource]}
                  {account.refCurrency ? ` · referencia ${account.refCurrency}` : ''}
                </p>
              </div>
              <div className="row-value">
                <Amount value={balance} currency={account.currency} />
                {account.currency !== 'USD' && (
                  <small className="amount muted">{usd == null ? 'sin tasa' : formatMoney(balance * usd, 'USD')}</small>
                )}
              </div>
              <div className="row-actions">
                {!used && (
                  <button className="btn ghost compact" type="button" onClick={() => setOpening(account)}>
                    Saldo inicial
                  </button>
                )}
                <button className="icon-action" type="button" aria-label="Editar" title="Editar" onClick={() => setEditing(account)}>
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-action danger"
                  type="button"
                  aria-label="Eliminar"
                  title={used ? 'Tiene movimientos: bórralos primero' : 'Eliminar'}
                  disabled={used}
                  onClick={() => void remove(account)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {editing !== undefined && <AccountModal account={editing} onClose={() => setEditing(undefined)} />}
      {opening && <MovementModal movement={null} defaultKind="opening" defaultAccountId={opening.id} onClose={() => setOpening(null)} />}
    </>
  )
}
