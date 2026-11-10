import { useRef, useState, type ChangeEvent } from 'react'
import { Download, ShieldCheck, Upload } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { restoreBackup } from '../lib/api'
import { buildBackup, parseBackup } from '../lib/backup'
import { errorText } from '../lib/errors'
import { todayISO } from '../lib/format'

export function SettingsPage() {
  const auth = useAuth()
  const data = useData()
  const input = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function download() {
    const file = buildBackup({ ...data, manualUsdRate: data.rates.manual_usd })
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `anderwallet-${todayISO()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Respaldo descargado. Guárdalo en un lugar seguro: tiene todos tus datos sin cifrar.')
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)
    setMessage(null)
    try {
      const backup = parseBackup(await file.text())
      const ok = window.confirm(
        `Esto reemplaza TODO lo que hay ahora por el respaldo del ${backup.exportedAt.slice(0, 10)} ` +
          `(${backup.accounts.length} cuentas, ${backup.movements.length} movimientos). ¿Seguir?`,
      )
      if (!ok) return
      setBusy(true)
      await restoreBackup(backup)
      await data.refresh()
      setMessage('Respaldo restaurado.')
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
          <p className="eyebrow">Tu cuenta</p>
          <h1>Configuración</h1>
        </div>
      </section>

      <nav className="more-links" aria-label="Más secciones">
        <NavLink to="/cuentas">Cuentas</NavLink>
        <NavLink to="/categorias">Categorías</NavLink>
        <NavLink to="/tasas">Tasas</NavLink>
      </nav>

      <section className="panel stack">
        <h2>
          <ShieldCheck size={20} /> Seguridad
        </h2>
        <p className="note">Sesión de {auth.email}, verificada con Google y con tu código de autenticador.</p>
        <ul className="plain-list">
          <li>Solo los correos de la lista de acceso pueden crear cuenta; el resto lo rechaza Supabase antes de registrarlo.</li>
          <li>La base de datos no entrega nada sin el segundo factor, aunque alguien tenga tu sesión de Google.</li>
          <li>La sesión vive solo en esta pestaña y se cierra tras 15 minutos sin uso.</li>
          <li>El ojo de arriba difumina los montos si alguien mira tu pantalla.</li>
        </ul>
        <div className="actions">
          <button className="btn ghost" type="button" onClick={() => void auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </section>

      <section className="panel stack">
        <h2>Dar acceso a otro correo</h2>
        <p className="note">
          No se hace desde aquí, a propósito. En Supabase, SQL Editor:{' '}
          <code>insert into public.allowed_users (email) values (&apos;correo@gmail.com&apos;);</code> Si la pantalla de
          consentimiento de Google sigue en prueba, agrega también ese correo como usuario de prueba. Esa persona tendrá que
          activar su propio autenticador y verá los mismos datos que tú.
        </p>
      </section>

      <section className="panel stack">
        <h2>Respaldo</h2>
        <p className="note">Un archivo JSON con cuentas, categorías, movimientos, por cobrar y pagos fijos.</p>
        <div className="actions">
          <button className="btn primary" type="button" onClick={download}>
            <Download size={18} /> Descargar respaldo
          </button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => input.current?.click()}>
            <Upload size={18} /> {busy ? 'Restaurando…' : 'Restaurar'}
          </button>
          <input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => void restore(event)} />
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </>
  )
}
