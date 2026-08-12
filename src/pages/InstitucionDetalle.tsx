import { useParams } from 'react-router-dom'

export default function InstitucionDetalle() {
  const { id } = useParams()
  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">Institución</h1>
      <p className="text-muted-foreground">
        Historial de visitas por proceso y semáforo individual de{' '}
        <span className="font-mono">{id}</span>. (Fase posterior.)
      </p>
    </div>
  )
}
