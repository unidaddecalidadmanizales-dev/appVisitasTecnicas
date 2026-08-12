import type { Semaforo } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Rampa de color de la escala, de menor a mayor madurez:
 * Existencia → Pertinencia → Apropiación → Mejora continua.
 * El orden de los hues sigue el de SEMAFORO_OPCIONES; si uno cambia, cambian
 * los dos.
 */
export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  Existencia: 'bg-red-500',
  Pertinencia: 'bg-orange-500',
  Apropiación: 'bg-yellow-500',
  'Mejora continua': 'bg-emerald-500',
}

/** Sombra de brillo del mismo tono, para darle presencia a las marcas del semáforo. */
export const SEMAFORO_SHADOW: Record<Semaforo, string> = {
  Existencia: 'shadow-lg shadow-red-500/40',
  Pertinencia: 'shadow-lg shadow-orange-500/40',
  Apropiación: 'shadow-lg shadow-yellow-500/40',
  'Mejora continua': 'shadow-lg shadow-emerald-500/40',
}

/** Se calcula automáticamente a partir de las valoraciones de los
 * indicadores (ver calcularSemaforo en lib/constants) — ya no se elige
 * manualmente, así que este componente solo lo muestra. */
export function ResultadoSemaforo({ value }: { value: Semaforo }) {
  return (
    <div className="flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
      <span className={cn('size-2.5 shrink-0 rounded-full', SEMAFORO_COLOR[value], SEMAFORO_SHADOW[value])} />
      {value}
    </div>
  )
}
