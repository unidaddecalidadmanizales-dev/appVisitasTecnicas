import { useMemo, useState } from 'react'
import type { Institucion } from '@/lib/queries/instituciones'
import type { Proceso } from '@/lib/queries/procesos'
import type { CeldaSemaforo } from '@/lib/semaforo'
import type { Semaforo } from '@/lib/constants'

export type Orden = 'nombre' | 'menor-cobertura' | 'mayor-cobertura'
export type FiltroSector = 'todos' | 'Oficial' | 'No oficial'
export type FiltroValoracion = Semaforo | 'todas'

export const ETIQUETA_ORDEN: Record<Orden, string> = {
  nombre: 'Nombre (A–Z)',
  'menor-cobertura': 'Menor cobertura',
  'mayor-cobertura': 'Mayor cobertura',
}

interface Args {
  instituciones: Institucion[]
  procesos: Proceso[]
  celdas: Map<string, CeldaSemaforo>
}

/**
 * Estado de los filtros del semáforo y todo lo que se deriva de ellos.
 *
 * Vive en un hook y no dentro de la matriz porque la barra de valoración tiene
 * que describir exactamente lo que la matriz está mostrando: si las dos
 * calcularan por su cuenta, se irían separando en cuanto se agregue un filtro.
 */
export function useSemaforoFiltros({ instituciones, procesos, celdas }: Args) {
  const [texto, setTexto] = useState('')
  const [sector, setSector] = useState<FiltroSector>('todos')
  const [soloConDatos, setSoloConDatos] = useState(false)
  const [orden, setOrden] = useState<Orden>('nombre')
  const [valoracion, setValoracion] = useState<FiltroValoracion>('todas')

  const evaluadosPorInstitucion = useMemo(
    () =>
      new Map(
        instituciones.map((inst) => {
          let n = 0
          for (const proceso of procesos) {
            if (celdas.has(`${inst.id}|${proceso.id}`)) n++
          }
          return [inst.id, n] as const
        }),
      ),
    [instituciones, procesos, celdas],
  )

  // Con filtro de valoración activo cuenta solo esa valoración (el encabezado
  // responde "¿en cuántas instituciones tiene este proceso esa valoración?");
  // sin filtro, cuántas lo tienen evaluado.
  const conteoPorProceso = useMemo(
    () =>
      new Map(
        procesos.map((proceso) => {
          let n = 0
          for (const inst of instituciones) {
            const celda = celdas.get(`${inst.id}|${proceso.id}`)
            if (!celda) continue
            if (valoracion === 'todas' || celda.resultado === valoracion) n++
          }
          return [proceso.id, n] as const
        }),
      ),
    [instituciones, procesos, celdas, valoracion],
  )

  const columnas = useMemo(
    () =>
      valoracion === 'todas'
        ? procesos
        : procesos.filter((p) => (conteoPorProceso.get(p.id) ?? 0) > 0),
    [procesos, valoracion, conteoPorProceso],
  )

  const filas = useMemo(() => {
    const busqueda = texto.trim().toLowerCase()
    const filtradas = instituciones.filter((inst) => {
      if (busqueda && !inst.nombre.toLowerCase().includes(busqueda)) return false
      if (sector !== 'todos' && inst.sector !== sector) return false
      if (soloConDatos && (evaluadosPorInstitucion.get(inst.id) ?? 0) === 0)
        return false
      if (valoracion !== 'todas') {
        const tiene = procesos.some(
          (p) => celdas.get(`${inst.id}|${p.id}`)?.resultado === valoracion,
        )
        if (!tiene) return false
      }
      return true
    })

    const porNombre = (a: Institucion, b: Institucion) =>
      a.nombre.localeCompare(b.nombre, 'es')

    return [...filtradas].sort((a, b) => {
      const ea = evaluadosPorInstitucion.get(a.id)!
      const eb = evaluadosPorInstitucion.get(b.id)!
      if (orden === 'menor-cobertura') return ea - eb || porNombre(a, b)
      if (orden === 'mayor-cobertura') return eb - ea || porNombre(a, b)
      return porNombre(a, b)
    })
  }, [
    instituciones,
    procesos,
    celdas,
    texto,
    sector,
    soloConDatos,
    valoracion,
    orden,
    evaluadosPorInstitucion,
  ])

  /**
   * Celdas que quedan dentro de la matriz visible (filas × columnas). Incluye
   * las atenuadas por el filtro de valoración: siguen estando en pantalla, así
   * que la barra las cuenta. De lo contrario, filtrar por "Existencia" dejaría
   * la barra en un bloque rojo sólido, que no dice nada.
   */
  const conteosVisibles = useMemo(() => {
    const acumulado: Record<string, number> = {}
    let total = 0
    for (const inst of filas) {
      for (const proceso of columnas) {
        const celda = celdas.get(`${inst.id}|${proceso.id}`)
        if (!celda) continue
        acumulado[celda.resultado] = (acumulado[celda.resultado] ?? 0) + 1
        total++
      }
    }
    return { porNivel: acumulado, total }
  }, [filas, columnas, celdas])

  function limpiar() {
    setTexto('')
    setSector('todos')
    setSoloConDatos(false)
    setValoracion('todas')
  }

  return {
    texto,
    setTexto,
    sector,
    setSector,
    soloConDatos,
    setSoloConDatos,
    orden,
    setOrden,
    valoracion,
    setValoracion,
    hayFiltros:
      texto !== '' || sector !== 'todos' || soloConDatos || valoracion !== 'todas',
    limpiar,
    filas,
    columnas,
    evaluadosPorInstitucion,
    conteoPorProceso,
    conteosVisibles,
  }
}

export type SemaforoFiltros = ReturnType<typeof useSemaforoFiltros>
