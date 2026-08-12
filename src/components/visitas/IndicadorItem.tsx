import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { Indicador } from '@/lib/queries/procesos'
import type { Respuesta } from '@/lib/queries/visitas'
import { CALIFICACIONES, type Calificacion } from '@/lib/constants'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface Props {
  indicador: Indicador
  respuesta?: Respuesta
  disabled?: boolean
  onGuardar: (input: {
    indicador_id: string
    calificacion: Calificacion
    observacion: string | null
  }) => void
}

export function IndicadorItem({
  indicador,
  respuesta,
  disabled,
  onGuardar,
}: Props) {
  const [calificacion, setCalificacion] = useState<Calificacion | ''>(
    (respuesta?.calificacion as Calificacion | undefined) ?? '',
  )
  const [observacion, setObservacion] = useState(respuesta?.observacion ?? '')
  const primeraCarga = useRef(true)

  function guardarAhora(cal: Calificacion, obs: string) {
    onGuardar({
      indicador_id: indicador.id,
      calificacion: cal,
      observacion: obs.trim() || null,
    })
  }

  // La calificación es una acción discreta (un clic): se guarda de inmediato,
  // sin esperar el debounce, para no perderla si se cierra la pestaña justo
  // después de elegirla.
  function onCambiarCalificacion(v: Calificacion | '') {
    setCalificacion(v)
    if (v) guardarAhora(v, observacion)
  }

  // La observación sí se debounce mientras se escribe (para no guardar en
  // cada tecla), pero se fuerza el guardado inmediato al salir del campo
  // (onBlur) por la misma razón de arriba.
  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false
      return
    }
    if (!calificacion) return
    const t = setTimeout(() => guardarAhora(calificacion, observacion), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observacion])

  const guardado = !!respuesta

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{indicador.aspecto}</p>
          <p className="text-sm text-muted-foreground">{indicador.criterio}</p>
        </div>
        {guardado && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-emerald-600">
            <Check className="size-3.5" /> Guardado
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Calificación</Label>
          <ToggleGroup
            type="single"
            spacing={1}
            value={calificacion}
            onValueChange={(v) => onCambiarCalificacion(v as Calificacion | '')}
            disabled={disabled}
            className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {CALIFICACIONES.map((c) => (
              <ToggleGroupItem
                key={c}
                value={c}
                className="h-auto w-full min-w-0 rounded-md border py-2 text-xs leading-snug whitespace-normal data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:font-semibold"
              >
                {c}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Observación</Label>
          <Textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            onBlur={() => calificacion && guardarAhora(calificacion, observacion)}
            placeholder="Opcional"
            disabled={disabled}
            rows={2}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
