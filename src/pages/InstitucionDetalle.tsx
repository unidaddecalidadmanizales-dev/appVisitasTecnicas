import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getInstitucion } from '@/lib/queries/instituciones'
import { getProcesos } from '@/lib/queries/procesos'
import { getVisitas, type VisitaConRelaciones } from '@/lib/queries/visitas'
import type { Semaforo } from '@/lib/constants'
import {
  SEMAFORO_COLOR,
  SEMAFORO_SHADOW,
} from '@/components/visitas/ResultadoSemaforo'
import { VisitaResumenDialog } from '@/components/dashboard/VisitaResumenDialog'
import {
  ProcesoHistorialDialog,
  type ProcesoSeleccionado,
} from '@/components/dashboard/ProcesoHistorialDialog'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

interface CeldaProceso {
  visitaId: string
  resultado: Semaforo
  fecha: string
}

/**
 * Semáforo de una sola institución: un sello por proceso, con su última
 * asistencia finalizada. A diferencia de la matriz general, aquí no hace
 * falta abreviar ni acotar el alto — son ~18 procesos como mucho — así que
 * cada uno se lee con su nombre completo y la fecha, sin pasar el cursor.
 *
 * Cada proceso es clickable siempre, tenga o no resultado: abre el historial
 * completo de ese proceso en esta institución (no directo el resumen), porque
 * puede haber asistencias anteriores o borradores en curso que valga la pena
 * ver aunque la última finalizada no exista todavía.
 */
function SemaforoInstitucion({
  procesos,
  visitas,
  onAbrirProceso,
}: {
  procesos: { id: string; nombre: string }[]
  visitas: VisitaConRelaciones[]
  onAbrirProceso: (proceso: ProcesoSeleccionado) => void
}) {
  const celdaPorProceso = useMemo(() => {
    const mapa = new Map<string, CeldaProceso>()
    // Ordenadas por numero_visita desc: la primera aparición de cada proceso
    // es su asistencia más reciente.
    const finalizadas = [...visitas]
      .filter((v) => v.estado === 'finalizado' && v.resultado_semaforo)
      .sort((a, b) => b.numero_visita - a.numero_visita)
    for (const v of finalizadas) {
      if (mapa.has(v.proceso_id)) continue
      mapa.set(v.proceso_id, {
        visitaId: v.id,
        resultado: v.resultado_semaforo as Semaforo,
        fecha: v.fecha,
      })
    }
    return mapa
  }, [visitas])

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {procesos.map((proceso) => {
        const celda = celdaPorProceso.get(proceso.id)
        return (
          <button
            key={proceso.id}
            type="button"
            onClick={() => onAbrirProceso(proceso)}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              !celda && 'opacity-60',
            )}
          >
            <span
              className={cn(
                'size-3 shrink-0 rounded-full',
                celda
                  ? cn(SEMAFORO_COLOR[celda.resultado], SEMAFORO_SHADOW[celda.resultado])
                  : 'border border-dashed border-muted-foreground/40',
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{proceso.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">
                {celda
                  ? `${celda.resultado} · ${formatearFecha(celda.fecha)}`
                  : 'Sin asistencia técnica finalizada'}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** Mismo par estado→variant que VisitasList, para que el mismo dato se vea igual en toda la app. */
const ESTADO_VARIANT = { finalizado: 'teal', borrador: 'brand' } as const

function HistorialAsistencias({
  visitas,
  onAbrirResumen,
}: {
  // Ya llegan de más reciente a más antigua (ver el orden de getVisitas):
  // no hace falta reordenar aquí.
  visitas: VisitaConRelaciones[]
  onAbrirResumen: (visitaId: string) => void
}) {
  const navigate = useNavigate()

  if (visitas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta institución todavía no tiene asistencias técnicas registradas.
      </p>
    )
  }

  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Proceso</TableHead>
            <TableHead>Profesional</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitas.map((v) => {
            const finalizada = v.estado === 'finalizado'
            return (
              <TableRow
                key={v.id}
                className="cursor-pointer hover:bg-primary/5"
                // Finalizada: abre el resumen de solo lectura, igual que en el
                // semáforo. Borrador: no hay nada que resumir todavía, así que
                // lleva al asistente para seguir diligenciándola.
                onClick={() =>
                  finalizada ? onAbrirResumen(v.id) : navigate(`/visitas/${v.id}`)
                }
              >
                <TableCell className="font-medium">{v.procesos.nombre}</TableCell>
                <TableCell className="text-muted-foreground">
                  {v.profesionales.nombre}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatearFecha(v.fecha)}
                </TableCell>
                <TableCell>
                  <Badge variant={ESTADO_VARIANT[v.estado as 'finalizado' | 'borrador']}>
                    {finalizada ? 'Finalizada' : 'Borrador'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {v.resultado_semaforo ? (
                    <span className="flex items-center gap-1.5 text-sm">
                      <span
                        className={cn(
                          'size-2.5 rounded-[3px]',
                          SEMAFORO_COLOR[v.resultado_semaforo as Semaforo],
                        )}
                      />
                      {v.resultado_semaforo}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Card>
  )
}

export default function InstitucionDetalle() {
  const { id } = useParams<{ id: string }>()
  const [visitaAbierta, setVisitaAbierta] = useState<string | null>(null)
  const [procesoAbierto, setProcesoAbierto] = useState<ProcesoSeleccionado | null>(
    null,
  )

  const { data: institucion, isLoading: cargandoInstitucion } = useQuery({
    queryKey: ['institucion', id],
    queryFn: () => getInstitucion(id!),
    enabled: !!id,
  })
  const { data: procesos = [], isLoading: cargandoProcesos } = useQuery({
    queryKey: ['procesos'],
    queryFn: getProcesos,
  })
  // Sin RPC: esta página solo la ven coordinador/administrador (ver App.tsx),
  // y su RLS ya da acceso completo a `visitas` vía is_coordinador() — incluye
  // borradores de cualquier profesional, que el semáforo general no muestra.
  const { data: visitas = [], isLoading: cargandoVisitas } = useQuery({
    queryKey: ['visitas-institucion', id],
    queryFn: () => getVisitas({ institucionId: id! }),
    enabled: !!id,
  })

  const isLoading = cargandoInstitucion || cargandoProcesos || cargandoVisitas

  if (!id) return null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          to="/instituciones"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Instituciones
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {cargandoInstitucion ? 'Cargando…' : institucion?.nombre}
          </h1>
          {institucion?.sector && (
            <Badge variant={institucion.sector === 'Oficial' ? 'brand' : 'teal'}>
              {institucion.sector}
            </Badge>
          )}
        </div>
        {institucion?.sede && (
          <p className="text-sm text-muted-foreground">{institucion.sede}</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Semáforo</h2>
            <SemaforoInstitucion
              procesos={procesos}
              visitas={visitas}
              onAbrirProceso={setProcesoAbierto}
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">
              Historial de asistencias técnicas
            </h2>
            <HistorialAsistencias
              visitas={visitas}
              onAbrirResumen={setVisitaAbierta}
            />
          </section>
        </div>
      )}

      <ProcesoHistorialDialog
        proceso={procesoAbierto}
        visitas={visitas}
        onOpenChange={(abierto) => {
          if (!abierto) setProcesoAbierto(null)
        }}
        onAbrirResumen={setVisitaAbierta}
      />

      {/* mostrarPdf: a diferencia del semáforo general, esta página es "revisar
          una asistencia pasada de esta institución" — sí tiene sentido bajar
          el informe oficial desde aquí. */}
      <VisitaResumenDialog
        visitaId={visitaAbierta}
        mostrarPdf
        onOpenChange={(abierto) => {
          if (!abierto) setVisitaAbierta(null)
        }}
      />
    </div>
  )
}
