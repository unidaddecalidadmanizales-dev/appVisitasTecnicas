import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function Evaluaciones() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Evaluaciones</h1>
        <p className="text-muted-foreground">
          Evaluación que hace la institución sobre la asistencia técnica
          recibida.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Star className="size-6" />
          </div>
          <p className="font-medium">Próximamente</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Aquí se podrán consultar las evaluaciones que cada institución
            realice sobre las asesorías técnicas recibidas. Esta sección
            está pendiente para una próxima actualización.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
