import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const schema = z.object({ email: z.string().email('Correo inválido') })
type Values = z.infer<typeof schema>

export default function RecuperarPassword() {
  const [submitting, setSubmitting] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (values: Values) => {
    setSubmitting(true)
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/restablecer-password`,
    })
    setSubmitting(false)
    // Siempre mostramos el mismo mensaje exista o no ese correo, para no
    // revelar qué correos están registrados en el sistema.
    setEnviado(true)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-brand-teal/15 via-background to-primary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
          <CardDescription>
            Te enviaremos un enlace para restablecerla.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {enviado ? (
            <p className="text-sm text-muted-foreground">
              Si el correo está registrado en el sistema, te llegará un enlace
              para restablecer tu contraseña. Revisa también la carpeta de
              spam.
            </p>
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Enviar enlace
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Volver a iniciar sesión
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
