import { Search, X } from 'lucide-react'
import { SEMAFORO_OPCIONES } from '@/lib/constants'
import {
  ETIQUETA_ORDEN,
  type FiltroSector,
  type FiltroValoracion,
  type Orden,
  type SemaforoFiltros,
} from '@/hooks/useSemaforoFiltros'
import { SEMAFORO_COLOR } from '@/components/visitas/ResultadoSemaforo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
  filtros: SemaforoFiltros
  anios: number[]
  anio: number | undefined
  onAnioChange: (anio: number | undefined) => void
  totalInstituciones: number
  totalProcesos: number
}

export function SemaforoControles({
  filtros,
  anios,
  anio,
  onAnioChange,
  totalInstituciones,
  totalProcesos,
}: Props) {
  return (
    <div className="space-y-3">
      {anios.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Año</span>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={anio === undefined ? 'default' : 'outline'}
              aria-pressed={anio === undefined}
              onClick={() => onAnioChange(undefined)}
              title="La asistencia técnica más reciente de cada institución y proceso, de cualquier año"
            >
              Todo
            </Button>
            {anios.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={anio === a ? 'default' : 'outline'}
                aria-pressed={anio === a}
                onClick={() => onAnioChange(a)}
                // Filtro estricto: solo asistencias hechas EN ese año, no un
                // acumulado — una institución sin asistencia ese año se ve
                // vacía, no arrastra el resultado de otro año.
                title={`Solo asistencias técnicas realizadas en ${a}`}
              >
                {a}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtros.texto}
            onChange={(e) => filtros.setTexto(e.target.value)}
            placeholder="Buscar institución…"
            className="pl-8"
            aria-label="Buscar institución"
          />
        </div>

        <Select
          value={filtros.sector}
          onValueChange={(v) => filtros.setSector(v as FiltroSector)}
        >
          <SelectTrigger className="w-40" aria-label="Filtrar por sector">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los sectores</SelectItem>
            <SelectItem value="Oficial">Oficial</SelectItem>
            <SelectItem value="No oficial">No oficial</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filtros.valoracion}
          onValueChange={(v) => filtros.setValoracion(v as FiltroValoracion)}
        >
          <SelectTrigger className="w-48" aria-label="Filtrar por valoración">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las valoraciones</SelectItem>
            {SEMAFORO_OPCIONES.map((nivel) => (
              <SelectItem key={nivel} value={nivel}>
                <span className="flex items-center gap-2">
                  <span
                    className={cn('size-2.5 rounded-[3px]', SEMAFORO_COLOR[nivel])}
                  />
                  {nivel}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filtros.orden}
          onValueChange={(v) => filtros.setOrden(v as Orden)}
        >
          <SelectTrigger className="w-48" aria-label="Ordenar instituciones">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(ETIQUETA_ORDEN) as Orden[]).map((o) => (
              <SelectItem key={o} value={o}>
                {ETIQUETA_ORDEN[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filtros.soloConDatos ? 'default' : 'outline'}
          onClick={() => filtros.setSoloConDatos(!filtros.soloConDatos)}
          aria-pressed={filtros.soloConDatos}
        >
          Solo con datos
        </Button>

        {filtros.hayFiltros && (
          <Button variant="ghost" onClick={filtros.limpiar}>
            <X className="size-4" />
            Limpiar
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Mostrando{' '}
        <strong className="text-foreground">{filtros.filas.length}</strong> de{' '}
        {totalInstituciones} instituciones
        {filtros.valoracion !== 'todas' && (
          <>
            {' '}
            y <strong className="text-foreground">
              {filtros.columnas.length}
            </strong>{' '}
            de {totalProcesos} procesos con valoración{' '}
            <strong className="text-foreground">{filtros.valoracion}</strong>
          </>
        )}
        {anio !== undefined && <> · asistencias técnicas de {anio}</>}
      </p>
    </div>
  )
}
