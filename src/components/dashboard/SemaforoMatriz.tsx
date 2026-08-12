import { useState } from 'react'
import type { Proceso } from '@/lib/queries/procesos'
import { SEMAFORO_OPCIONES } from '@/lib/constants'
import type { CeldaSemaforo } from '@/lib/semaforo'
import type { SemaforoFiltros } from '@/hooks/useSemaforoFiltros'
import {
  SEMAFORO_COLOR,
  SEMAFORO_SHADOW,
} from '@/components/visitas/ResultadoSemaforo'
import { VisitaResumenDialog } from '@/components/dashboard/VisitaResumenDialog'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  procesos: Proceso[]
  celdas: Map<string, CeldaSemaforo>
  filtros: SemaforoFiltros
}

/**
 * Matriz institución × proceso. Son más de 2000 celdas, así que la tabla por sí
 * sola no responde ninguna pregunta: lo que la hace útil es que se pueda
 * reducir y reordenar (ver `useSemaforoFiltros`), leer los totales por fila y
 * por columna, y abrir el resumen de cualquier celda.
 */
export function SemaforoMatriz({ procesos, celdas, filtros }: Props) {
  const [visitaAbierta, setVisitaAbierta] = useState<string | null>(null)
  const { filas, columnas, evaluadosPorInstitucion, conteoPorProceso } = filtros

  return (
    <div className="space-y-3">
      {filas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          Ninguna institución coincide con estos filtros.
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          {/* Alto acotado a propósito: con el contenedor haciendo el scroll en
              ambos ejes, el encabezado de procesos y la columna de nombres
              quedan fijos y la matriz nunca se lee "a ciegas". */}
          <div className="max-h-[70vh] overflow-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-56 border-b border-r bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Institución
                  </th>
                  {columnas.map((proceso) => {
                    const n = conteoPorProceso.get(proceso.id)!
                    return (
                      <th
                        key={proceso.id}
                        title={
                          filtros.valoracion === 'todas'
                            ? `${proceso.nombre}\nEvaluado en ${n} instituciones`
                            : `${proceso.nombre}\n${n} instituciones con valoración ${filtros.valoracion}`
                        }
                        className="sticky top-0 z-20 w-14 border-b border-r bg-background px-1 py-2 align-top last:border-r-0"
                      >
                        <span className="block text-[11px] font-semibold tracking-tight">
                          {proceso.abreviatura ?? proceso.nombre.slice(0, 4)}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block text-[11px] tabular-nums',
                            n === 0
                              ? 'text-muted-foreground/40'
                              : 'text-muted-foreground',
                          )}
                        >
                          {n}
                        </span>
                      </th>
                    )
                  })}
                  <th className="sticky top-0 z-20 border-b border-l bg-background px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">
                    Cobertura
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((inst) => {
                  const evaluados = evaluadosPorInstitucion.get(inst.id)!
                  return (
                    <tr key={inst.id} className="group hover:bg-primary/5">
                      <td className="sticky left-0 z-10 border-r border-b bg-background px-3 py-2 group-even:bg-muted/30 group-hover:bg-primary/5">
                        <span className="block font-medium leading-tight">
                          {inst.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inst.sector ?? 'Sin sector'}
                        </span>
                      </td>

                      {columnas.map((proceso) => {
                        const celda = celdas.get(`${inst.id}|${proceso.id}`)
                        // Con un filtro de valoración activo, las celdas que no
                        // son de esa valoración se atenúan en vez de ocultarse:
                        // siguen dando contexto de la institución sin competir
                        // con lo que se está buscando.
                        const atenuada =
                          filtros.valoracion !== 'todas' &&
                          celda !== undefined &&
                          celda.resultado !== filtros.valoracion
                        return (
                          <td
                            key={proceso.id}
                            className="border-r border-b p-0 text-center last:border-r-0"
                          >
                            <div className="flex h-12 items-center justify-center">
                              {celda ? (
                                <button
                                  type="button"
                                  onClick={() => setVisitaAbierta(celda.visitaId)}
                                  title={`${proceso.nombre}\n${celda.resultado} · ${formatearFecha(celda.fecha)}\nClic para ver el resumen`}
                                  aria-label={`${inst.nombre} — ${proceso.nombre}: ${celda.resultado}. Ver el resumen de la asistencia técnica`}
                                  className={cn(
                                    'size-6 rounded-[3px] transition-transform duration-200 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    SEMAFORO_COLOR[celda.resultado],
                                    SEMAFORO_SHADOW[celda.resultado],
                                    atenuada && 'opacity-20 shadow-none',
                                  )}
                                />
                              ) : (
                                <span
                                  title={`${proceso.nombre}: sin asistencia técnica finalizada`}
                                  className="size-6 rounded-[3px] border border-dashed border-muted-foreground/30"
                                />
                              )}
                            </div>
                          </td>
                        )
                      })}

                      <td className="border-b border-l px-3 py-2 text-right tabular-nums">
                        <span
                          className={
                            evaluados === 0
                              ? 'text-muted-foreground/60'
                              : 'font-medium'
                          }
                        >
                          {evaluados}
                        </span>
                        <span className="text-muted-foreground">
                          /{procesos.length}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          {SEMAFORO_OPCIONES.map((opt) => (
            <span key={opt} className="flex items-center gap-1.5">
              <span
                className={cn('size-2.5 rounded-[3px]', SEMAFORO_COLOR[opt])}
              />
              {opt}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-dashed border-muted-foreground/30" />
            Sin asistencia técnica finalizada
          </span>
        </div>
        <p className="text-xs text-muted-foreground/80">
          {filtros.valoracion === 'todas'
            ? 'El número bajo cada sigla es en cuántas instituciones se ha evaluado ese proceso. Haz clic en cualquier celda para ver el resumen de la asistencia técnica.'
            : `El número bajo cada sigla es cuántas instituciones tienen ese proceso en ${filtros.valoracion}. Haz clic en cualquier celda para ver el resumen de la asistencia técnica.`}
        </p>
      </div>

      <VisitaResumenDialog
        visitaId={visitaAbierta}
        onOpenChange={(abierto) => {
          if (!abierto) setVisitaAbierta(null)
        }}
      />
    </div>
  )
}
