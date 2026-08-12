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

/**
 * Lista de asistencias técnicas para los listados.
 *
 * El filtro va explícito y no delegado a la RLS: desde que el semáforo es
 * visible para todos, la política de `visitas` deja leer todas las
 * finalizadas, así que sin `profesionalId` un profesional se descargaría las
 * de todo el equipo para luego descartarlas en el cliente.
 */
export async function getVisitas(
  opciones: { profesionalId?: string; soloFinalizadas?: boolean } = {},
): Promise<VisitaConRelaciones[]> {
  let consulta = supabase
    .from('visitas')
    .select(RELACIONES)
    .order('created_at', { ascending: false })

  if (opciones.profesionalId) {
    consulta = consulta.eq('profesional_id', opciones.profesionalId)
  }
  if (opciones.soloFinalizadas) {
    consulta = consulta.eq('estado', 'finalizado')
  }

  const { data, error } = await consulta
  if (error) throw error
  return data as unknown as VisitaConRelaciones[]
}

export type ResultadoSemaforoRow = {
  id: string
  institucion_id: string
  proceso_id: string
  resultado_semaforo: string
  fecha: string
  numero_visita: number
}

/**
 * Resultados de las asistencias finalizadas (para el semáforo). Va por RPC y no
 * por la tabla porque el semáforo lo ve todo el equipo, mientras que la RLS de
 * `visitas` solo deja leer las propias: la función expone únicamente las seis
 * columnas que se pintan en la matriz, sin profesional ni observaciones.
 *
 * Llega ordenado por numero_visita desc; la reducción a "la más reciente por
 * institución+proceso" se hace en el cliente (ver `construirCeldas`).
 */
export async function getResultadosSemaforo(): Promise<ResultadoSemaforoRow[]> {
  const { data, error } = await supabase.rpc('resultados_semaforo')
  if (error) throw error
  return data as ResultadoSemaforoRow[]
}

export type RespuestaConIndicador = Respuesta & {
  indicadores: Pick<Tables<'indicadores'>, 'id' | 'criterio' | 'orden'> | null
}

export type VisitaResumen = VisitaConRelaciones & {
  respuestas: RespuestaConIndicador[]
  compromisos: Compromiso[]
}

/**
 * Asistencia completa para el resumen de solo lectura: relaciones, respuestas
 * con su indicador y compromisos, en una sola llamada.
 *
 * Va por RPC por lo mismo que `getResultadosSemaforo`: desde el semáforo se
 * abre el resumen de cualquier asistencia finalizada, también de otro
 * profesional, y eso no lo permite la RLS de `visitas`. La función solo
 * entrega finalizadas a quien no sea su autor ni coordinación, así que los
 * borradores siguen siendo privados.
 */
export async function getResumenVisita(id: string): Promise<VisitaResumen> {
  const { data, error } = await supabase.rpc('resumen_asistencia', {
    p_visita_id: id,
  })
  if (error) throw error
  return data as unknown as VisitaResumen
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
