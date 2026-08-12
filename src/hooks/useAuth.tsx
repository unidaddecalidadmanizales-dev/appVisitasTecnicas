import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  estaImpersonando,
  limpiarImpersonacion,
  volverACuentaOriginal,
} from '@/lib/impersonacion'
import type { Tables } from '@/types/database.types'

/**
 * 'administrador' tiene los mismos permisos que 'coordinador' (is_coordinador()
 * en la base de datos cubre ambos), pero está pensado para una única cuenta
 * "por detrás" del sistema: se excluye de los listados de profesionales y de
 * cualquier reporte (ver getProfesionales()), y no es un rol asignable desde
 * la UI de alta/edición de profesionales.
 */
export type Rol = 'profesional' | 'coordinador' | 'administrador'
export type Profesional = Tables<'profesionales'>

interface AuthContextValue {
  session: Session | null
  user: User | null
  profesional: Profesional | null
  /** Rol efectivo del usuario: viene de la fila en `profesionales` (fuente de verdad). */
  rol: Rol | null
  /** true mientras se resuelve la sesión inicial o se carga la fila de `profesionales`. */
  loading: boolean
  signOut: () => Promise<void>
  /** Vuelve a cargar la fila de `profesionales` (p. ej. tras subir la firma). */
  refetchProfesional: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profesional, setProfesional] = useState<Profesional | null>(null)
  // Id de usuario al que corresponde `profesional` ya cargado. Comparar esto
  // contra `userId` (en vez de un booleano `profileLoading` aparte) evita una
  // condición de carrera: como los efectos corren después del render, hay un
  // render intermedio en el que `userId` ya cambió pero el efecto que carga
  // el perfil todavía no se ha ejecutado. Con un booleano separado ese render
  // reportaba `loading=false` con `rol=null` y `ProtectedRoute` redirigía al
  // usuario fuera de la ruta (reproducible recargando /instituciones,
  // /procesos, etc. — no solo en la carga inicial de la sesión).
  const [profesionalUserId, setProfesionalUserId] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  // 1) Resuelve la sesión inicial y se suscribe a cambios de auth.
  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setSessionLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // 2) Carga la fila de `profesionales` del usuario logueado (rol, nombre, ...).
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!userId) {
      setProfesional(null)
      setProfesionalUserId(null)
      return
    }

    let active = true
    supabase
      .from('profesionales')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProfesional(data)
        setProfesionalUserId(userId)
      })

    return () => {
      active = false
    }
  }, [userId])

  const signOut = async () => {
    // Si se está actuando como otro profesional, primero se vuelve a la cuenta
    // original. Dos razones: `signOut()` usa scope global, así que cerrar
    // sesión impersonando revocaría los tokens del profesional y lo sacaría de
    // sus propios dispositivos; y dejar el rastro de impersonación haría que al
    // volver a entrar apareciera el banner "estás actuando como…" siendo falso.
    if (estaImpersonando()) {
      try {
        await volverACuentaOriginal()
      } catch {
        limpiarImpersonacion()
      }
    }
    await supabase.auth.signOut()
  }

  const refetchProfesional = async () => {
    if (!userId) return
    const { data } = await supabase
      .from('profesionales')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfesional(data)
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profesional,
    rol: (profesional?.rol as Rol | undefined) ?? null,
    loading: sessionLoading || (!!userId && profesionalUserId !== userId),
    signOut,
    refetchProfesional,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
