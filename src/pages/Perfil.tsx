import { useRef, useState } from 'react'
import { AlertTriangle, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import {
  actualizarMiFirma,
  subirFirmaProfesional,
} from '@/lib/queries/profesionales'
import { FormularioNuevaPassword } from '@/components/auth/FormularioNuevaPassword'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function FirmaDigitalCard() {
  const { profesional, refetchProfesional } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  const onFileSelected = async (file: File | undefined) => {
    if (!file || !profesional) return
    setSubiendo(true)
    try {
      const url = await subirFirmaProfesional(profesional.id, file)
      await actualizarMiFirma(url)
      await refetchProfesional()
      toast.success('Firma actualizada')
    } catch (e) {
      toast.error('No se pudo subir la firma', {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Firma digital</CardTitle>
        <CardDescription>
          Esta imagen se usa como tu firma en todos los informes de visita
          que generes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {profesional?.firma_url ? (
          <img
            src={profesional.firma_url}
            alt="Tu firma"
            className="h-32 w-full max-w-xs rounded-lg border bg-white object-contain p-2"
          />
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              No tienes una firma digital configurada todavía. La necesitas
              para poder finalizar tus visitas — sube una imagen a
              continuación.
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFileSelected(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          disabled={subiendo}
          onClick={() => inputRef.current?.click()}
        >
          {subiendo ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {profesional?.firma_url ? 'Reemplazar firma' : 'Subir firma'}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function Perfil() {
  const { profesional, rol, user } = useAuth()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground">Datos de tu cuenta.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Nombre</p>
            <p className="font-medium">{profesional?.nombre ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rol</p>
            <p className="font-medium capitalize">{rol ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Correo</p>
            <p className="font-medium">{profesional?.email ?? user?.email ?? '—'}</p>
          </div>
        </CardContent>
      </Card>

      <FirmaDigitalCard />

      <Card>
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>Debe tener al menos 6 caracteres.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioNuevaPassword onSuccess={() => {}} />
        </CardContent>
      </Card>
    </div>
  )
}
