import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import logoManizales from '@/assets/logo-manizales-completo.png'
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

const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})
type LoginValues = z.infer<typeof loginSchema>

export default function Login() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/'

  const [submitting, setSubmitting] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  // Si ya hay sesión, no mostrar el login.
  if (!loading && session) {
    return <Navigate to={from} replace />
  }

  const onLogin = async (values: LoginValues) => {
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    setSubmitting(false)
    if (error) {
      toast.error('No se pudo iniciar sesión', { description: error.message })
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-linear-to-br from-brand-teal/15 via-background to-primary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="justify-items-center text-center">
          <img
            src={logoManizales}
            alt="Alcaldía de Manizales"
            className="mb-3 w-64"
          />
          <CardTitle className="text-xl">Sistema de visitas técnicas</CardTitle>
          <CardDescription>
            Unidad de Calidad · Secretaría de Educación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(onLogin)}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="login-email">Correo</Label>
              <Input
                id="login-email"
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
            <div className="space-y-2">
              <Label htmlFor="login-password">Contraseña</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
              <Link
                to="/recuperar-password"
                className="inline-block text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
