import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Loader2, Pencil, Search, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { eliminarVisita, getMisVisitas } from '@/lib/queries/visitas'
import { useAuth } from '@/hooks/useAuth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

interface VisitasListProps {
  /** 'propias' (default): solo las visitas del usuario logueado. 'todas':
   * todas las visitas visibles por RLS, con filtro adicional por
   * profesional — pensado para el panel de coordinador/administrador. */
  modo?: 'propias' | 'todas'
}

export function VisitasList({ modo = 'propias' }: VisitasListProps) {
  const { rol, profesional } = useAuth()
  const puedeEliminarFinalizadas = rol === 'coordinador' || rol === 'administrador'
  const mostrarTodas = modo === 'todas' && puedeEliminarFinalizadas
  const queryClient = useQueryClient()
  const { data: todasLasVisitas = [], isLoading } = useQuery({
    queryKey: ['mis-visitas'],
    queryFn: getMisVisitas,
  })

  const visitas = useMemo(() => {
    // "Todas las visitas" es la vista de coordinación: los borradores son
    // trabajo en curso de cada profesional, no informes listos para revisar.
    if (mostrarTodas) return todasLasVisitas.filter((v) => v.estado === 'finalizado')
    return todasLasVisitas.filter((v) => v.profesional_id === profesional?.id)
  }, [todasLasVisitas, mostrarTodas, profesional?.id])

  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState<'todas' | 'borrador' | 'finalizado'>('todas')
  const [procesoId, setProcesoId] = useState('todos')
  const [profesionalId, setProfesionalId] = useState('todos')

  const procesos = useMemo(() => {
    const vistos = new Map<string, string>()
    for (const v of visitas) vistos.set(v.proceso_id, v.procesos.nombre)
    return Array.from(vistos, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    )
  }, [visitas])

  const profesionales = useMemo(() => {
    const vistos = new Map<string, string>()
    for (const v of visitas) vistos.set(v.profesional_id, v.profesionales.nombre)
    return Array.from(vistos, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    )
  }, [visitas])

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return visitas.filter((v) => {
      if (estado !== 'todas' && v.estado !== estado) return false
      if (procesoId !== 'todos' && v.proceso_id !== procesoId) return false
      if (mostrarTodas && profesionalId !== 'todos' && v.profesional_id !== profesionalId)
        return false
      if (
        texto &&
        !v.instituciones.nombre.toLowerCase().includes(texto) &&
        !v.procesos.nombre.toLowerCase().includes(texto) &&
        !v.profesionales.nombre.toLowerCase().includes(texto)
      )
        return false
      return true
    })
  }, [visitas, busqueda, estado, procesoId, profesionalId, mostrarTodas])

  const eliminar = useMutation({
    mutationFn: eliminarVisita,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mis-visitas'] })
      toast.success('Visita eliminada')
    },
    onError: (e: Error) =>
      toast.error('No se pudo eliminar', { description: e.message }),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando visitas…
      </div>
    )
  }

  if (visitas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {mostrarTodas
          ? 'Todavía no hay visitas registradas.'
          : 'No tienes visitas todavía. Crea una desde "Nueva visita".'}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={
              mostrarTodas
                ? 'Buscar por institución, proceso o profesional…'
                : 'Buscar por institución o proceso…'
            }
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        {!mostrarTodas && (
          <Select value={estado} onValueChange={(v) => setEstado(v as typeof estado)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="finalizado">Finalizada</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={procesoId} onValueChange={setProcesoId}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los procesos</SelectItem>
            {procesos.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mostrarTodas && (
          <Select value={profesionalId} onValueChange={setProfesionalId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los profesionales</SelectItem>
              {profesionales.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ninguna visita coincide con el filtro.
        </p>
      ) : (
        <div className="space-y-3">
          {filtradas.map((v) => {
        const finalizada = v.estado === 'finalizado'
        return (
          <Card
            key={v.id}
            className={cn(
              'border-l-4 transition-colors',
              finalizada
                ? 'border-l-brand-teal bg-brand-teal/[0.03]'
                : 'border-l-primary bg-primary/[0.03]',
            )}
          >
            <CardContent className="flex items-center justify-between gap-4">
              <Link to={`/visitas/${v.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{v.instituciones.nombre}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {v.procesos.nombre} · {formatearFecha(v.fecha)}
                  {mostrarTodas && ` · ${v.profesionales.nombre}`}
                </p>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={finalizada ? 'teal' : 'brand'}>
                  {finalizada ? 'Finalizada' : 'Borrador'}
                </Badge>

                <Button asChild variant="outline" size="sm">
                  <Link to={`/visitas/${v.id}`}>
                    {finalizada ? (
                      <>
                        <Eye className="size-4" />
                        Ver
                      </>
                    ) : (
                      <>
                        <Pencil className="size-4" />
                        Editar
                      </>
                    )}
                  </Link>
                </Button>

                {(!finalizada || puedeEliminarFinalizadas) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar visita"
                        disabled={eliminar.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar esta visita?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {v.instituciones.nombre} — {v.procesos.nombre}. Se
                          eliminarán también sus respuestas y compromisos
                          guardados.
                          {finalizada &&
                            ' Esta visita ya está finalizada: también se perderá el informe PDF generado.'}{' '}
                          Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => eliminar.mutate(v.id)}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
