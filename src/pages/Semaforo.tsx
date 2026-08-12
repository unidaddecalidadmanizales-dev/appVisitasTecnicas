import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getInstituciones } from '@/lib/queries/instituciones'
import { getProcesos } from '@/lib/queries/procesos'
import { getResultadosSemaforo } from '@/lib/queries/visitas'
import { SEMAFORO_OPCIONES } from '@/lib/constants'
import { aniosConDatos, construirCeldas } from '@/lib/semaforo'
import { useSemaforoFiltros } from '@/hooks/useSemaforoFiltros'
import { SEMAFORO_COLOR } from '@/components/visitas/ResultadoSemaforo'
import { SemaforoControles } from '@/components/dashboard/SemaforoControles'
import { SemaforoMatriz } from '@/components/dashboard/SemaforoMatriz'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Barra con la escala completa de lo que la matriz está mostrando en ese
 * momento. Se prefiere a cuatro cifras sueltas porque lo que importa no es
 * cuántas hay de cada nivel sino qué proporción del total está en cada uno, y
 * eso se lee de un vistazo en una barra y no en una lista de números.
 */
function ValoracionAsistencias({
  conteos,
  total,
}: {
  conteos: Record<string, number>
  total: number
}) {
  return (
    <Card className="gap-3 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">
          Valoración de las asistencias técnicas
        </p>
        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? 'asistencia' : 'asistencias'}
        </p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay asistencias técnicas que coincidan con los filtros.
        </p>
      ) : (
        <>
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {SEMAFORO_OPCIONES.map((nivel) => {
              const n = conteos[nivel] ?? 0
              if (n === 0) return null
              return (
                <span
                  key={nivel}
                  title={`${nivel}: ${n}`}
                  style={{ width: `${(n / total) * 100}%` }}
                  className={cn(SEMAFORO_COLOR[nivel], 'transition-all duration-300')}
                />
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {SEMAFORO_OPCIONES.map((nivel) => {
              const n = conteos[nivel] ?? 0
              return (
                <span
                  key={nivel}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={cn('size-2.5 rounded-[3px]', SEMAFORO_COLOR[nivel])}
                  />
                  <strong className="tabular-nums text-foreground">{n}</strong>
                  {nivel}
                  <span className="text-muted-foreground/70">
                    {Math.round((n / total) * 100)}%
                  </span>
                </span>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

export default function Semaforo() {
  // `undefined` = todo el histórico, sin corte por año. Arranca así porque
  // antes de que lleguen los resultados no se sabe cuál es "el último año con
  // datos" — el efecto de abajo lo fija en cuanto se conoce, y solo si el
  // usuario no ha tocado el selector todavía (para no pisarle una elección).
  const [anio, setAnio] = useState<number | undefined>(undefined)
  const [anioTocado, setAnioTocado] = useState(false)

  const { data: instituciones = [], isLoading: cargandoInst } = useQuery({
    queryKey: ['instituciones'],
    queryFn: getInstituciones,
  })
  const { data: procesos = [], isLoading: cargandoProc } = useQuery({
    queryKey: ['procesos'],
    queryFn: getProcesos,
  })
  const { data: resultados = [], isLoading: cargandoRes } = useQuery({
    queryKey: ['resultados-semaforo'],
    queryFn: getResultadosSemaforo,
  })

  const isLoading = cargandoInst || cargandoProc || cargandoRes

  // Viene ordenado de más reciente a más antiguo (ver aniosConDatos), así que
  // el primer elemento es el año por defecto.
  const anios = useMemo(() => aniosConDatos(resultados), [resultados])

  useEffect(() => {
    if (anioTocado || anios.length === 0) return
    setAnio(anios[0])
  }, [anios, anioTocado])

  function cambiarAnio(nuevo: number | undefined) {
    setAnioTocado(true)
    setAnio(nuevo)
  }

  const celdas = useMemo(
    () => construirCeldas(resultados, anio),
    [resultados, anio],
  )

  const filtros = useSemaforoFiltros({ instituciones, procesos, celdas })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Semáforo</h1>
        <p className="text-muted-foreground">
          Estado de cada proceso en cada institución, según la última asistencia
          técnica finalizada.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <>
          <SemaforoControles
            filtros={filtros}
            anios={anios}
            anio={anio}
            onAnioChange={cambiarAnio}
            totalInstituciones={instituciones.length}
            totalProcesos={procesos.length}
          />

          <ValoracionAsistencias
            conteos={filtros.conteosVisibles.porNivel}
            total={filtros.conteosVisibles.total}
          />

          <SemaforoMatriz
            procesos={procesos}
            celdas={celdas}
            filtros={filtros}
          />
        </>
      )}
    </div>
  )
}
