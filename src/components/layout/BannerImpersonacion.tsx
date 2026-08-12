import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LogOut, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { nombreImpersonado, volverACuentaOriginal } from '@/lib/impersonacion'
import { Button } from '@/components/ui/button'

/**
 * Franja de aviso con la salida de la impersonación. Vive en su propio archivo
 * (y no dentro de AppShell) porque tiene que poder mostrarse también en las
 * pantallas que quedan fuera del shell — en particular la de cambio de
 * contraseña obligatorio, donde el administrador se quedaba sin forma de
 * volver a su cuenta.
 */
export function BannerImpersonacion() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState<string | null>(null)
  const [volviendo, setVolviendo] = useState(false)

  // Se re-revisa cada vez que cambia el usuario autenticado: eso ocurre
  // exactamente cuando arranca o termina una impersonación (verifyOtp/
  // setSession disparan onAuthStateChange), sin depender de un remount.
  useEffect(() => {
    setNombre(nombreImpersonado())
  }, [user?.id])

  if (!nombre) return null

  async function volver() {
    setVolviendo(true)
    try {
      await volverACuentaOriginal()
      // Se limpia aquí y no vía el efecto de arriba para no depender del orden
      // en que React procesa el cambio de sesión frente al borrado de las
      // claves: así el banner desaparece en cuanto la restauración funciona.
      setNombre(null)
      navigate('/semaforo', { replace: true })
    } catch (e) {
      // La sesión guardada sigue intacta, así que el banner permanece visible
      // y el botón se puede reintentar.
      toast.error('No se pudo volver a tu cuenta', {
        description: e instanceof Error ? e.message : undefined,
      })
    } finally {
      setVolviendo(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-300">
      <span className="flex items-center gap-2">
        <UserCog className="size-4 shrink-0" />
        Estás actuando como <strong>{nombre}</strong>
      </span>
      <Button size="sm" variant="outline" disabled={volviendo} onClick={volver}>
        {volviendo ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        Volver a mi cuenta
      </Button>
    </div>
  )
}
