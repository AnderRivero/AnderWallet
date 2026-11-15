import { adminClient, corsHeaders, isCron, json } from '../_shared/guard.ts'
import { caracasToday, dueState, type ScheduleCadence } from './schedule.ts'

const DEFAULT_FROM = 'AnderWallet <onboarding@resend.dev>'
const DEFAULT_APP_URL = 'https://anderrivero.github.io/AnderWallet/#/pagos-fijos'
const SYMBOL: Record<string, string> = { USD: '$', VES: 'Bs.', EUR: '€', USDT: '₮' }

type Due = {
  id: string
  userId: string
  name: string
  kind: string
  amount: number
  currency: string
  dueDate: string
  daysLeft: number
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Método no permitido' }, 405)
  if (!isCron(request)) return json(request, { error: 'No autorizado' }, 401)

  const admin = adminClient()
  if (!admin) return json(request, { error: 'Falta la configuración de Supabase.' }, 500)

  const { data: rows, error } = await admin
    .from('recurring')
    .select('id, user_id, name, kind, amount, currency, cadence, anchor_date, paid_count, lead_days')
    .eq('active', true)
  if (error) return json(request, { error: error.message }, 500)

  const today = caracasToday()
  const due: Due[] = []
  for (const row of rows ?? []) {
    const state = dueState(
      {
        anchorDate: String(row.anchor_date).slice(0, 10),
        cadence: row.cadence as ScheduleCadence,
        paidCount: Number(row.paid_count),
        leadDays: Number(row.lead_days),
      },
      today,
    )
    if (state.status === 'later') continue
    due.push({
      id: String(row.id),
      userId: String(row.user_id),
      name: String(row.name),
      kind: String(row.kind),
      amount: Number(row.amount),
      currency: String(row.currency),
      dueDate: state.dueDate,
      daysLeft: state.daysLeft,
    })
  }
  if (due.length === 0) return json(request, { sent: false, count: 0 })

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
  if (!resendKey) return json(request, { error: 'Falta RESEND_API_KEY.' }, 500)

  const { data: claimedRows, error: claimError } = await admin
    .from('alert_notices')
    .upsert(
      due.map((item) => ({ recurring_id: item.id, due_date: item.dueDate })),
      { onConflict: 'recurring_id,due_date', ignoreDuplicates: true },
    )
    .select('recurring_id, due_date')
  if (claimError) return json(request, { error: claimError.message }, 500)

  const claimed = new Set((claimedRows ?? []).map((row) => `${row.recurring_id}|${String(row.due_date).slice(0, 10)}`))
  const pending = due.filter((item) => claimed.has(`${item.id}|${item.dueDate}`))
  if (pending.length === 0) return json(request, { sent: false, count: 0 })

  const byUser = new Map<string, Due[]>()
  for (const item of pending) {
    const list = byUser.get(item.userId) ?? []
    list.push(item)
    byUser.set(item.userId, list)
  }

  const failures: string[] = []
  let sentCount = 0
  for (const [userId, items] of byUser) {
    const to = await emailOf(admin, userId)
    if (!to) {
      await release(admin, items)
      failures.push('No se encontró el correo de una persona.')
      continue
    }
    const sent = await sendEmail(resendKey, to, emailFor(items, Deno.env.get('APP_URL') ?? DEFAULT_APP_URL))
    if (!sent.ok) {
      await release(admin, items)
      failures.push(sent.error)
      continue
    }
    sentCount += items.length
  }

  if (sentCount === 0) return json(request, { sent: false, count: 0, errors: failures }, failures.length ? 502 : 200)
  console.log(`Correos de pagos fijos enviados (${sentCount}).`)
  return json(request, { sent: true, count: sentCount, errors: failures })
})

async function emailOf(admin: NonNullable<ReturnType<typeof adminClient>>, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  return data.user.email.toLowerCase()
}

async function release(admin: NonNullable<ReturnType<typeof adminClient>>, items: Due[]): Promise<void> {
  for (const item of items) {
    await admin.from('alert_notices').delete().eq('recurring_id', item.id).eq('due_date', item.dueDate)
  }
}

function money(amount: number, currency: string): string {
  const number = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${SYMBOL[currency] ?? currency} ${number}`
}

function when(daysLeft: number): string {
  if (daysLeft < -1) return `venció hace ${-daysLeft} días`
  if (daysLeft === -1) return 'venció ayer'
  if (daysLeft === 0) return 'vence hoy'
  if (daysLeft === 1) return 'vence mañana'
  return `vence en ${daysLeft} días`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

function emailFor(items: Due[], appUrl: string): { subject: string; html: string; text: string } {
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const lines = sorted.map(
    (item) => `${item.kind === 'income' ? 'Cobro' : 'Pago'} ${item.name}: ${money(item.amount, item.currency)}, ${when(item.daysLeft)} (${item.dueDate})`,
  )
  const subject =
    sorted.length === 1 ? `AnderWallet: ${sorted[0].name} ${when(sorted[0].daysLeft)}` : `AnderWallet: ${sorted.length} pagos fijos por atender`
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#0f172a">
<h2 style="color:#16a34a">Pagos fijos por atender</h2>
<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
<p>Se anotan cuando los confirmas en la app.</p>
<p><a href="${escapeHtml(appUrl)}" style="color:#16a34a">Abrir AnderWallet</a></p>
</body></html>`
  const text = `Pagos fijos por atender\n\n${lines.join('\n')}\n\nSe anotan cuando los confirmas en la app: ${appUrl}`
  return { subject, html, text }
}

async function sendEmail(
  apiKey: string,
  to: string,
  message: { subject: string; html: string; text: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('ALERT_FROM') ?? DEFAULT_FROM, to: [to], ...message }),
  })
  if (response.ok) return { ok: true }
  const body = (await response.json().catch(() => null)) as { message?: string } | null
  return { ok: false, error: body?.message || 'Resend no aceptó el correo.' }
}
