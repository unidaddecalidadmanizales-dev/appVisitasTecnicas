import { supabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types'

export type Proceso = Tables<'procesos'>
export type Indicador = Tables<'indicadores'>
export type CampoExtra = Tables<'campos_extra_procesos'>

export async function getProcesos(): Promise<Proceso[]> {
  const { data, error } = await supabase
    .from('procesos')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}

export async function getProceso(id: string): Promise<Proceso> {
  const { data, error } = await supabase
    .from('procesos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function getIndicadores(procesoId: string): Promise<Indicador[]> {
  const { data, error } = await supabase
    .from('indicadores')
    .select('*')
    .eq('proceso_id', procesoId)
    .order('orden')
  if (error) throw error
  return data
}

export async function getCamposExtra(procesoId: string): Promise<CampoExtra[]> {
  const { data, error } = await supabase
    .from('campos_extra_procesos')
    .select('*')
    .eq('proceso_id', procesoId)
    .order('orden')
  if (error) throw error
  return data
}

/** Cantidad de indicadores por proceso, para el listado de la pestaña Procesos. */
export async function getConteoIndicadoresPorProceso(): Promise<
  Record<string, number>
> {
  const { data, error } = await supabase.from('indicadores').select('proceso_id')
  if (error) throw error
  const conteo: Record<string, number> = {}
  for (const row of data) {
    conteo[row.proceso_id] = (conteo[row.proceso_id] ?? 0) + 1
  }
  return conteo
}

export async function crearIndicador(
  input: TablesInsert<'indicadores'>,
): Promise<Indicador> {
  const { data, error } = await supabase
    .from('indicadores')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarIndicador(
  id: string,
  patch: TablesUpdate<'indicadores'>,
): Promise<Indicador> {
  const { data, error } = await supabase
    .from('indicadores')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Aplica el nuevo `orden` (1..N) tras arrastrar un indicador en la lista.
 * Va por un RPC (transacción única con el UNIQUE(proceso_id, orden)
 * diferido) porque varios updates paralelos independientes violan ese
 * constraint transitoriamente al cruzarse los valores de orden.
 */
export async function reordenarIndicadores(
  cambios: { id: string; orden: number }[],
): Promise<void> {
  const { error } = await supabase.rpc('reordenar_indicadores', {
    p_cambios: cambios,
  })
  if (error) throw error
}

/**
 * Lanza un error legible si el indicador ya tiene respuestas registradas
 * (la FK lo protege con RESTRICT — no se puede borrar el historial de una
 * visita ya diligenciada).
 */
export async function eliminarIndicador(id: string): Promise<void> {
  const { error } = await supabase.from('indicadores').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error(
        'No se puede eliminar: este indicador ya tiene respuestas registradas en alguna visita.',
      )
    }
    throw error
  }
}

export interface CapacidadPlantilla {
  capacidad: number
  actual: number
  disponible: number
}

/**
 * Compara la cantidad de indicadores del proceso contra la cantidad de tags
 * {indicadorN} que realmente tiene su plantilla — agregar un indicador
 * nuevo solo funciona directo si `disponible` (capacidad - actual) es > 0;
 * si no, hay que agregar una fila a mano en la plantilla de Google Docs
 * antes de que la plataforma pueda generar el PDF con ese indicador.
 */
export async function verificarPlantilla(procesoId: string): Promise<CapacidadPlantilla> {
  const { data, error } = await supabase.functions.invoke('verificar-plantilla', {
    body: { procesoId },
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
