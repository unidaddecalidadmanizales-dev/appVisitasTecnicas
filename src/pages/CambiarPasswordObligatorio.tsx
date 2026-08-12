import { useNavigate } from 'react-router-dom'
import { FormularioNuevaPassword } from '@/components/auth/FormularioNuevaPassword'
import { BannerImpersonacion } from '@/components/layout/BannerImpersonacion'
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
    <div className="flex min-h-svh flex-col bg-linear-to-br from-brand-teal/15 via-background to-primary/20">
      {/* Salida de emergencia: esta pantalla está fuera del AppShell, así que
          sin el banner quien llegara aquí actuando como otra persona no tendría
          cómo volver a su propia cuenta sin tocar una contraseña ajena. */}
      <BannerImpersonacion />
      <div className="flex flex-1 items-center justify-center p-4">
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
    </div>
  )
}
