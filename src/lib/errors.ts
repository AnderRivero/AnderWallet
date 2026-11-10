const KNOWN: Array<[RegExp, string]> = [
  [/accounts_name_key/, 'Ya existe una cuenta con ese nombre.'],
  [/categories_unique_name/, 'Ya existe una categoría con ese nombre.'],
  [/accounts_crypto_usdt/, 'Una cuenta cripto tiene que estar en USDT.'],
  [/accounts_ref_differs/, 'La moneda de referencia tiene que ser distinta a la principal.'],
  [/movements_account_id_fkey/, 'Esa cuenta tiene movimientos. Bórralos o muévelos antes de eliminarla.'],
  [/movements_category_id_fkey/, 'Esa categoría tiene movimientos. Cámbialos antes de eliminarla.'],
  [/movements_one_loan/, 'Ese préstamo ya tiene su salida de una cuenta.'],
  [/_icon/, 'El icono no es válido. Una URL tiene que empezar con https://.'],
  [/row-level security|permission denied|No autorizado/i, 'La base rechazó la operación. Vuelve a entrar con tu cuenta y tu código.'],
  [/JWT expired|invalid JWT/i, 'La sesión venció. Vuelve a entrar.'],
  [/restore_backup.*(could not find|does not exist|schema cache)/i, 'Falta ejecutar supabase/schema.sql en Supabase.'],
  [/Failed to fetch|NetworkError|Load failed/i, 'No hay conexión con Supabase.'],
]

export function errorText(error: unknown): string {
  const message = messageOf(error)
  if (!message) return 'No se pudo completar la acción.'
  for (const [pattern, text] of KNOWN) {
    if (pattern.test(message)) return text
  }
  return message
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error && error.message) return String(error.message)
  return ''
}
