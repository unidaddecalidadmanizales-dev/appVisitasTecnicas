import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { getInstituciones } from '@/lib/queries/instituciones'
import { getProcesos } from '@/lib/queries/procesos'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface SeleccionVisita {
  institucion_id: string
  proceso_id: string
}

interface Props {
  onSeleccionar: (seleccion: SeleccionVisita) => void
  submitting?: boolean
}

/**
 * Cualquier profesional puede visitar cualquier institución en cualquier
 * proceso — no hay restricción de asignación, así que el selector es libre.
 */
export function SelectorInstitucionProceso({ onSeleccionar, submitting }: Props) {
  const { data: instituciones = [], isLoading: cargandoInst } = useQuery({
    queryKey: ['instituciones'],
    queryFn: getInstituciones,
  })
  const { data: procesos = [], isLoading: cargandoProc } = useQuery({
    queryKey: ['procesos'],
    queryFn: getProcesos,
  })
  const [sector, setSector] = useState<'todas' | 'oficial' | 'no-oficial'>(
    'todas',
  )
  const [institucionId, setInstitucionId] = useState('')
  const [procesoId, setProcesoId] = useState('')

  const isLoading = cargandoInst || cargandoProc

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    )
  }

  if (instituciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay instituciones registradas todavía. Contacta al coordinador.
      </p>
    )
  }

  const institucionesFiltradas = instituciones.filter((i) => {
    if (sector === 'todas') return true
    const esOficial = i.sector === 'Oficial'
    return sector === 'oficial' ? esOficial : !esOficial
  })

  const completo = institucionId && procesoId

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Sector</Label>
        <Select
          value={sector}
          onValueChange={(v) => {
            setSector(v as typeof sector)
            setInstitucionId('')
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="oficial">Oficiales</SelectItem>
            <SelectItem value="no-oficial">No oficiales</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Institución</Label>
        <Select value={institucionId} onValueChange={setInstitucionId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona…" />
          </SelectTrigger>
          <SelectContent>
            {institucionesFiltradas.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Sin instituciones en este sector.
              </div>
            ) : (
              institucionesFiltradas.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.nombre}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Proceso</Label>
        <Select value={procesoId} onValueChange={setProcesoId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona…" />
          </SelectTrigger>
          <SelectContent>
            {procesos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        disabled={!completo || submitting}
        onClick={() =>
          completo &&
          onSeleccionar({ institucion_id: institucionId, proceso_id: procesoId })
        }
      >
        {submitting && <Loader2 className="size-4 animate-spin" />}
        Continuar
      </Button>
    </div>
  )
}
