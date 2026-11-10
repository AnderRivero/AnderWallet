import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  ArrowLeftRight,
  CalendarClock,
  Eye,
  EyeOff,
  HandCoins,
  LayoutDashboard,
  Landmark,
  LogOut,
  Plus,
  Settings,
  Tags,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { todayISO } from '../lib/format'
import { dueState } from '../../supabase/functions/check-recurring/schedule'
import { MovementModal } from './MovementModal'

const navigation: Array<{ to: string; label: string; short?: string; icon: LucideIcon; end?: boolean; mobile?: boolean }> = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true, mobile: true },
  { to: '/movimientos', label: 'Movimientos', short: 'Movs.', icon: ArrowLeftRight, mobile: true },
  { to: '/por-cobrar', label: 'Por cobrar', short: 'Cobrar', icon: HandCoins, mobile: true },
  { to: '/pagos-fijos', label: 'Pagos fijos', short: 'Fijos', icon: CalendarClock, mobile: true },
  { to: '/cuentas', label: 'Cuentas', icon: Landmark },
  { to: '/categorias', label: 'Categorías', icon: Tags },
  { to: '/tasas', label: 'Tasas', icon: TrendingUp },
  { to: '/configuracion', label: 'Configuración', short: 'Más', icon: Settings, mobile: true },
]

export function Layout() {
  const auth = useAuth()
  const data = useData()
  const [adding, setAdding] = useState(false)
  const today = todayISO()
  const due = data.recurring.filter((item) => item.active && dueState(item, today).status !== 'later').length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span className="brand-icon">
            <Wallet size={22} />
          </span>
          <div className="brand">
            <span>AnderWallet</span>
            <small>Tus cuentas, en dólares</small>
          </div>
        </div>
        <div className="session">
          <button
            type="button"
            className="icon-btn"
            aria-label={data.hidden ? 'Mostrar montos' : 'Ocultar montos'}
            title={data.hidden ? 'Mostrar montos' : 'Ocultar montos'}
            onClick={data.toggleHidden}
          >
            {data.hidden ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
          <span className="session-email">{auth.email}</span>
          <button type="button" className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void auth.signOut()}>
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label="Secciones">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={20} />
              <span>{label}</span>
              {to === '/pagos-fijos' && due > 0 && <span className="badge">{due}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="status-dot" />
          Sesión con segundo factor
        </div>
      </aside>

      <main className="page">
        {data.error && <p className="error">{data.error}</p>}
        {data.loading ? <p className="lead">Cargando…</p> : <Outlet />}
      </main>

      {!data.loading && data.accounts.length > 0 && (
        <button className="fab" type="button" aria-label="Nuevo movimiento" title="Nuevo movimiento" onClick={() => setAdding(true)}>
          <Plus size={26} />
        </button>
      )}
      {adding && <MovementModal movement={null} onClose={() => setAdding(false)} />}

      <nav className="mobile-nav" aria-label="Navegación principal">
        {navigation
          .filter((item) => item.mobile)
          .map(({ to, label, short, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <span className="mobile-icon">
                <Icon size={20} />
                {to === '/pagos-fijos' && due > 0 && <span className="mobile-badge">{due}</span>}
              </span>
              <span>{short ?? label}</span>
            </NavLink>
          ))}
      </nav>
    </div>
  )
}
