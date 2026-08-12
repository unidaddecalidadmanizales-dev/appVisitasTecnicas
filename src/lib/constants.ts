// Valores que reflejan exactamente los CHECK del esquema en Supabase.

export const CALIFICACIONES = [
  'Existe',
  'Existe con oportunidad de mejora',
  'No existe',
  'No aplica',
] as const
export type Calificacion = (typeof CALIFICACIONES)[number]

export const SEMAFORO_OPCIONES = [
  'Existencia',
  'Apropiación',
  'Pertinencia',
  'Mejora continua',
] as const
export type Semaforo = (typeof SEMAFORO_OPCIONES)[number]

/** Puntaje de cada calificación para el promedio del semáforo (igual al
 * sistema anterior): "No aplica" no se tiene en cuenta en el promedio. */
const VALOR_CALIFICACION: Record<string, number> = {
  Existe: 5,
  'Existe con oportunidad de mejora': 3,
  'No existe': 1,
}

export function calcularSemaforo(
  respuestas: { calificacion: string }[],
): Semaforo {
  const valores = respuestas
    .filter((r) => r.calificacion !== 'No aplica')
    .map((r) => VALOR_CALIFICACION[r.calificacion] ?? 0)
  const promedio =
    valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
  if (promedio >= 4) return 'Mejora continua'
  if (promedio >= 3) return 'Apropiación'
  if (promedio >= 2) return 'Pertinencia'
  return 'Existencia'
}
