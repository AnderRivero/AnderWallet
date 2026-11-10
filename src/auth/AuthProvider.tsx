import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { redirectUrl, supabase } from '../lib/supabase'

export type AuthStatus = 'loading' | 'misconfigured' | 'signed-out' | 'mfa-enroll' | 'mfa-verify' | 'ready'

export type Enrollment = { factorId: string; qrCode: string; secret: string }

type AuthContextValue = {
  status: AuthStatus
  email: string | null
  notice: string | null
  signIn: () => Promise<void>
  signOut: (notice?: string) => Promise<void>
  startEnrollment: () => Promise<Enrollment>
  verifyCode: (code: string, factorId?: string) => Promise<void>
}

const IDLE_LIMIT_MS = 15 * 60 * 1000
const AuthContext = createContext<AuthContextValue | null>(null)

function readRedirectError(): string | null {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''))
  const description = search.get('error_description') ?? hash.get('error_description')
  const code = search.get('error') ?? hash.get('error')
  if (!code && !description) return null
  window.history.replaceState(null, '', redirectUrl())
  if (description && /no tiene acceso|before_user_created|hook/i.test(description)) {
    return 'Esa cuenta de Google no tiene acceso a AnderWallet.'
  }
  return description ?? 'Google no completó el inicio de sesión.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'misconfigured')
  const [email, setEmail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(() => readRedirectError())
  const request = useRef(0)

  const resolve = useCallback(async (session: Session | null) => {
    if (!supabase) return
    const client = supabase
    const current = ++request.current
    if (!session?.user.email) {
      setEmail(null)
      setStatus('signed-out')
      return
    }
    const userEmail = session.user.email.toLowerCase()
    const { data: allowed, error } = await client.from('allowed_users').select('email').eq('email', userEmail).maybeSingle()
    if (current !== request.current) return
    if (error || !allowed) {
      setNotice(
        error ? `No se pudo confirmar el acceso: ${error.message}` : `La cuenta ${userEmail} no tiene acceso a AnderWallet.`,
      )
      await client.auth.signOut()
      return
    }
    setEmail(userEmail)
    const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    if (current !== request.current) return
    if (levelError) {
      setNotice(levelError.message)
      await client.auth.signOut()
      return
    }
    if (level.currentLevel === 'aal2') setStatus('ready')
    else if (level.nextLevel === 'aal2') setStatus('mfa-verify')
    else setStatus('mfa-enroll')
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    void client.auth.getSession().then(({ data }) => {
      if (active) void resolve(data.session)
    })
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => {
        if (active) void resolve(session)
      }, 0)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [resolve])

  const signOut = useCallback(async (message?: string) => {
    if (message) setNotice(message)
    if (!supabase) return
    await supabase.auth.signOut().catch(() => supabase?.auth.signOut({ scope: 'local' }))
  }, [])

  useEffect(() => {
    if (status === 'signed-out' || status === 'loading' || status === 'misconfigured') return
    let last = Date.now()
    const touch = () => {
      last = Date.now()
    }
    const check = () => {
      if (Date.now() - last > IDLE_LIMIT_MS) void signOut('Se cerró la sesión tras 15 minutos sin uso.')
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    for (const name of events) window.addEventListener(name, touch, { passive: true })
    document.addEventListener('visibilitychange', check)
    const timer = window.setInterval(check, 20_000)
    return () => {
      for (const name of events) window.removeEventListener(name, touch)
      document.removeEventListener('visibilitychange', check)
      window.clearInterval(timer)
    }
  }, [signOut, status])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      email,
      notice,
      signIn: async () => {
        if (!supabase) return
        setNotice(null)
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl(), queryParams: { prompt: 'select_account' } },
        })
        if (error) throw error
      },
      signOut,
      startEnrollment: async () => {
        if (!supabase) throw new Error('Falta la configuración de Supabase.')
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
        if (listError) throw listError
        for (const factor of factors.all) {
          if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `AnderWallet ${new Date().toISOString()}`,
          issuer: 'AnderWallet',
        })
        if (error) throw error
        return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
      },
      verifyCode: async (code: string, factorId?: string) => {
        if (!supabase) throw new Error('Falta la configuración de Supabase.')
        let target = factorId
        if (!target) {
          const { data, error } = await supabase.auth.mfa.listFactors()
          if (error) throw error
          target = data.totp.find((factor) => factor.status === 'verified')?.id
        }
        if (!target) throw new Error('No hay un autenticador registrado.')
        const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: target, code: code.trim() })
        if (error) throw new Error('El código no es válido o ya venció.')
        const { data } = await supabase.auth.getSession()
        await resolve(data.session)
      },
    }),
    [email, notice, resolve, signOut, status],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return value
}
