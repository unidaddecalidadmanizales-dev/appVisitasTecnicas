import { supabase } from '@/lib/supabase'

// Ambas claves viven en localStorage, NO en sessionStorage, porque tienen que
// acompañar a la sesión de Supabase — que supabase-js también guarda en
// localStorage. Con sessionStorage se perdían al cerrar la pestaña y no se
// compartían entre pestañas: el administrador quedaba dentro de la cuenta del
// profesional, sin banner y sin forma de volver a la suya.
const CLAVE_SESION_ORIGINAL = 'admin_sesion_original'
const CLAVE_NOMBRE_IMPERSONADO = 'admin_impersonando_nombre'

interface SesionGuardada {
  access_token: string
  refresh_token: string
}

export function nombreImpersonado(): string | null {
  return localStorage.getItem(CLAVE_NOMBRE_IMPERSONADO)
}

export function estaImpersonando(): boolean {
  return localStorage.getItem(CLAVE_SESION_ORIGINAL) !== null
}

/**
 * Descarta el rastro de impersonación sin intentar restaurar nada. Se usa al
 * cerrar sesión: ahí la sesión guardada ya no sirve, y dejarla haría que al
 * volver a entrar apareciera el banner "estás actuando como…" siendo falso.
 */
export function limpiarImpersonacion(): void {
  localStorage.removeItem(CLAVE_SESION_ORIGINAL)
  localStorage.removeItem(CLAVE_NOMBRE_IMPERSONADO)
}

/**
 * Guarda la sesión actual del administrador y la reemplaza por una sesión
 * real del profesional indicado (mismo mecanismo de magic link que el
 * login) — de ahí en adelante la app ve y hace exactamente lo que
 * vería/haría esa cuenta, porque es su sesión real, no una simulación.
 *
 * La sesión del administrador NO se cierra: sus tokens quedan guardados y
 * `volverACuentaOriginal()` los reinstala tal cual.
 */
export async function iniciarImpersonacion(
  hashedToken: string,
  nombre: string,
): Promise<void> {
  const { data: sesionActual } = await supabase.auth.getSession()
  if (!sesionActual.session) throw new Error('No hay sesión activa')

  const guardada: SesionGuardada = {
    access_token: sesionActual.session.access_token,
    refresh_token: sesionActual.session.refresh_token,
  }
  localStorage.setItem(CLAVE_SESION_ORIGINAL, JSON.stringify(guardada))
  localStorage.setItem(CLAVE_NOMBRE_IMPERSONADO, nombre)

  const { error } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'email',
  })
  if (error) {
    limpiarImpersonacion()
    throw error
  }
}

/**
 * Restaura la sesión del administrador guardada antes de impersonar.
 *
 * Las claves se borran solo si `setSession` tuvo éxito: si falla (red caída,
 * token vencido), se conservan para poder reintentar desde el banner en vez
 * de dejar al administrador atrapado en la cuenta del profesional.
 */
export async function volverACuentaOriginal(): Promise<void> {
  const guardada = localStorage.getItem(CLAVE_SESION_ORIGINAL)
  if (!guardada) return

  let tokens: SesionGuardada
  try {
    tokens = JSON.parse(guardada) as SesionGuardada
  } catch {
    limpiarImpersonacion()
    throw new Error('La sesión guardada está corrupta. Vuelve a iniciar sesión.')
  }

  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })
  if (error) throw error

  limpiarImpersonacion()
}
