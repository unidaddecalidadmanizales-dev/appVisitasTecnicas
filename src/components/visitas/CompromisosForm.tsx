import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface CompromisoDraft {
  /** Id estable (generado en cliente) para poder guardar avances sin duplicar filas. */
  id: string
  descripcion: string
  responsable: string
  fecha_verificacion: string
}

export function nuevoCompromiso(): CompromisoDraft {
  return {
    id: crypto.randomUUID(),
    descripcion: '',
    responsable: '',
    fecha_verificacion: '',
  }
}

interface Props {
  value: CompromisoDraft[]
  disabled?: boolean
  onChange: (rows: CompromisoDraft[]) => void
}

export function CompromisosForm({ value, disabled, onChange }: Props) {
  const update = (id: string, patch: Partial<CompromisoDraft>) => {
    onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  const remove = (id: string) => onChange(value.filter((row) => row.id !== id))
  const add = () => onChange([...value, nuevoCompromiso()])

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin compromisos. Agrega uno si corresponde.
        </p>
      )}

      {value.map((row, idx) => (
        <div key={row.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Compromiso {idx + 1}</span>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(row.id)}
                aria-label="Quitar compromiso"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Input
              value={row.descripcion}
              disabled={disabled}
              onChange={(e) => update(row.id, { descripcion: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Responsable</Label>
              <Input
                value={row.responsable}
                disabled={disabled}
                onChange={(e) => update(row.id, { responsable: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Fecha de verificación
              </Label>
              <Input
                type="date"
                value={row.fecha_verificacion}
                disabled={disabled}
                onChange={(e) =>
                  update(row.id, { fecha_verificacion: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      ))}

      {!disabled && (
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="size-4" />
          Agregar compromiso
        </Button>
      )}
    </div>
  )
}
