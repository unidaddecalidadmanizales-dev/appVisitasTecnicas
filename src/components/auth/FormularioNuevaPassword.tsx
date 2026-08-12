import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const passwordSchema = z
  .object({
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  })
type PasswordValues = z.infer<typeof passwordSchema>

interface Props {
  submitLabel?: string
  onSuccess: () => void | Promise<void>
}

/**
 * Además de `auth.updateUser`, marca `debe_cambiar_password = false` en la
 * fila del profesional vía RPC — necesario porque un `profesional` no tiene
 * permiso de UPDATE directo sobre su propia fila (ver migración
 * agregar_forzar_cambio_password).
 */
export function FormularioNuevaPassword({ submitLabel = 'Actualizar contraseña', onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = async (values: PasswordValues) => {
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: values.password })
    if (error) {
      setSubmitting(false)
      toast.error('No se pudo actualizar la contraseña', {
        description: error.message,
      })
      return
    }

    const { error: rpcError } = await supabase.rpc('marcar_password_cambiada')
    setSubmitting(false)
    if (rpcError) {
      toast.error('La contraseña se actualizó, pero hubo un problema', {
        description: rpcError.message,
      })
      return
    }

    toast.success('Contraseña actualizada')
    form.reset()
    await onSuccess()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nueva contraseña</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">
            {form.formState.errors.password.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmar contraseña</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          {...form.register('confirm')}
        />
        {form.formState.errors.confirm && (
          <p className="text-sm text-destructive">
            {form.formState.errors.confirm.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  )
}
