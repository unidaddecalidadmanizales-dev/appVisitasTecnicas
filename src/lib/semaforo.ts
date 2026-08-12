import type { ResultadoSemaforoRow } from '@/lib/queries/visitas'
import type { Semaforo } from '@/lib/constants'

export interface CeldaSemaforo {
  /** Id de la asistencia que produjo este resultado, para abrir su resumen. */
  visitaId: string
  resultado: Semaforo
  fecha: string
}

function anioDe(fecha: string) {
  return Number(fecha.slice(0, 4))
}

/** Años con al menos una asistencia finalizada, del más reciente al más antiguo. */
export function aniosConDatos(resultados: ResultadoSemaforoRow[]): number[] {
  return [...new Set(resultados.map((r) => anioDe(r.fecha)))].sort((a, b) => b - a)
}

/**
 * Reduce las asistencias finalizadas a "la última por institución+proceso",
 * indexada por `institucionId|procesoId`.
 *
 * `anio` es un filtro estricto, no una foto acumulada: con 2025 seleccionado
 * solo entran asistencias realizadas EN 2025. Una institución evaluada en 2024
 * y no vuelta a visitar en 2025 no aparece — se ve "sin asistencia técnica
 * finalizada" en vez de arrastrar el resultado de 2024. Sin `anio` (undefined)
 * se usa la asistencia más reciente de cada par, sin importar el año.
 *
 * La lista llega ordenada por numero_visita desc, así que la primera
 * aparición de cada par (dentro del año, si se filtra) es la más reciente.
 */
export function construirCeldas(
  resultados: ResultadoSemaforoRow[],
  anio?: number,
): Map<string, CeldaSemaforo> {
  const celdas = new Map<string, CeldaSemaforo>()
  for (const r of resultados) {
    if (anio !== undefined && anioDe(r.fecha) !== anio) continue
    const clave = `${r.institucion_id}|${r.proceso_id}`
    if (celdas.has(clave)) continue
    celdas.set(clave, {
      visitaId: r.id,
      resultado: r.resultado_semaforo as Semaforo,
      fecha: r.fecha,
    })
  }
  return celdas
}
