import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth, type Rol } from '@/hooks/useAuth'

function FullScreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/**
 * Guarda rutas. Sin `roles` exige solo sesión activa.
 * Con `roles`, exige además que el rol del usuario esté en la lista.
 */
export function ProtectedRoute({ roles }: { roles?: Rol[] }) {
  const { session, rol, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && (!rol || !roles.includes(rol))) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
