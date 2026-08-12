import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getVisita,
  getRespuestas,
  upsertRespuesta,
  type Respuesta,
  type UpsertRespuestaInput,
} from '@/lib/queries/visitas'

/**
 * Estado de una visita en progreso: la visita + sus respuestas, más la mutación
 * de autosave (upsert por indicador). El debounce lo aplica quien la consume
 * (cada IndicadorItem), para no perder trabajo si se cierra la pestaña.
 */
export function useVisita(visitaId?: string) {
  const queryClient = useQueryClient()
  const enabled = !!visitaId

  const visitaQuery = useQuery({
    queryKey: ['visita', visitaId],
    queryFn: () => getVisita(visitaId!),
    enabled,
  })

  const respuestasQuery = useQuery({
    queryKey: ['respuestas', visitaId],
    queryFn: () => getRespuestas(visitaId!),
    enabled,
  })

  const guardarRespuesta = useMutation({
    mutationFn: (input: UpsertRespuestaInput) => upsertRespuesta(input),
    onSuccess: (row) => {
      queryClient.setQueryData<Respuesta[]>(
        ['respuestas', visitaId],
        (old = []) => {
          const idx = old.findIndex((r) => r.indicador_id === row.indicador_id)
          if (idx >= 0) {
            const copy = [...old]
            copy[idx] = row
            return copy
          }
          return [...old, row]
        },
      )
    },
  })

  return {
    visita: visitaQuery.data,
    respuestas: respuestasQuery.data ?? [],
    isLoading: visitaQuery.isLoading || respuestasQuery.isLoading,
    isError: visitaQuery.isError || respuestasQuery.isError,
    refetchVisita: visitaQuery.refetch,
    guardarRespuesta,
  }
}
