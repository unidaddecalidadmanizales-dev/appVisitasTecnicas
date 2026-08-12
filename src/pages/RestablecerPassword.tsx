import { useNavigate } from 'react-router-dom'
import { FormularioNuevaPassword } from '@/components/auth/FormularioNuevaPassword'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Se llega aquí desde el enlace del correo de recuperación (Supabase ya
 * intercambió el token de la URL por una sesión antes de que React monte).
 */
export default function RestablecerPassword() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-brand-teal/15 via-background to-primary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>Elige tu nueva contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioNuevaPassword
            submitLabel="Guardar y continuar"
            onSuccess={() => navigate('/', { replace: true })}
          />
        </CardContent>
      </Card>
    </div>
  )
}
