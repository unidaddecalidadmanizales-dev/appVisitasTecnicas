import { supabase } from '@/lib/supabase'

const CLAVE_SESION_ORIGINAL = 'admin_sesion_original'
const CLAVE_NOMBRE_IMPERSONADO = 'admin_impersonando_nombre'

export function nombreImpersonado(): string | null {
  return sessionStorage.getItem(CLAVE_NOMBRE_IMPERSONADO)
}

/**
 * Guarda la sesión actual del administrador y la reemplaza por una sesión
 * real del profesional indicado (mismo mecanismo de magic link que el
 * login) — de ahí en adelante la app ve y hace exactamente lo que
 * vería/haría esa cuenta, porque es su sesión real, no una simulación.
 */
export async function iniciarImpersonacion(
  hashedToken: string,
  nombre: string,
): Promise<void> {
  const { data: sesionActual } = await supabase.auth.getSession()
  if (!sesionActual.session) throw new Error('No hay sesión activa')

  sessionStorage.setItem(
    CLAVE_SESION_ORIGINAL,
    JSON.stringify({
      access_token: sesionActual.session.access_token,
      refresh_token: sesionActual.session.refresh_token,
    }),
  )
  sessionStorage.setItem(CLAVE_NOMBRE_IMPERSONADO, nombre)

  const { error } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'email',
  })
  if (error) {
    sessionStorage.removeItem(CLAVE_SESION_ORIGINAL)
    sessionStorage.removeItem(CLAVE_NOMBRE_IMPERSONADO)
    throw error
  }
}

/** Restaura la sesión del administrador guardada antes de impersonar. */
export async function volverACuentaOriginal(): Promise<void> {
  const guardada = sessionStorage.getItem(CLAVE_SESION_ORIGINAL)
  if (!guardada) return
  const { access_token, refresh_token } = JSON.parse(guardada) as {
    access_token: string
    refresh_token: string
  }
  sessionStorage.removeItem(CLAVE_SESION_ORIGINAL)
  sessionStorage.removeItem(CLAVE_NOMBRE_IMPERSONADO)
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw error
}
