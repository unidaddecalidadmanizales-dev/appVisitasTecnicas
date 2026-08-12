import type { Indicador } from '@/lib/queries/procesos'
import type { Respuesta } from '@/lib/queries/visitas'
import type { Calificacion } from '@/lib/constants'
import { IndicadorItem } from './IndicadorItem'

interface Props {
  area: string
  indicadores: Indicador[]
  respuestasPorIndicador: Map<string, Respuesta>
  disabled?: boolean
  onGuardar: (input: {
    indicador_id: string
    calificacion: Calificacion
    observacion: string | null
  }) => void
}

export function AreaSection({
  area,
  indicadores,
  respuestasPorIndicador,
  disabled,
  onGuardar,
}: Props) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {area}
      </h3>
      <div className="space-y-3">
        {indicadores.map((indicador) => (
          <IndicadorItem
            key={indicador.id}
            indicador={indicador}
            respuesta={respuestasPorIndicador.get(indicador.id)}
            disabled={disabled}
            onGuardar={onGuardar}
          />
        ))}
      </div>
    </section>
  )
}
