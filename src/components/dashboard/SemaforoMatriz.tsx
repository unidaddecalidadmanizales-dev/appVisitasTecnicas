import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Institucion } from '@/lib/queries/instituciones'
import type { Proceso } from '@/lib/queries/procesos'
import { SEMAFORO_BANDAS_BAJAS, SEMAFORO_OPCIONES } from '@/lib/constants'
import type { CeldaSemaforo } from '@/lib/semaforo'
import {
  SEMAFORO_COLOR,
  SEMAFORO_SHADOW,
} from '@/components/visitas/ResultadoSemaforo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

type Orden = 'nombre' | 'riesgo' | 'cobertura' | 'vencidas'
type FiltroSector = 'todos' | 'Oficial' | 'No oficial'

const ETIQUETA_ORDEN: Record<Orden, string> = {
  nombre: 'Nombre (A–Z)',
  riesgo: 'Más resultados bajos',
  cobertura: 'Menor cobertura',
  vencidas: 'Más desactualizadas',
}

interface Props {
  instituciones: Institucion[]
  procesos: Proceso[]
  celdas: Map<string, CeldaSemaforo>
}

/**
 * Matriz institución × proceso. Con 112 instituciones y 18 procesos son más de
 * 2000 celdas, así que la tabla por sí sola no responde ninguna pregunta: lo
 * que la hace útil es poder reducirla (buscador, sector, ocultar sin datos),
 * reordenarla por criticidad, y leer los totales por fila y por columna sin
 * tener que contar sellos a ojo.
 */
export function SemaforoMatriz({ instituciones, procesos, celdas }: Props) {
  const [texto, setTexto] = useState('')
  const [sector, setSector] = useState<FiltroSector>('todos')
  const [soloConDatos, setSoloConDatos] = useState(false)
  const [orden, setOrden] = useState<Orden>('nombre')

  // Resumen por institución: alimenta las dos columnas de la derecha y también
  // los criterios de ordenamiento, así que se calcula una sola vez.
  const resumenFilas = useMemo(() => {
    const mapa = new Map(
      instituciones.map((inst) => {
        let evaluados = 0
        let bajos = 0
        let vencidas = 0
        for (const proceso of procesos) {
          const celda = celdas.get(`${inst.id}|${proceso.id}`)
          if (!celda) continue
          evaluados++
          if (SEMAFORO_BANDAS_BAJAS.includes(celda.resultado)) bajos++
          if (celda.vencida) vencidas++
        }
        return [inst.id, { evaluados, bajos, vencidas }] as const
      }),
    )
    return mapa
  }, [instituciones, procesos, celdas])

  // Resumen por proceso: se muestra bajo la abreviatura, en el encabezado fijo,
  // para que al desplazarse siga visible qué procesos están peor en conjunto.
  const resumenColumnas = useMemo(
    () =>
      new Map(
        procesos.map((proceso) => {
          let evaluados = 0
          let bajos = 0
          for (const inst of instituciones) {
            const celda = celdas.get(`${inst.id}|${proceso.id}`)
            if (!celda) continue
            evaluados++
            if (SEMAFORO_BANDAS_BAJAS.includes(celda.resultado)) bajos++
          }
          return [proceso.id, { evaluados, bajos }] as const
        }),
      ),
    [instituciones, procesos, celdas],
  )

  const filas = useMemo(() => {
    const busqueda = texto.trim().toLowerCase()
    const filtradas = instituciones.filter((inst) => {
      if (busqueda && !inst.nombre.toLowerCase().includes(busqueda)) return false
      if (sector !== 'todos' && inst.sector !== sector) return false
      if (soloConDatos && (resumenFilas.get(inst.id)?.evaluados ?? 0) === 0)
        return false
      return true
    })

    const porNombre = (a: Institucion, b: Institucion) =>
      a.nombre.localeCompare(b.nombre, 'es')

    return [...filtradas].sort((a, b) => {
      const ra = resumenFilas.get(a.id)!
      const rb = resumenFilas.get(b.id)!
      if (orden === 'riesgo') return rb.bajos - ra.bajos || porNombre(a, b)
      if (orden === 'cobertura')
        return ra.evaluados - rb.evaluados || porNombre(a, b)
      if (orden === 'vencidas') return rb.vencidas - ra.vencidas || porNombre(a, b)
      return porNombre(a, b)
    })
  }, [instituciones, texto, sector, soloConDatos, orden, resumenFilas])

  const hayFiltros = texto !== '' || sector !== 'todos' || soloConDatos

  if (instituciones.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay instituciones registradas todavía.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar institución…"
            className="pl-8"
            aria-label="Buscar institución"
          />
        </div>

        <Select
          value={sector}
          onValueChange={(v) => setSector(v as FiltroSector)}
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

        <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
          <SelectTrigger className="w-52" aria-label="Ordenar instituciones">
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
          variant={soloConDatos ? 'default' : 'outline'}
          onClick={() => setSoloConDatos((v) => !v)}
          aria-pressed={soloConDatos}
        >
          Solo con datos
        </Button>

        {hayFiltros && (
          <Button
            variant="ghost"
            onClick={() => {
              setTexto('')
              setSector('todos')
              setSoloConDatos(false)
            }}
          >
            <X className="size-4" />
            Limpiar
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Mostrando <strong className="text-foreground">{filas.length}</strong> de{' '}
        {instituciones.length} instituciones
      </p>

      {filas.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-muted-foreground">
          Ninguna institución coincide con estos filtros.
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          {/* Alto acotado a propósito: con el contenedor haciendo el scroll en
              ambos ejes, el encabezado de procesos y la columna de nombres
              quedan fijos y la matriz nunca se lee "a ciegas". */}
          <div className="max-h-[70vh] overflow-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-56 border-b border-r bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Institución
                  </th>
                  {procesos.map((proceso) => {
                    const resumen = resumenColumnas.get(proceso.id)!
                    return (
                      <th
                        key={proceso.id}
                        title={`${proceso.nombre}\n${resumen.evaluados} evaluadas · ${resumen.bajos} en bandas bajas`}
                        className="sticky top-0 z-20 w-14 border-b border-r bg-background px-1 py-2 align-top last:border-r-0"
                      >
                        <span className="block text-[11px] font-semibold tracking-tight">
                          {proceso.abreviatura ?? proceso.nombre.slice(0, 4)}
                        </span>
                        <span
                          className={cn(
                            'mt-0.5 block text-[11px] tabular-nums',
                            resumen.bajos > 0
                              ? 'font-semibold text-foreground'
                              : 'text-muted-foreground/60',
                          )}
                        >
                          {resumen.bajos}
                        </span>
                      </th>
                    )
                  })}
                  <th className="sticky top-0 z-20 border-b border-l bg-background px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">
                    Cobertura
                  </th>
                  <th className="sticky top-0 z-20 border-b bg-background px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">
                    Bajos
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((inst) => {
                  const resumen = resumenFilas.get(inst.id)!
                  return (
                    <tr key={inst.id} className="group hover:bg-primary/5">
                      <td className="sticky left-0 z-10 border-r border-b bg-background px-3 py-2 group-even:bg-muted/30 group-hover:bg-primary/5">
                        <span className="block font-medium leading-tight">
                          {inst.nombre}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {inst.sector ?? 'Sin sector'}
                        </span>
                      </td>

                      {procesos.map((proceso) => {
                        const celda = celdas.get(`${inst.id}|${proceso.id}`)
                        return (
                          <td
                            key={proceso.id}
                            className="border-r border-b p-0 text-center last:border-r-0"
                          >
                            <div className="flex h-12 items-center justify-center">
                              {celda ? (
                                <span
                                  title={
                                    `${proceso.nombre}\n${celda.resultado} · ${formatearFecha(celda.fecha)}` +
                                    (celda.vencida
                                      ? '\nDesactualizada (más de un año)'
                                      : '')
                                  }
                                  className={cn(
                                    'size-6 cursor-default rounded-[3px] transition-transform duration-200 hover:scale-125',
                                    SEMAFORO_COLOR[celda.resultado],
                                    SEMAFORO_SHADOW[celda.resultado],
                                    // Se atenúa en vez de cambiar de color: el
                                    // hue sigue diciendo el nivel de madurez, y
                                    // lo que se apaga es la confianza en el dato.
                                    celda.vencida && 'opacity-35 shadow-none',
                                  )}
                                />
                              ) : (
                                <span
                                  title={`${proceso.nombre}: sin visita finalizada`}
                                  className="size-6 rounded-[3px] border border-dashed border-muted-foreground/30"
                                />
                              )}
                            </div>
                          </td>
                        )
                      })}

                      <td className="border-b border-l px-3 py-2 text-right tabular-nums">
                        <span
                          className={
                            resumen.evaluados === 0
                              ? 'text-muted-foreground/60'
                              : 'font-medium'
                          }
                        >
                          {resumen.evaluados}
                        </span>
                        <span className="text-muted-foreground">
                          /{procesos.length}
                        </span>
                      </td>
                      <td className="border-b px-3 py-2 text-right tabular-nums">
                        {resumen.bajos > 0 ? (
                          <span className="font-semibold">{resumen.bajos}</span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          {SEMAFORO_OPCIONES.map((opt) => (
            <span key={opt} className="flex items-center gap-1.5">
              <span
                className={cn('size-2.5 rounded-[3px]', SEMAFORO_COLOR[opt])}
              />
              {opt}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-dashed border-muted-foreground/30" />
            Sin visita finalizada
          </span>
        </div>
        <p className="text-xs text-muted-foreground/80">
          Los sellos atenuados son evaluaciones de hace más de un año. El número
          bajo cada sigla es cuántas instituciones tienen ese proceso en
          Existencia o Pertinencia.
        </p>
      </div>
    </div>
  )
}
