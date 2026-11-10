import { useState, type FormEvent } from 'react'
import { saveTransfer } from '../lib/api'
import { errorText } from '../lib/errors'
import { todayISO } from '../lib/format'
import { amountInput, crossRate, parseAmount, usdPerUnit } from '../lib/money'
import type { Account, Movement, Rates } from '../lib/types'
import { useData } from '../data/DataProvider'
import { AccountSelect, AmountField, FormActions } from './fields'
import { Modal } from './Modal'

export function proposeTransfer(from: Account | undefined, to: Account | undefined, amount: number | null, rates: Rates): number | null {
  if (!from || !to || amount == null) return null
  const source = from.currency === 'VES' ? from.rateSource : to.rateSource
  const rate = crossRate(from.currency, to.currency, source, rates)
  return rate == null ? null : Math.round(amount * rate * 100) / 100
}

export function TransferModal({ movement, onClose }: { movement: Movement | null; onClose: () => void }) {
  const { accounts, movements, rates, refresh } = useData()
  const pair = movement?.transferGroup ? movements.filter((item) => item.transferGroup === movement.transferGroup) : []
  const out = pair.find((item) => item.direction === -1)
  const into = pair.find((item) => item.direction === 1)
  const [fromId, setFromId] = useState(out?.accountId ?? accounts[0]?.id ?? '')
  const [toId, setToId] = useState(into?.accountId ?? accounts[1]?.id ?? '')
  const [fromAmount, setFromAmount] = useState(amountInput(out?.amount))
  const [toAmount, setToAmount] = useState(amountInput(into?.amount))
  const [toDirty, setToDirty] = useState(Boolean(movement))
  const [occurredOn, setOccurredOn] = useState(out?.occurredOn ?? todayISO())
  const [note, setNote] = useState(out?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const from = accounts.find((item) => item.id === fromId)
  const to = accounts.find((item) => item.id === toId)
  const sameCurrency = from && to && from.currency === to.currency
  const proposal = proposeTransfer(from, to, parseAmount(fromAmount), rates)
  const shownTo = sameCurrency ? fromAmount : toDirty ? toAmount : amountInput(proposal)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const sent = parseAmount(fromAmount)
    const received = parseAmount(shownTo)
    if (!from || !to) return setError('Elige las dos cuentas.')
    if (from.id === to.id) return setError('Elige dos cuentas distintas.')
    if (sent == null || sent <= 0 || received == null || received <= 0) return setError('Escribe montos mayores que cero.')
    setPending(true)
    setError(null)
    try {
      await saveTransfer({
        group: movement?.transferGroup ?? null,
        fromId,
        toId,
        fromAmount: sent,
        toAmount: received,
        occurredOn,
        note,
        fromRate: out?.accountId === fromId && out.usdRate ? out.usdRate : usdPerUnit(from.currency, from.rateSource, rates),
        toRate: into?.accountId === toId && into.usdRate ? into.usdRate : usdPerUnit(to.currency, to.rateSource, rates),
      })
      await refresh()
      onClose()
    } catch (err) {
      setError(errorText(err))
      setPending(false)
    }
  }

  return (
    <Modal title={movement ? 'Editar transferencia' : 'Transferir entre cuentas'} subtitle="No cuenta como gasto ni como ingreso." onClose={onClose}>
      <form className="form-grid" onSubmit={(event) => void onSubmit(event)}>
        <AccountSelect accounts={accounts} value={fromId} onChange={setFromId} label="Sale de" />
        <AmountField label={from ? `Monto que sale (${from.currency})` : 'Monto que sale'} value={fromAmount} onChange={setFromAmount} />
        <AccountSelect accounts={accounts} value={toId} onChange={setToId} label="Entra a" />
        <AmountField
          label={to ? `Monto que entra (${to.currency})` : 'Monto que entra'}
          value={shownTo}
          onChange={(value) => {
            setToDirty(true)
            setToAmount(value)
          }}
          hint={
            sameCurrency
              ? 'Misma moneda: entra lo mismo que sale.'
              : proposal != null && !toDirty
                ? 'Propuesto con la tasa de hoy. Puedes corregirlo.'
                : undefined
          }
        />
        <label className="field">
          <span>Fecha</span>
          <input type="date" value={occurredOn} max={todayISO()} onChange={(event) => setOccurredOn(event.target.value)} required />
        </label>
        <label className="field">
          <span>Nota</span>
          <input value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
        </label>
        {error && <p className="error full">{error}</p>}
        <FormActions pending={pending} onClose={onClose} />
      </form>
    </Modal>
  )
}
