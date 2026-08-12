import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database.types'
import type { Rol } from '@/hooks/useAuth'

export type Profesional = Tables<'profesionales'>

/**
 * Lista de profesionales para mostrar en la UI (listados, reportes, selectores).
 * Excluye 'administrador' a propósito: esa cuenta es de uso interno del
 * sistema y nunca debe aparecer en listados ni informes, a diferencia de
 * 'coordinador', que tiene los mismos permisos pero sí debe verse.
 */
export async function getProfesionales(): Promise<Profesional[]> {
  const { data, error } = await supabase
    .from('profesionales')
    .select('*')
    .neq('rol', 'administrador')
    .order('nombre')
  if (error) throw error
  return data
}

export async function actualizarProfesional(
  id: string,
  patch: { nombre?: string; rol?: Rol; firma_url?: string | null },
): Promise<Profesional> {
  const { data, error } = await supabase
    .from('profesionales')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

const BUCKET_FIRMAS = 'visitas'

/**
 * Sube la imagen de firma de un profesional a Storage y devuelve la URL
 * pública. Un solo archivo por profesional (se sobrescribe con `upsert`), a
 * diferencia de la firma por visita que existía antes.
 */
export async function subirFirmaProfesional(
  profesionalId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `firmas-profesional/${profesionalId}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET_FIRMAS)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return supabase.storage.from(BUCKET_FIRMAS).getPublicUrl(path).data.publicUrl
}

/**
 * Auto-servicio: el propio profesional actualiza su firma. Usa el RPC
 * `actualizar_mi_firma` porque la policy de UPDATE de `profesionales` solo
 * permite escritura amplia al coordinador (ver migración
 * agregar_firma_digital_profesional).
 */
export async function actualizarMiFirma(url: string): Promise<void> {
  const { error } = await supabase.rpc('actualizar_mi_firma', {
    p_firma_url: url,
  })
  if (error) throw error
}

/**
 * Invoca una Edge Function y desenvuelve su mensaje de error.
 * `FunctionsHttpError` no trae el cuerpo en `error.message` (solo un genérico
 * "non-2xx status code"), sino en `error.context`, que hay que leer como JSON
 * para llegar al texto en español que devuelve la función.
 */
async function invocarFuncion<T>(
  nombre: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nombre, { body })
  if (error) {
    const delContexto = (await error.context?.json?.().catch(() => null))?.error
    throw new Error(
      (typeof data === 'object' && data?.error) || delContexto || error.message,
    )
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export interface CrearProfesionalInput {
  nombre: string
  email: string
  rol: Rol
}

/**
 * Crea el usuario en Supabase Auth vía Edge Function (requiere service_role,
 * imposible desde el cliente). El trigger `on_auth_user_created` crea la
 * fila en `profesionales` automáticamente a partir de los metadatos.
 */
export async function crearProfesional(
  input: CrearProfesionalInput,
): Promise<{ id: string; email: string }> {
  return invocarFuncion<{ id: string; email: string }>(
    'crear-profesional',
    input as unknown as Record<string, unknown>,
  )
}

export interface LinkImpersonacion {
  hashed_token: string
  profesionalNombre: string
}

/**
 * Genera un magic link real (no una simulación) para que el administrador
 * pueda entrar a la cuenta de otro profesional/coordinador — solo el
 * administrador puede llamar esta función (lo valida el backend).
 */
export async function generarLinkImpersonacion(
  profesionalId: string,
): Promise<LinkImpersonacion> {
  return invocarFuncion<LinkImpersonacion>('impersonar-profesional', {
    profesionalId,
  })
}

/**
 * Devuelve la contraseña del profesional a la inicial y lo obliga a definir
 * una propia al entrar. La contraseña la fija el backend, no el cliente.
 * Permitido a coordinador y administrador (lo valida la Edge Function).
 */
export async function resetearPassword(
  profesionalId: string,
): Promise<{ profesionalNombre: string; passwordInicial: string }> {
  return invocarFuncion<{ profesionalNombre: string; passwordInicial: string }>(
    'resetear-password',
    { profesionalId },
  )
}

/**
 * Última conexión (último inicio de sesión) de cada profesional, indexada por
 * id. El dato vive en `auth.users`, inaccesible desde el cliente, así que llega
 * por el RPC `ultimas_conexiones`, que solo responde a la cuenta administrador
 * — para cualquier otro rol la llamada falla en la base de datos, no en la UI.
 */
export async function getUltimasConexiones(): Promise<Map<string, string | null>> {
  const { data, error } = await supabase.rpc('ultimas_conexiones')
  if (error) throw error
  return new Map(data.map((f) => [f.profesional_id, f.ultima_conexion]))
}
