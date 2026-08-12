import { supabase } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/database.types'
import type { Calificacion } from '@/lib/constants'

export type Visita = Tables<'visitas'>
export type Respuesta = Tables<'respuestas'>
export type Compromiso = Tables<'compromisos'>

export type VisitaConRelaciones = Visita & {
  instituciones: Pick<Tables<'instituciones'>, 'nombre' | 'sector' | 'sede'>
  procesos: Pick<Tables<'procesos'>, 'nombre' | 'clave' | 'objetivo_fijo'>
  profesionales: Pick<Tables<'profesionales'>, 'nombre'>
}

const RELACIONES =
  '*, instituciones(nombre, sector, sede), procesos(nombre, clave, objetivo_fijo), profesionales(nombre)'

/** Lista de visitas visibles para el usuario (RLS filtra por rol). */
export async function getMisVisitas(): Promise<VisitaConRelaciones[]> {
  const { data, error } = await supabase
    .from('visitas')
    .select(RELACIONES)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as VisitaConRelaciones[]
}

export type ResultadoSemaforoRow = {
  institucion_id: string
  proceso_id: string
  resultado_semaforo: string
  fecha: string
  numero_visita: number
}

/**
 * Resultados de las visitas finalizadas (para el semáforo). Se trae todo y se
 * reduce en el cliente a "la más reciente por institución+proceso" — el
 * volumen de datos de este sistema no justifica una vista SQL aparte.
 */
export async function getResultadosSemaforo(): Promise<ResultadoSemaforoRow[]> {
  const { data, error } = await supabase
    .from('visitas')
    .select('institucion_id, proceso_id, resultado_semaforo, fecha, numero_visita')
    .eq('estado', 'finalizado')
    .not('resultado_semaforo', 'is', null)
    .order('numero_visita', { ascending: false })
  if (error) throw error
  return data as ResultadoSemaforoRow[]
}

export async function getVisita(id: string): Promise<VisitaConRelaciones> {
  const { data, error } = await supabase
    .from('visitas')
    .select(RELACIONES)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as VisitaConRelaciones
}

export interface CrearVisitaInput {
  institucion_id: string
  proceso_id: string
  profesional_id: string
  fecha: string
  hora_inicio?: string | null
  hora_fin?: string | null
  objetivo?: string | null
  actividad_adicional?: string | null
  seguimiento_compromisos_anteriores?: string | null
}

/**
 * Crea la visita en estado 'borrador'. Calcula numero_visita con la función
 * `siguiente_numero_visita` (cuenta TODAS las visitas de esa institución+proceso,
 * saltando RLS, para no depender de lo que el profesional alcanza a ver).
 */
export async function crearVisita(input: CrearVisitaInput): Promise<Visita> {
  const { data: numero, error: numErr } = await supabase.rpc(
    'siguiente_numero_visita',
    { p_institucion: input.institucion_id, p_proceso: input.proceso_id },
  )
  if (numErr) throw numErr

  const { data, error } = await supabase
    .from('visitas')
    .insert({ ...input, numero_visita: numero ?? 1, estado: 'borrador' })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Solo borra visitas en 'borrador' (lo exige la política RLS). */
export async function eliminarVisita(id: string): Promise<void> {
  const { error } = await supabase.from('visitas').delete().eq('id', id)
  if (error) throw error
}

export async function actualizarVisita(
  id: string,
  patch: TablesUpdate<'visitas'>,
): Promise<Visita> {
  const { data, error } = await supabase
    .from('visitas')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Respuestas (checklist) ----

export async function getRespuestas(visitaId: string): Promise<Respuesta[]> {
  const { data, error } = await supabase
    .from('respuestas')
    .select('*')
    .eq('visita_id', visitaId)
  if (error) throw error
  return data
}

export interface UpsertRespuestaInput {
  visita_id: string
  indicador_id: string
  calificacion: Calificacion
  observacion?: string | null
}

/** Upsert por (visita_id, indicador_id): base del autosave sin duplicar filas. */
export async function upsertRespuesta(
  input: UpsertRespuestaInput,
): Promise<Respuesta> {
  const { data, error } = await supabase
    .from('respuestas')
    .upsert(input, { onConflict: 'visita_id,indicador_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Compromisos ----

export async function getCompromisos(visitaId: string): Promise<Compromiso[]> {
  const { data, error } = await supabase
    .from('compromisos')
    .select('*')
    .eq('visita_id', visitaId)
    .order('created_at')
  if (error) throw error
  return data
}

/**
 * Genera el informe final: copia la plantilla oficial de Google Docs del
 * proceso, la rellena con los datos de la visita y la exporta a PDF (Edge
 * Function `generar-pdf-google`). Deja `visitas.estado = 'finalizado'` y
 * `pdf_url` seteados del lado del servidor.
 */
export async function generarPdfGoogle(visitaId: string): Promise<{ pdfUrl: string }> {
  const { data, error } = await supabase.functions.invoke('generar-pdf-google', {
    body: { visitaId },
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

export interface CompromisoInput {
  id: string
  descripcion: string
  responsable?: string | null
  fecha_verificacion?: string | null
}

/**
 * Guarda los compromisos de la visita por upsert (id generado en cliente),
 * así se puede llamar repetidamente ("Guardar avance") sin duplicar filas.
 */
export async function guardarCompromisos(
  visitaId: string,
  items: CompromisoInput[],
): Promise<void> {
  if (items.length === 0) return
  const { error } = await supabase
    .from('compromisos')
    .upsert(
      items.map((it) => ({ ...it, visita_id: visitaId })),
      { onConflict: 'id' },
    )
  if (error) throw error
}

/** Elimina compromisos que el usuario quitó del formulario antes de guardar. */
export async function eliminarCompromisosPorId(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('compromisos').delete().in('id', ids)
  if (error) throw error
}
