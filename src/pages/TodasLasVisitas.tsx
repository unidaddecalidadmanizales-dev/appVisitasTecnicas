import { VisitasList } from '@/components/dashboard/VisitasList'

export default function TodasLasVisitas() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Todas las visitas</h1>
        <p className="text-muted-foreground">
          Visitas de todos los profesionales, con filtros por proceso y profesional.
        </p>
      </div>

      <VisitasList modo="todas" />
    </div>
  )
}
