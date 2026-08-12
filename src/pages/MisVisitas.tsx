import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VisitasList } from '@/components/dashboard/VisitasList'

export default function MisVisitas() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Mis visitas
          </h1>
          <p className="text-muted-foreground">
            Visitas asignadas, pendientes y borradores.
          </p>
        </div>
        <Button asChild>
          <Link to="/visitas/nueva">
            <Plus className="size-4" />
            Nueva visita
          </Link>
        </Button>
      </div>

      <VisitasList modo="propias" />
    </div>
  )
}
