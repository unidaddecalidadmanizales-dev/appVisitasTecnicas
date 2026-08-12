import type { Institucion } from '@/lib/queries/instituciones'
import type { Proceso } from '@/lib/queries/procesos'
import type { ResultadoSemaforoRow } from '@/lib/queries/visitas'
import { SEMAFORO_OPCIONES, type Semaforo } from '@/lib/constants'
import { SEMAFORO_COLOR, SEMAFORO_SHADOW } from '@/components/visitas/ResultadoSemaforo'
import { cn } from '@/lib/utils'

interface Props {
  instituciones: Institucion[]
  procesos: Proceso[]
  resultados: ResultadoSemaforoRow[]
}

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

/** Delay de entrada en cascada, tipo sellos aplicándose uno tras otro. */
function delaySello(index: number) {
  return Math.min(index * 12, 500)
}

export function SemaforoTable({ instituciones, procesos, resultados }: Props) {
  // La consulta viene ordenada por numero_visita desc: la primera aparición
  // de cada par institución+proceso es, por definición, la más reciente.
  const porPar = new Map<string, ResultadoSemaforoRow>()
  for (const r of resultados) {
    const key = `${r.institucion_id}|${r.proceso_id}`
    if (!porPar.has(key)) porPar.set(key, r)
  }

  if (instituciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay instituciones registradas todavía.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-48 border-b border-r bg-background px-3 py-2 text-left align-bottom text-xs font-medium text-muted-foreground">
                Institución
              </th>
              {procesos.map((proceso) => (
                <th
                  key={proceso.id}
                  title={proceso.nombre}
                  className="h-40 w-11 border-b border-r p-0 align-bottom last:border-r-0"
                >
                  <div className="flex h-full items-center justify-center pb-2">
                    <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-xs text-muted-foreground">
                      {proceso.nombre}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instituciones.map((inst, instIdx) => (
              <tr
                key={inst.id}
                className="group transition-colors hover:bg-primary/5"
              >
                <td className="sticky left-0 z-10 border-r bg-background px-3 py-2 font-medium group-even:bg-muted/30 group-hover:bg-primary/5">
                  {inst.nombre}
                </td>
                {procesos.map((proceso, procIdx) => {
                  const r = porPar.get(`${inst.id}|${proceso.id}`)
                  const resultado = r?.resultado_semaforo as Semaforo | undefined
                  const color = resultado ? SEMAFORO_COLOR[resultado] : undefined
                  const glow = resultado ? SEMAFORO_SHADOW[resultado] : undefined
                  const delay = delaySello(instIdx * procesos.length + procIdx)
                  return (
                    <td
                      key={proceso.id}
                      className="border-r p-0 text-center last:border-r-0"
                    >
                      <div className="flex h-12 items-center justify-center">
                        {r ? (
                          <span
                            title={`${proceso.nombre}\n${r.resultado_semaforo} · ${formatearFecha(r.fecha)}`}
                            style={{ animationDelay: `${delay}ms` }}
                            className={cn(
                              'size-6 animate-in rounded-[4px] fade-in zoom-in-50 cursor-default transition-transform duration-300 ease-out fill-mode-backwards hover:scale-125',
                              color,
                              glow,
                            )}
                          />
                        ) : (
                          <span
                            title={`${proceso.nombre}: sin visita finalizada`}
                            style={{ animationDelay: `${delay}ms` }}
                            className="size-6 animate-in rounded-[4px] border border-dashed border-muted-foreground/30 fade-in duration-300 ease-out fill-mode-backwards"
                          />
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        {SEMAFORO_OPCIONES.map((opt) => (
          <span key={opt} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-[3px]', SEMAFORO_COLOR[opt])} />
            {opt}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] border border-dashed border-muted-foreground/30" />
          Sin visita finalizada
        </span>
      </div>
    </div>
  )
}
