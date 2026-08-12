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

export interface CrearProfesionalInput {
  nombre: string
  email: string
  password: string
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
  const { data, error } = await supabase.functions.invoke('crear-profesional', {
    body: input,
  })
  if (error) {
    // FunctionsHttpError trae la respuesta JSON del error en `context`.
    const mensaje =
      (typeof data === 'object' && data?.error) ||
      (await error.context?.json?.().catch(() => null))?.error ||
      error.message
    throw new Error(mensaje)
  }
  if (data?.error) throw new Error(data.error)
  return data
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
  const { data, error } = await supabase.functions.invoke('impersonar-profesional', {
    body: { profesionalId },
  })
  if (error) {
    const mensaje =
      (typeof data === 'object' && data?.error) ||
      (await error.context?.json?.().catch(() => null))?.error ||
      error.message
    throw new Error(mensaje)
  }
  if (data?.error) throw new Error(data.error)
  return data
}
