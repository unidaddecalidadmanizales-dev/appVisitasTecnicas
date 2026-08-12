import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react'
import type { Indicador } from '@/lib/queries/procesos'
import type { Respuesta, VisitaConRelaciones } from '@/lib/queries/visitas'
import type { Semaforo } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function formatearHora(hora: string) {
  const [hStr, mStr] = hora.split(':')
  let h = parseInt(hStr, 10)
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${mStr} ${sufijo}`
}

/** Mismo estilo de pastilla que las calificaciones, aplicado al semáforo. */
const SEMAFORO_ESTILO: Record<Semaforo, string> = {
  Existencia: 'border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-400',
  Apropiación: 'border-orange-500/60 bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Pertinencia: 'border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Mejora continua':
    'border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
}

/** Orden fijo de las agrupaciones, de mejor a peor valoración. "Sin responder"
 * no se muestra: un indicador sin respuesta no es información útil aquí. */
const ORDEN_CALIFICACION = ['Existe', 'Existe con oportunidad de mejora', 'No existe', 'No aplica']

const CALIFICACION_ESTILO: Record<
  string,
  { borde: string; fondo: string; texto: string; icono: typeof CheckCircle2; colorIcono: string }
> = {
  Existe: {
    borde: 'border-emerald-500/60',
    fondo: 'bg-emerald-500/[0.06]',
    texto: 'text-emerald-700 dark:text-emerald-400',
    icono: CheckCircle2,
    colorIcono: 'text-emerald-600 dark:text-emerald-400',
  },
  'Existe con oportunidad de mejora': {
    borde: 'border-amber-500/60',
    fondo: 'bg-amber-500/[0.06]',
    texto: 'text-amber-700 dark:text-amber-400',
    icono: AlertTriangle,
    colorIcono: 'text-amber-600 dark:text-amber-400',
  },
  'No existe': {
    borde: 'border-red-500/60',
    fondo: 'bg-red-500/[0.06]',
    texto: 'text-red-700 dark:text-red-400',
    icono: XCircle,
    colorIcono: 'text-red-600 dark:text-red-400',
  },
  'No aplica': {
    borde: 'border-border',
    fondo: '',
    texto: 'text-muted-foreground',
    icono: MinusCircle,
    colorIcono: 'text-muted-foreground',
  },
}

interface Props {
  visita: VisitaConRelaciones
  indicadores: Indicador[]
  respuestas: Respuesta[]
}

export function ResumenVisita({ visita, indicadores, respuestas }: Props) {
  const respuestaPorIndicador = new Map(respuestas.map((r) => [r.indicador_id, r]))

  const porCalificacion = new Map<string, Indicador[]>()
  for (const ind of indicadores) {
    const calificacion = respuestaPorIndicador.get(ind.id)?.calificacion
    if (!calificacion) continue // sin responder: no se muestra
    if (!porCalificacion.has(calificacion)) porCalificacion.set(calificacion, [])
    porCalificacion.get(calificacion)!.push(ind)
  }
  const gruposOrdenados = ORDEN_CALIFICACION.filter((c) => porCalificacion.has(c))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Profesional" value={visita.profesionales?.nombre} />
        <Campo label="Fecha" value={formatearFecha(visita.fecha)} />
        <Campo
          label="Hora"
          value={
            visita.hora_inicio && visita.hora_fin
              ? `${formatearHora(visita.hora_inicio)} – ${formatearHora(visita.hora_fin)}`
              : null
          }
        />
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Resultado</p>
          {visita.resultado_semaforo ? (
            <Badge
              variant="outline"
              className={SEMAFORO_ESTILO[visita.resultado_semaforo as Semaforo]}
            >
              {visita.resultado_semaforo}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {gruposOrdenados.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Valoración por indicador</h3>
          <div className="space-y-4">
            {gruposOrdenados.map((calificacion) => {
              const inds = porCalificacion.get(calificacion)!
              const estilo = CALIFICACION_ESTILO[calificacion]
              const Icono = estilo.icono
              return (
                <div
                  key={calificacion}
                  className={cn('space-y-3 rounded-lg border p-4', estilo.borde, estilo.fondo)}
                >
                  <div
                    className={cn(
                      'flex items-center justify-between border-b border-dashed pb-2',
                      estilo.borde,
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm font-bold tracking-wide uppercase',
                        estilo.texto,
                      )}
                    >
                      {calificacion}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {inds.length} indicador{inds.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {inds.map((ind) => (
                      <li key={ind.id} className="flex items-start gap-2 text-sm">
                        <Icono className={cn('mt-0.5 size-4 shrink-0', estilo.colorIcono)} />
                        <span>{ind.criterio}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {visita.observaciones && (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Observaciones</h3>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {visita.observaciones}
          </p>
        </div>
      )}
    </div>
  )
}

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value?.trim() ? value : '—'}</p>
    </div>
  )
}
