import { useQuery } from '@tanstack/react-query'
import {
  getProceso,
  getIndicadores,
  getCamposExtra,
} from '@/lib/queries/procesos'

/**
 * Carga un proceso con sus indicadores y campos extra. Es la base del wizard
 * genérico: el formulario se arma con este catálogo, no con componentes fijos.
 */
export function useProceso(procesoId?: string) {
  const enabled = !!procesoId

  const procesoQuery = useQuery({
    queryKey: ['proceso', procesoId],
    queryFn: () => getProceso(procesoId!),
    enabled,
  })

  const indicadoresQuery = useQuery({
    queryKey: ['indicadores', procesoId],
    queryFn: () => getIndicadores(procesoId!),
    enabled,
  })

  const camposExtraQuery = useQuery({
    queryKey: ['campos-extra', procesoId],
    queryFn: () => getCamposExtra(procesoId!),
    enabled,
  })

  return {
    proceso: procesoQuery.data,
    indicadores: indicadoresQuery.data ?? [],
    camposExtra: camposExtraQuery.data ?? [],
    isLoading:
      procesoQuery.isLoading ||
      indicadoresQuery.isLoading ||
      camposExtraQuery.isLoading,
    isError:
      procesoQuery.isError ||
      indicadoresQuery.isError ||
      camposExtraQuery.isError,
  }
}
