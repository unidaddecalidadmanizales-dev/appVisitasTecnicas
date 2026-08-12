import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { VisitaConRelaciones } from '@/lib/queries/visitas'
import type { Semaforo } from '@/lib/constants'
import { SEMAFORO_COLOR } from '@/components/visitas/ResultadoSemaforo'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

const ESTADO_VARIANT = { finalizado: 'teal', borrador: 'brand' } as const

export interface ProcesoSeleccionado {
  id: string
  nombre: string
}

interface Props {
  proceso: ProcesoSeleccionado | null
  /** Todas las visitas de la institución; se filtra aquí por proceso. Evita
   * una consulta aparte — el detalle de institución ya las tiene cargadas. */
  visitas: VisitaConRelaciones[]
  onOpenChange: (abierto: boolean) => void
  onAbrirResumen: (visitaId: string) => void
}

/**
 * Todas las asistencias técnicas de un proceso dentro de una institución, de
 * la más reciente a la más antigua. Es el paso intermedio entre el semáforo de
 * la institución (que solo muestra la última) y el resumen de una asistencia
 * puntual — aquí se elige CUÁL de las anteriores revisar.
 */
export function ProcesoHistorialDialog({
  proceso,
  visitas,
  onOpenChange,
  onAbrirResumen,
}: Props) {
  const navigate = useNavigate()

  const delProceso = useMemo(() => {
    if (!proceso) return []
    return visitas
      .filter((v) => v.proceso_id === proceso.id)
      .sort((a, b) => b.numero_visita - a.numero_visita)
  }, [visitas, proceso])

  return (
    <Dialog open={proceso !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{proceso?.nombre}</DialogTitle>
          <DialogDescription>
            {delProceso.length === 0
              ? 'Sin asistencias técnicas registradas'
              : `${delProceso.length} asistencia${delProceso.length === 1 ? '' : 's'} técnica${delProceso.length === 1 ? '' : 's'}, de la más reciente a la más antigua`}
          </DialogDescription>
        </DialogHeader>

        {delProceso.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no se ha registrado ninguna asistencia técnica de este
            proceso en esta institución.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {delProceso.map((v) => {
              const finalizada = v.estado === 'finalizado'
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() =>
                      finalizada
                        ? onAbrirResumen(v.id)
                        : navigate(`/visitas/${v.id}`)
                    }
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {formatearFecha(v.fecha)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.profesionales.nombre}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {v.resultado_semaforo && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              'size-2.5 rounded-[3px]',
                              SEMAFORO_COLOR[v.resultado_semaforo as Semaforo],
                            )}
                          />
                          {v.resultado_semaforo}
                        </span>
                      )}
                      <Badge
                        variant={
                          ESTADO_VARIANT[v.estado as 'finalizado' | 'borrador']
                        }
                      >
                        {finalizada ? 'Finalizada' : 'Borrador'}
                      </Badge>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
