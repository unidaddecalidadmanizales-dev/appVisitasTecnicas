import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ClipboardList,
  ClipboardCheck,
  FilePlus2,
  LayoutGrid,
  Building2,
  ListChecks,
  Star,
  Users,
  UserCircle,
  UserCog,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useAuth, type Rol } from '@/hooks/useAuth'
import { estaImpersonando } from '@/lib/impersonacion'
import { BannerImpersonacion } from '@/components/layout/BannerImpersonacion'
import { cn } from '@/lib/utils'
import escudoManizales from '@/assets/escudo-manizales.png'
import { Button } from '@/components/ui/button'
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: Rol[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/visitas', label: 'Todas las visitas', icon: ClipboardCheck, roles: ['coordinador', 'administrador'] },
  { to: '/mis-visitas', label: 'Mis visitas', icon: ClipboardList, roles: ['profesional', 'coordinador', 'administrador'] },
  { to: '/visitas/nueva', label: 'Nueva visita', icon: FilePlus2, roles: ['profesional', 'coordinador', 'administrador'] },
  { to: '/semaforo', label: 'Semáforo', icon: LayoutGrid, roles: ['coordinador', 'administrador'] },
  { to: '/instituciones', label: 'Instituciones', icon: Building2, roles: ['coordinador', 'administrador'] },
  { to: '/procesos', label: 'Procesos', icon: ListChecks, roles: ['coordinador', 'administrador'] },
  { to: '/profesionales', label: 'Profesionales', icon: Users, roles: ['coordinador', 'administrador'] },
  { to: '/evaluaciones', label: 'Evaluaciones', icon: Star, roles: ['coordinador', 'administrador'] },
  { to: '/actuar-como', label: 'Actuar como', icon: UserCog, roles: ['administrador'] },
  { to: '/perfil', label: 'Perfil', icon: UserCircle, roles: ['profesional', 'coordinador', 'administrador'] },
]

function iniciales(nombre?: string | null) {
  if (!nombre) return '?'
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { rol } = useAuth()
  const items = NAV_ITEMS.filter((item) => rol && item.roles.includes(rol))

  return (
    <div className="flex h-full flex-col gap-1">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
          <img
            src={escudoManizales}
            alt="Escudo de la Alcaldía de Manizales"
            className="h-8 w-auto"
          />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Visitas técnicas</p>
          <p className="text-xs font-medium text-primary">Unidad de Calidad</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-2 py-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'border-l-primary bg-primary/12 text-primary shadow-sm'
                  : 'border-l-transparent text-muted-foreground hover:border-l-primary/40 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function UserMenu() {
  const { profesional, rol, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-2">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {iniciales(profesional?.nombre)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium leading-tight">
              {profesional?.nombre ?? 'Usuario'}
            </span>
            <span className="block text-xs capitalize text-muted-foreground">
              {rol ?? ''}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate">
          {profesional?.email ?? ''}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/perfil')}>
          <UserCircle className="size-4" />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSignOut} variant="destructive">
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profesional, rol } = useAuth()

  // Primer ingreso con contraseña puesta por el coordinador: no se puede ver
  // el resto de la app hasta definir una contraseña propia.
  //
  // Se omite al actuar como otro profesional, por dos razones: el
  // administrador no debe definir la contraseña de otra persona (es de esa
  // persona, no suya), y esa pantalla vive fuera del AppShell, así que
  // redirigir allí dejaba al administrador sin el banner para volver a su
  // propia cuenta — atrapado, con la única salida de cerrar sesión.
  if (profesional?.debe_cambiar_password && !estaImpersonando()) {
    return <Navigate to="/cambiar-password-obligatorio" replace />
  }

  // La cuenta administrador no genera visitas reales, no necesita firma.
  const faltaFirma = rol !== 'administrador' && !profesional?.firma_url

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Acento de marca: franja superior terracota → teal, siempre visible. */}
      <div className="h-[3px] shrink-0 bg-linear-to-r from-primary via-primary to-brand-teal" />
      <BannerImpersonacion />

      <div className="flex min-h-0 flex-1">
      {/* Sidebar fijo en desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <div className="sticky top-0 h-svh">
          <SidebarContent />
        </div>
      </aside>

      {/* Drawer móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r bg-sidebar">
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex-1" />
          <UserMenu />
        </header>

        <main className="flex-1 p-4 md:p-6">
          {faltaFirma && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                No tienes una firma digital configurada. La necesitas para
                poder finalizar tus visitas —{' '}
                <Link to="/perfil" className="font-medium underline underline-offset-2">
                  configúrala en tu Perfil
                </Link>
                .
              </p>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  )
}
