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
 * `hastaAnio` convierte el semáforo en una foto del pasado: con 2025 se ve cómo
 * estaba al cierre de ese año, es decir la última asistencia hecha hasta el
 * 31/12/2025 de cada par. No es "solo las de 2025": una institución evaluada en
 * 2024 y no vuelta a visitar sigue mostrando su resultado de 2024, porque ese
 * era su estado al terminar 2025.
 *
 * La lista llega ordenada por numero_visita desc, así que tras descartar los
 * años posteriores la primera aparición de cada par sigue siendo la más
 * reciente de las que quedan.
 */
export function construirCeldas(
  resultados: ResultadoSemaforoRow[],
  hastaAnio?: number,
): Map<string, CeldaSemaforo> {
  const celdas = new Map<string, CeldaSemaforo>()
  for (const r of resultados) {
    if (hastaAnio !== undefined && anioDe(r.fecha) > hastaAnio) continue
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
