import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { KeyRound, LogIn, ShieldCheck, Wallet } from 'lucide-react'
import { AuthProvider, useAuth, type Enrollment } from './auth/AuthProvider'
import { Layout } from './components/Layout'
import { DataProvider } from './data/DataProvider'
import { errorText } from './lib/errors'
import { AccountsPage } from './pages/AccountsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { HomePage } from './pages/HomePage'
import { MovementsPage } from './pages/MovementsPage'
import { RatesPage } from './pages/RatesPage'
import { ReceivablesPage } from './pages/ReceivablesPage'
import { RecurringPage } from './pages/RecurringPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const auth = useAuth()
  if (auth.status === 'loading') return <Screen title="Abriendo…" />
  if (auth.status === 'misconfigured') return <Misconfigured />
  if (auth.status === 'signed-out') return <Login />
  if (auth.status === 'mfa-enroll') return <EnrollMfa />
  if (auth.status === 'mfa-verify') return <VerifyMfa />
  return (
    <DataProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="movimientos" element={<MovementsPage />} />
            <Route path="cuentas" element={<AccountsPage />} />
            <Route path="por-cobrar" element={<ReceivablesPage />} />
            <Route path="pagos-fijos" element={<RecurringPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="tasas" element={<RatesPage />} />
            <Route path="configuracion" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </DataProvider>
  )
}

function Screen({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="brand-icon large">
          <Wallet size={30} />
        </span>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  )
}

function Misconfigured() {
  return (
    <Screen title="Falta configurar Supabase">
      <p className="lead">
        Crea <code>.env.local</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>, como en{' '}
        <code>.env.example</code>, y vuelve a abrir la app.
      </p>
    </Screen>
  )
}

function Login() {
  const auth = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  return (
    <Screen title="AnderWallet">
      <p className="lead">Acceso privado. Entra con tu cuenta de Google y tu código de autenticador.</p>
      {auth.notice && <p className="error">{auth.notice}</p>}
      {error && <p className="error">{error}</p>}
      <button
        className="btn primary wide"
        type="button"
        disabled={pending}
        onClick={() => {
          setPending(true)
          setError(null)
          auth.signIn().catch((err: unknown) => {
            setError(errorText(err))
            setPending(false)
          })
        }}
      >
        <LogIn size={18} /> Entrar con Google
      </button>
    </Screen>
  )
}

function CodeForm({ onSubmit, label }: { onSubmit: (code: string) => Promise<void>; label: string }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return setError('El código tiene 6 dígitos.')
    setPending(true)
    setError(null)
    try {
      await onSubmit(code)
    } catch (err) {
      setError(errorText(err))
      setCode('')
      setPending(false)
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void submit(event)}>
      <label className="field">
        <span>Código de 6 dígitos</span>
        <input
          className="code-input"
          value={code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" type="submit" disabled={pending}>
        <KeyRound size={18} /> {pending ? 'Verificando…' : label}
      </button>
    </form>
  )
}

function EnrollMfa() {
  const auth = useAuth()
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  const { startEnrollment } = auth

  useEffect(() => {
    if (started.current) return
    started.current = true
    startEnrollment()
      .then(setEnrollment)
      .catch((err: unknown) => setError(errorText(err)))
  }, [startEnrollment])

  return (
    <Screen title="Activa el segundo factor">
      <p className="lead">
        Escanea el código con Google Authenticator, 1Password, Authy o similar. Sin este paso la base de datos no entrega nada.
      </p>
      {error && <p className="error">{error}</p>}
      {enrollment ? (
        <>
          <img className="qr" src={enrollment.qrCode} alt="Código QR del autenticador" width={200} height={200} />
          <p className="note">
            ¿No puedes escanear? Escribe esta clave: <code className="secret">{enrollment.secret}</code>
          </p>
          <CodeForm label="Activar" onSubmit={(code) => auth.verifyCode(code, enrollment.factorId)} />
        </>
      ) : (
        !error && <p className="note">Preparando…</p>
      )}
      <button className="btn ghost wide" type="button" onClick={() => void auth.signOut()}>
        Cancelar y salir
      </button>
    </Screen>
  )
}

function VerifyMfa() {
  const auth = useAuth()
  return (
    <Screen title="Código de verificación">
      <p className="lead">
        <ShieldCheck size={16} /> {auth.email}: abre tu autenticador y escribe el código de AnderWallet.
      </p>
      <CodeForm label="Entrar" onSubmit={(code) => auth.verifyCode(code)} />
      <button className="btn ghost wide" type="button" onClick={() => void auth.signOut()}>
        Usar otra cuenta
      </button>
    </Screen>
  )
}
