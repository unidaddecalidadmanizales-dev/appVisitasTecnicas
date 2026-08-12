import { useNavigate } from 'react-router-dom'
import { FormularioNuevaPassword } from '@/components/auth/FormularioNuevaPassword'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function CambiarPasswordObligatorio() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-brand-teal/15 via-background to-primary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crea tu contraseña</CardTitle>
          <CardDescription>
            Es tu primer ingreso al sistema. Antes de continuar, define una
            contraseña nueva que solo tú conozcas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioNuevaPassword
            submitLabel="Continuar"
            onSuccess={() => navigate('/', { replace: true })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
