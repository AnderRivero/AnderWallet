import { useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import { useData } from '../data/DataProvider'
import { refreshRates, saveManualRate } from '../lib/api'
import { errorText } from '../lib/errors'
import { formatDateTime } from '../lib/format'
import { amountInput, formatRate, parseAmount } from '../lib/money'
import type { RateKey } from '../lib/types'

const LABELS: Array<{ key: RateKey; title: string; detail: string }> = [
  { key: 'bcv_usd', title: 'BCV dólar', detail: 'Bs. por cada dólar, tasa oficial.' },
  { key: 'bcv_eur', title: 'BCV euro', detail: 'Bs. por cada euro. El euro siempre se convierte con esta.' },
  { key: 'binance_usdt', title: 'Binance P2P', detail: 'Promedio de las ofertas de venta de USDT en Bs.' },
  { key: 'manual_usd', title: 'Manual', detail: 'La que tú escribas, para cuentas con tasa manual.' },
]

export function RatesPage() {
  const { snapshots, refresh } = useData()
  const manual = snapshots.find((item) => item.source === 'manual_usd')
  const [value, setValue] = useState(amountInput(manual?.vesPerUnit))
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function update() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await refreshRates()
      await refresh()
      setMessage(result.errors.length ? `Actualizado con avisos: ${result.errors.join(' · ')}` : 'Tasas actualizadas.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function onManual(event: FormEvent) {
    event.preventDefault()
    const parsed = value.trim() ? parseAmount(value) : null
    if (value.trim() && (parsed == null || parsed <= 0)) return setError('Escribe una tasa mayor que cero.')
    setBusy(true)
    setError(null)
    try {
      await saveManualRate(parsed)
      await refresh()
      setMessage(parsed == null ? 'Tasa manual borrada.' : 'Tasa manual guardada.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="section-head">
        <div>
          <p className="eyebrow">Bolívares por unidad</p>
          <h1>Tasas</h1>
        </div>
        <button className="btn primary" type="button" disabled={busy} onClick={() => void update()}>
          <RefreshCw size={18} className={busy ? 'spin' : undefined} /> Actualizar
        </button>
      </section>
      <p className="note">Se actualizan solas dos veces al día. Si una fuente falla, se queda el último valor bueno.</p>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="rate-grid">
        {LABELS.map(({ key, title, detail }) => {
          const snapshot = snapshots.find((item) => item.source === key)
          return (
            <article key={key} className="rate-card">
              <span>{title}</span>
              <strong>{snapshot?.vesPerUnit ? `Bs. ${formatRate(snapshot.vesPerUnit)}` : '—'}</strong>
              <small>{snapshot?.fetchedAt ? `Actualizada ${formatDateTime(snapshot.fetchedAt)}` : 'Sin datos todavía'}</small>
              <p className="note">{detail}</p>
            </article>
          )
        })}
      </section>

      <form className="panel form-grid" onSubmit={(event) => void onManual(event)}>
        <label className="field">
          <span>Tasa manual (Bs. por dólar)</span>
          <input value={value} inputMode="decimal" placeholder="Vacía para no usarla" onChange={(event) => setValue(event.target.value)} />
        </label>
        <div className="actions">
          <button className="btn primary" type="submit" disabled={busy}>
            Guardar tasa manual
          </button>
        </div>
      </form>
    </>
  )
}
