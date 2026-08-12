import { useParams } from 'react-router-dom'
import { VisitaWizard } from '@/components/visitas/VisitaWizard'

export default function VisitaDetalle() {
  const { id } = useParams<{ id: string }>()

  if (!id) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Visita</h1>
      </div>
      <VisitaWizard visitaId={id} />
    </div>
  )
}
