import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getInstituciones } from '@/lib/queries/instituciones'
import { getProcesos } from '@/lib/queries/procesos'
import { getResultadosSemaforo } from '@/lib/queries/visitas'
import { StatCard } from '@/components/dashboard/StatCard'
import { SemaforoTable } from '@/components/dashboard/SemaforoTable'

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

  const combinacionesConResultado = new Set(
    resultados.map((r) => `${r.institucion_id}|${r.proceso_id}`),
  ).size
  const totalCombinaciones = instituciones.length * procesos.length
  const cobertura =
    totalCombinaciones > 0
      ? Math.round((combinacionesConResultado / totalCombinaciones) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Semáforo</h1>
        <p className="text-muted-foreground">
          Último resultado por institución y proceso.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Instituciones" value={instituciones.length} tone="teal" />
            <StatCard label="Procesos" value={procesos.length} tone="primary" />
            <StatCard
              label="Informes finalizados"
              value={resultados.length}
              tone="primary"
            />
            <StatCard
              label="Cobertura"
              value={cobertura}
              suffix="%"
              tone="teal"
              hint={`${combinacionesConResultado} de ${totalCombinaciones} combinaciones`}
            />
          </div>

          <SemaforoTable
            instituciones={instituciones}
            procesos={procesos}
            resultados={resultados}
          />
        </>
      )}
    </div>
  )
}
