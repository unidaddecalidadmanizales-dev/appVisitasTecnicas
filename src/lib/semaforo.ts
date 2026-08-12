import type { ResultadoSemaforoRow } from '@/lib/queries/visitas'
import type { Semaforo } from '@/lib/constants'

/**
 * A partir de cuántos meses una evaluación se considera desactualizada. La
 * asistencia técnica es anual, así que pasado un año el dato ya no describe la
 * situación actual de la institución.
 */
export const MESES_VIGENCIA = 12

export interface CeldaSemaforo {
  resultado: Semaforo
  fecha: string
  vencida: boolean
}

function mesesTranscurridos(fecha: string) {
  const [y, m] = fecha.split('-').map(Number)
  const hoy = new Date()
  return (hoy.getFullYear() - y) * 12 + (hoy.getMonth() - (m - 1))
}

/**
 * Reduce las visitas finalizadas a "la última por institución+proceso",
 * indexada por `institucionId|procesoId`. La consulta llega ordenada por
 * numero_visita desc, así que la primera aparición de cada par es la más
 * reciente.
 */
export function construirCeldas(
  resultados: ResultadoSemaforoRow[],
): Map<string, CeldaSemaforo> {
  const celdas = new Map<string, CeldaSemaforo>()
  for (const r of resultados) {
    const clave = `${r.institucion_id}|${r.proceso_id}`
    if (celdas.has(clave)) continue
    celdas.set(clave, {
      resultado: r.resultado_semaforo as Semaforo,
      fecha: r.fecha,
      vencida: mesesTranscurridos(r.fecha) >= MESES_VIGENCIA,
    })
  }
  return celdas
}
