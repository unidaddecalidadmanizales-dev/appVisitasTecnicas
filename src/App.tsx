import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import Login from '@/pages/Login'
import MisVisitas from '@/pages/MisVisitas'
import TodasLasVisitas from '@/pages/TodasLasVisitas'
import VisitaNueva from '@/pages/VisitaNueva'
import VisitaDetalle from '@/pages/VisitaDetalle'
import Semaforo from '@/pages/Semaforo'
import Instituciones from '@/pages/Instituciones'
import InstitucionDetalle from '@/pages/InstitucionDetalle'
import Procesos from '@/pages/Procesos'
import ProcesoDetalle from '@/pages/ProcesoDetalle'
import Profesionales from '@/pages/Profesionales'
import ActuarComo from '@/pages/ActuarComo'
import Evaluaciones from '@/pages/Evaluaciones'
import Perfil from '@/pages/Perfil'
import RecuperarPassword from '@/pages/RecuperarPassword'
import RestablecerPassword from '@/pages/RestablecerPassword'
import CambiarPasswordObligatorio from '@/pages/CambiarPasswordObligatorio'

/** `/` — redirige según el rol del usuario. */
function RootRedirect() {
  const { rol } = useAuth()
  if (rol === 'coordinador' || rol === 'administrador')
    return <Navigate to="/semaforo" replace />
  if (rol === 'profesional') return <Navigate to="/mis-visitas" replace />
  return (
    <div className="space-y-1">
      <h1 className="text-3xl font-bold tracking-tight">Sin rol asignado</h1>
      <p className="text-muted-foreground">
        Tu cuenta no tiene una fila en <span className="font-mono">profesionales</span>.
        Contacta al coordinador.
      </p>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar-password" element={<RecuperarPassword />} />

      {/* Requiere sesión, pero fuera del AppShell (sin sidebar): el enlace
          del correo de recuperación cae aquí, y el cambio obligatorio de
          contraseña en el primer ingreso también debe poder mostrarse antes
          de que el usuario pueda ver el resto de la app (ver el gate en
          AppShell). */}
      <Route element={<ProtectedRoute />}>
        <Route path="/restablecer-password" element={<RestablecerPassword />} />
        <Route
          path="/cambiar-password-obligatorio"
          element={<CambiarPasswordObligatorio />}
        />
        <Route element={<AppShell />}>
          <Route index element={<RootRedirect />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="visitas/:id" element={<VisitaDetalle />} />

          {/* Diligenciar visitas: la RLS de `visitas` solo exige
              profesional_id = auth.uid(), sin importar el rol, así que un
              coordinador también puede crear/completar sus propias visitas. */}
          <Route path="mis-visitas" element={<MisVisitas />} />
          <Route path="visitas/nueva" element={<VisitaNueva />} />

          {/* Coordinador y administrador (mismos permisos) */}
          <Route element={<ProtectedRoute roles={['coordinador', 'administrador']} />}>
            <Route path="visitas" element={<TodasLasVisitas />} />
            <Route path="semaforo" element={<Semaforo />} />
            <Route path="instituciones" element={<Instituciones />} />
            <Route path="instituciones/:id" element={<InstitucionDetalle />} />
            <Route path="procesos" element={<Procesos />} />
            <Route path="procesos/:id" element={<ProcesoDetalle />} />
            <Route path="profesionales" element={<Profesionales />} />
            <Route path="evaluaciones" element={<Evaluaciones />} />
          </Route>

          {/* Solo administrador: entrar a la cuenta real de otro profesional. */}
          <Route element={<ProtectedRoute roles={['administrador']} />}>
            <Route path="actuar-como" element={<ActuarComo />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
