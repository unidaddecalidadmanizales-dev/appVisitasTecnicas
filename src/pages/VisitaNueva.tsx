import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { crearVisita } from '@/lib/queries/visitas'
import {
  SelectorInstitucionProceso,
  type SeleccionVisita,
} from '@/components/visitas/SelectorInstitucionProceso'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function VisitaNueva() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const crear = useMutation({
    mutationFn: (seleccion: SeleccionVisita) =>
      crearVisita({
        institucion_id: seleccion.institucion_id,
        proceso_id: seleccion.proceso_id,
        profesional_id: user!.id,
        fecha: hoyISO(),
      }),
    onSuccess: (visita) => {
      navigate(`/visitas/${visita.id}`)
    },
    onError: (error: Error) => {
      toast.error('No se pudo crear la asistencia técnica', { description: error.message })
    },
  })

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Nueva asistencia técnica</h1>
        <p className="text-muted-foreground">
          Elige la institución y el proceso. La visita se crea como borrador y
          podrás completar los datos en los siguientes pasos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Institución y proceso</CardTitle>
        </CardHeader>
        <CardContent>
          <SelectorInstitucionProceso
            submitting={crear.isPending}
            onSeleccionar={(seleccion) => crear.mutate(seleccion)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
