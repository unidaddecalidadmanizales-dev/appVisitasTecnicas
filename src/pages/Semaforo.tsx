import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getInstituciones } from '@/lib/queries/instituciones'
import { getProcesos } from '@/lib/queries/procesos'
import { getResultadosSemaforo } from '@/lib/queries/visitas'
import { SEMAFORO_BANDAS_BAJAS, SEMAFORO_OPCIONES } from '@/lib/constants'
import { SEMAFORO_COLOR } from '@/components/visitas/ResultadoSemaforo'
import { construirCeldas } from '@/lib/semaforo'
import { StatCard } from '@/components/dashboard/StatCard'
import { SemaforoMatriz } from '@/components/dashboard/SemaforoMatriz'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Barra de distribución de la escala completa. Se prefiere a cuatro cifras
 * sueltas porque lo que importa no es cuántas hay de cada nivel, sino qué
 * proporción del total está en cada banda — eso se lee de un vistazo en una
 * barra y no en una lista de números.
 */
function DistribucionMadurez({
  conteos,
  total,
}: {
  conteos: Record<string, number>
  total: number
}) {
  if (total === 0) return null

  return (
    <Card className="gap-3 px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Distribución de madurez</p>
        <p className="text-xs text-muted-foreground">
          {total} evaluaciones vigentes
        </p>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full">
        {SEMAFORO_OPCIONES.map((nivel) => {
          const n = conteos[nivel] ?? 0
          if (n === 0) return null
          return (
            <span
              key={nivel}
              title={`${nivel}: ${n}`}
              style={{ width: `${(n / total) * 100}%` }}
              className={SEMAFORO_COLOR[nivel]}
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
            </span>
          )
        })}
      </div>
    </Card>
  )
}

export default function Semaforo() {
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

  const celdas = useMemo(() => construirCeldas(resultados), [resultados])

  const resumen = useMemo(() => {
    const conteos: Record<string, number> = {}
    let vencidas = 0
    let bajos = 0
    const institucionesConDatos = new Set<string>()

    for (const [clave, celda] of celdas) {
      conteos[celda.resultado] = (conteos[celda.resultado] ?? 0) + 1
      if (celda.vencida) vencidas++
      if (SEMAFORO_BANDAS_BAJAS.includes(celda.resultado)) bajos++
      institucionesConDatos.add(clave.split('|')[0])
    }

    const posibles = instituciones.length * procesos.length
    return {
      conteos,
      evaluados: celdas.size,
      posibles,
      cobertura: posibles > 0 ? Math.round((celdas.size / posibles) * 100) : 0,
      sinEvaluar: instituciones.length - institucionesConDatos.size,
      vencidas,
      bajos,
    }
  }, [celdas, instituciones.length, procesos.length])

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Semáforo</h1>
        <p className="text-muted-foreground">
          Estado de madurez de cada proceso en cada institución, según la última
          visita finalizada.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Cobertura"
              value={resumen.cobertura}
              suffix="%"
              tone="teal"
              hint={`${resumen.evaluados} de ${resumen.posibles} combinaciones`}
            />
            <StatCard
              label="Instituciones sin evaluar"
              value={resumen.sinEvaluar}
              tone="primary"
              hint={`de ${instituciones.length} registradas`}
            />
            <StatCard
              label="Evaluaciones desactualizadas"
              value={resumen.vencidas}
              tone="primary"
              hint="con más de un año"
            />
            <StatCard
              label="En bandas bajas"
              value={resumen.bajos}
              tone="teal"
              hint="Existencia o Pertinencia"
            />
          </div>

          <DistribucionMadurez
            conteos={resumen.conteos}
            total={resumen.evaluados}
          />

          <SemaforoMatriz
            instituciones={instituciones}
            procesos={procesos}
            celdas={celdas}
          />
        </>
      )}
    </div>
  )
}
