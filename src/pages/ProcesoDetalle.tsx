import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  FileSearch,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  actualizarIndicador,
  crearIndicador,
  eliminarIndicador,
  getIndicadores,
  getProceso,
  reordenarIndicadores,
  verificarPlantilla,
  type Indicador,
} from '@/lib/queries/procesos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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

const schema = z.object({
  area: z.string().min(2, 'Ingresa el área'),
  aspecto: z.string().min(2, 'Ingresa el aspecto'),
  criterio: z.string().min(5, 'Ingresa el criterio'),
})
type FormValues = z.infer<typeof schema>

function IndicadorFormDialog({
  procesoId,
  indicador,
  ordenSugerido,
  trigger,
}: {
  procesoId: string
  indicador?: Indicador
  ordenSugerido: number
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const esEdicion = !!indicador

  const form = useForm<z.input<typeof schema>, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      area: indicador?.area ?? '',
      aspecto: indicador?.aspecto ?? '',
      criterio: indicador?.criterio ?? '',
    },
  })

  const guardar = useMutation({
    mutationFn: (values: FormValues) =>
      esEdicion
        ? actualizarIndicador(indicador!.id, values)
        : // El orden se asigna al final de la lista; luego se reordena
          // arrastrando los indicadores.
          crearIndicador({ ...values, orden: ordenSugerido, proceso_id: procesoId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicadores', procesoId] })
      queryClient.invalidateQueries({ queryKey: ['conteo-indicadores'] })
      toast.success(esEdicion ? 'Indicador actualizado' : 'Indicador creado')
      form.reset()
      setOpen(false)
    },
    onError: (e: Error) =>
      toast.error('No se pudo guardar', { description: e.message }),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o)
          form.reset({
            area: indicador?.area ?? '',
            aspecto: indicador?.aspecto ?? '',
            criterio: indicador?.criterio ?? '',
          })
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar indicador' : 'Nuevo indicador'}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => guardar.mutate(v))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="area">Área</Label>
            <Input id="area" {...form.register('area')} />
            {form.formState.errors.area && (
              <p className="text-sm text-destructive">
                {form.formState.errors.area.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aspecto">Aspecto a revisar</Label>
            <Input id="aspecto" {...form.register('aspecto')} />
            {form.formState.errors.aspecto && (
              <p className="text-sm text-destructive">
                {form.formState.errors.aspecto.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Agrupa varios criterios bajo un mismo subtema (ej. "Presentación"). En
              la plantilla oficial este texto queda fijo — si lo cambias aquí,
              actualiza también la plantilla en Google Docs para que coincidan.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="criterio">Criterio</Label>
            <Textarea id="criterio" rows={3} {...form.register('criterio')} />
            {form.formState.errors.criterio && (
              <p className="text-sm text-destructive">
                {form.formState.errors.criterio.message}
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={guardar.isPending}>
            {guardar.isPending && <Loader2 className="size-4 animate-spin" />}
            {esEdicion ? 'Guardar cambios' : 'Crear indicador'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SortableIndicadorRow({
  indicador,
  procesoId,
  ordenSugerido,
  eliminando,
  onEliminar,
}: {
  indicador: Indicador
  procesoId: string
  ordenSugerido: number
  eliminando: boolean
  onEliminar: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: indicador.id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start justify-between gap-3 rounded-lg border bg-card p-4 ${isDragging ? 'z-10 opacity-70 shadow-md' : ''}`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastrar para reordenar"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{indicador.aspecto}</p>
          <p className="text-sm text-muted-foreground">{indicador.criterio}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IndicadorFormDialog
          procesoId={procesoId}
          indicador={indicador}
          ordenSugerido={ordenSugerido}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Editar indicador">
              <Pencil className="size-4" />
            </Button>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Eliminar indicador"
              disabled={eliminando}
            >
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este indicador?</AlertDialogTitle>
              <AlertDialogDescription>
                {indicador.criterio}
                <br />
                No se puede deshacer. Si ya tiene respuestas registradas en
                alguna visita, no se podrá eliminar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => onEliminar(indicador.id)}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

function IndicadoresAreaSortable({
  area,
  items,
  procesoId,
  ordenSugerido,
  eliminando,
  onEliminar,
  onMover,
}: {
  area: string
  items: Indicador[]
  procesoId: string
  ordenSugerido: number
  eliminando: boolean
  onEliminar: (id: string) => void
  onMover: (area: string, oldIndex: number, newIndex: number) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onMover(area, oldIndex, newIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.map((ind) => (
            <SortableIndicadorRow
              key={ind.id}
              indicador={ind}
              procesoId={procesoId}
              ordenSugerido={ordenSugerido}
              eliminando={eliminando}
              onEliminar={onEliminar}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

export default function ProcesoDetalle() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: proceso, isLoading: cargandoProceso } = useQuery({
    queryKey: ['proceso', id],
    queryFn: () => getProceso(id!),
    enabled: !!id,
  })
  const { data: indicadores = [], isLoading: cargandoIndicadores } = useQuery({
    queryKey: ['indicadores', id],
    queryFn: () => getIndicadores(id!),
    enabled: !!id,
  })

  const verificar = useMutation({
    mutationFn: () => verificarPlantilla(id!),
    onSuccess: ({ capacidad, actual, disponible }) => {
      if (disponible > 0) {
        toast.success('La plantilla tiene espacio de sobra', {
          description: `Capacidad para ${capacidad} indicadores, hay ${actual} — puedes agregar ${disponible} más sin tocar la plantilla.`,
        })
      } else {
        toast.warning('La plantilla está al límite', {
          description: `Capacidad para ${capacidad} indicadores y ya hay ${actual}. Si agregas uno más, tendrás que agregar también su fila en la plantilla de Google Docs antes de poder generar el PDF.`,
        })
      }
    },
    onError: (e: Error) =>
      toast.error('No se pudo verificar la plantilla', { description: e.message }),
  })

  const eliminar = useMutation({
    mutationFn: eliminarIndicador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicadores', id] })
      queryClient.invalidateQueries({ queryKey: ['conteo-indicadores'] })
      toast.success('Indicador eliminado')
    },
    onError: (e: Error) =>
      toast.error('No se pudo eliminar', { description: e.message }),
  })

  const porArea = useMemo(() => {
    const map = new Map<string, Indicador[]>()
    for (const ind of indicadores) {
      const list = map.get(ind.area) ?? []
      list.push(ind)
      map.set(ind.area, list)
    }
    return map
  }, [indicadores])

  // Arrastrar un indicador dentro de su área recalcula el `orden` (1..N) de
  // TODO el proceso, no solo de esa área: es un único campo global (el mismo
  // que usa generar-pdf-google para emparejar cada respuesta con el tag
  // {indicadorN} de la plantilla), así que las demás áreas deben conservar su
  // posición relativa intacta.
  const reordenar = useMutation({
    mutationFn: reordenarIndicadores,
    onError: (e: Error) => {
      toast.error('No se pudo guardar el nuevo orden', { description: e.message })
      queryClient.invalidateQueries({ queryKey: ['indicadores', id] })
    },
  })

  function moverIndicador(area: string, oldIndex: number, newIndex: number) {
    const itemsArea = porArea.get(area) ?? []
    const nuevoOrdenArea = arrayMove(itemsArea, oldIndex, newIndex)
    let cursor = 0
    const nuevaLista = indicadores.map((ind) =>
      ind.area === area ? nuevoOrdenArea[cursor++] : ind,
    )
    const cambios = nuevaLista
      .map((ind, i) => ({ id: ind.id, orden: i + 1 }))
      .filter(({ id: indId, orden }) => {
        const original = indicadores.find((ind) => ind.id === indId)
        return original && original.orden !== orden
      })
    if (cambios.length === 0) return

    queryClient.setQueryData<Indicador[]>(['indicadores', id], () =>
      nuevaLista.map((ind, i) => ({ ...ind, orden: i + 1 })),
    )
    reordenar.mutate(cambios)
  }

  const ordenSugerido = (indicadores.at(-1)?.orden ?? 0) + 1
  const isLoading = cargandoProceso || cargandoIndicadores

  if (!id) return null

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          to="/procesos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Procesos
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">
            {isLoading ? 'Cargando…' : proceso?.nombre}
          </h1>
          {!isLoading && proceso && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                onClick={() => verificar.mutate()}
                disabled={verificar.isPending}
              >
                {verificar.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileSearch className="size-4" />
                )}
                Verificar espacio en plantilla
              </Button>
              <IndicadorFormDialog
                procesoId={proceso.id}
                ordenSugerido={ordenSugerido}
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Nuevo indicador
                  </Button>
                }
              />
            </div>
          )}
        </div>
        {proceso?.objetivo_fijo && (
          <p className="text-sm text-muted-foreground">
            Objetivo fijo: {proceso.objetivo_fijo}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : indicadores.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este proceso todavía no tiene indicadores.
        </p>
      ) : (
        <div className="space-y-6">
          {[...porArea.entries()].map(([area, items]) => (
            <section key={area} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {area}
              </h3>
              <IndicadoresAreaSortable
                area={area}
                items={items}
                procesoId={id}
                ordenSugerido={ordenSugerido}
                eliminando={eliminar.isPending}
                onEliminar={(indId) => eliminar.mutate(indId)}
                onMover={moverIndicador}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
