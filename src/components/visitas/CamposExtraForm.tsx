import type { CampoExtra } from '@/lib/queries/procesos'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ValoresExtra = Record<string, string | number | boolean | null>

interface Props {
  campos: CampoExtra[]
  valores: ValoresExtra
  disabled?: boolean
  onChange: (valores: ValoresExtra) => void
}

/**
 * Renderiza `campos_extra_procesos` según su `tipo` (numero | texto | booleano)
 * y guarda los valores en un objeto que termina en `visitas.datos_adicionales`.
 * Si `campos` está vacío no renderiza nada — el componente no debe montarse
 * (Servicio social no tiene campos extra).
 */
export function CamposExtraForm({ campos, valores, disabled, onChange }: Props) {
  if (campos.length === 0) return null

  const set = (clave: string, valor: string | number | boolean | null) =>
    onChange({ ...valores, [clave]: valor })

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Datos adicionales
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((campo) => {
          const valor = valores[campo.clave_campo]
          if (campo.tipo === 'booleano') {
            return (
              <label
                key={campo.id}
                className="flex items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  className="size-4"
                  checked={valor === true}
                  disabled={disabled}
                  onChange={(e) => set(campo.clave_campo, e.target.checked)}
                />
                {campo.etiqueta}
              </label>
            )
          }
          return (
            <div key={campo.id} className="space-y-1.5">
              <Label htmlFor={campo.id}>{campo.etiqueta}</Label>
              <Input
                id={campo.id}
                type={campo.tipo === 'numero' ? 'number' : 'text'}
                value={valor === null || valor === undefined ? '' : String(valor)}
                disabled={disabled}
                onChange={(e) =>
                  set(
                    campo.clave_campo,
                    campo.tipo === 'numero'
                      ? e.target.value === ''
                        ? null
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
