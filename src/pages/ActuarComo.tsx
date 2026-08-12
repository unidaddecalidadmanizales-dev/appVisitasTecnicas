import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Loader2, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import {
  generarLinkImpersonacion,
  getProfesionales,
} from '@/lib/queries/profesionales'
import { iniciarImpersonacion } from '@/lib/impersonacion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function ActuarComo() {
  const navigate = useNavigate()
  const { data: profesionales = [], isLoading } = useQuery({
    queryKey: ['profesionales'],
    queryFn: getProfesionales,
  })

  const actuar = useMutation({
    mutationFn: generarLinkImpersonacion,
    onSuccess: async ({ hashed_token, profesionalNombre }) => {
      await iniciarImpersonacion(hashed_token, profesionalNombre)
      toast.success(`Ahora estás actuando como ${profesionalNombre}`)
      navigate('/mis-visitas', { replace: true })
    },
    onError: (e: Error) =>
      toast.error('No se pudo entrar a esa cuenta', { description: e.message }),
  })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Actuar como</h1>
        <p className="text-muted-foreground">
          Entra a la cuenta real de un profesional o coordinador para ver y
          hacer exactamente lo mismo que ve y hace esa persona.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profesionales.map((p) => (
                <TableRow key={p.id} className="hover:bg-primary/5">
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    <Badge variant={p.rol === 'coordinador' ? 'default' : 'secondary'}>
                      {p.rol === 'coordinador' ? 'Coordinador' : 'Profesional'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => actuar.mutate(p.id)}
                      disabled={actuar.isPending}
                    >
                      {actuar.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserCog className="size-4" />
                      )}
                      Actuar como
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
