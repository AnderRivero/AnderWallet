import type { ReactNode } from 'react'
import type { Account, Category, Currency, FlowKind } from '../lib/types'
import { CURRENCIES } from '../lib/types'

export function AccountSelect({
  accounts,
  value,
  onChange,
  label = 'Cuenta',
  allowEmpty,
}: {
  accounts: Account[]
  value: string
  onChange: (value: string) => void
  label?: string
  allowEmpty?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} required={!allowEmpty}>
        {allowEmpty ? <option value="">{allowEmpty}</option> : <option value="" disabled>Elige una cuenta</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {account.currency}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CategorySelect({
  categories,
  kind,
  value,
  onChange,
}: {
  categories: Category[]
  kind: FlowKind
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>Categoría</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Sin categoría</option>
        {categories
          .filter((category) => category.kind === kind)
          .map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
      </select>
    </label>
  )
}

export function CurrencySelect({
  value,
  onChange,
  label = 'Moneda',
  disabled,
}: {
  value: Currency
  onChange: (value: Currency) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value as Currency)}>
        {CURRENCIES.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AmountField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        value={value}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        onChange={(event) => onChange(event.target.value)}
        required
      />
      {hint && <small className="hint">{hint}</small>}
    </label>
  )
}

export function FormActions({ pending, onClose, label = 'Guardar' }: { pending: boolean; onClose: () => void; label?: string }) {
  return (
    <div className="actions modal-actions full">
      <button className="btn ghost" type="button" onClick={onClose}>
        Cancelar
      </button>
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? 'Guardando…' : label}
      </button>
    </div>
  )
}
