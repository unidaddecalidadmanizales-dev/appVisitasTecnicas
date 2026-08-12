import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Pencil, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import {
  actualizarProfesional,
  crearProfesional,
  getProfesionales,
  getUltimasConexiones,
  resetearPassword,
  subirFirmaProfesional,
  type Profesional,
} from '@/lib/queries/profesionales'
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
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function FirmaInput({
  previewUrl,
  onFileSelected,
}: {
  previewUrl?: string | null
  onFileSelected: (file: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const mostrar = localPreview ?? previewUrl

  return (
    <div className="space-y-1.5">
      <Label>Firma digital (opcional)</Label>
      {mostrar && (
        <img
          src={mostrar}
          alt="Firma"
          className="h-24 w-full max-w-[200px] rounded-md border bg-white object-contain p-1"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null
          onFileSelected(file)
          setLocalPreview(file ? URL.createObjectURL(file) : null)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {mostrar ? 'Reemplazar imagen' : 'Subir imagen'}
      </Button>
    </div>
  )
}

const crearSchema = z.object({
  nombre: z.string().min(2, 'Ingresa el nombre'),
  email: z.string().email('Correo inválido'),
  rol: z.enum(['profesional', 'coordinador']),
})
type CrearValues = z.infer<typeof crearSchema>

function NuevoProfesionalDialog() {
  const [open, setOpen] = useState(false)
  const [firmaFile, setFirmaFile] = useState<File | null>(null)
  const queryClient = useQueryClient()
  const form = useForm<CrearValues>({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre: '', email: '', rol: 'profesional' },
  })

  const crear = useMutation({
    mutationFn: async (values: CrearValues) => {
      const creado = await crearProfesional(values)
      if (firmaFile) {
        const url = await subirFirmaProfesional(creado.id, firmaFile)
        await actualizarProfesional(creado.id, { firma_url: url })
      }
      return creado
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] })
      toast.success('Profesional creado')
      form.reset()
      setFirmaFile(null)
      setOpen(false)
    },
    onError: (e: Error) =>
      toast.error('No se pudo crear', { description: e.message }),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nuevo profesional
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo profesional</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => crear.mutate(v))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre && (
              <p className="text-sm text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" {...form.register('email')} />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rol">Rol</Label>
            <Select
              defaultValue={form.getValues('rol')}
              onValueChange={(v) =>
                form.setValue('rol', v as CrearValues['rol'])
              }
            >
              <SelectTrigger id="rol" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profesional">Profesional</SelectItem>
                <SelectItem value="coordinador">Coordinador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FirmaInput onFileSelected={setFirmaFile} />
          <p className="text-xs text-muted-foreground">
            Su contraseña inicial será <strong>12345678</strong>; el sistema le
            pedirá cambiarla la primera vez que entre.
          </p>
          <Button type="submit" className="w-full" disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="size-4 animate-spin" />}
            Crear profesional
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const editarSchema = z.object({
  nombre: z.string().min(2, 'Ingresa el nombre'),
  rol: z.enum(['profesional', 'coordinador']),
})
type EditarValues = z.infer<typeof editarSchema>

function EditarProfesionalDialog({ profesional }: { profesional: Profesional }) {
  const [open, setOpen] = useState(false)
  const [firmaFile, setFirmaFile] = useState<File | null>(null)
  const queryClient = useQueryClient()
  const form = useForm<EditarValues>({
    resolver: zodResolver(editarSchema),
    defaultValues: {
      nombre: profesional.nombre,
      rol: profesional.rol as EditarValues['rol'],
    },
  })

  const guardar = useMutation({
    mutationFn: async (values: EditarValues) => {
      let firma_url: string | undefined
      if (firmaFile) {
        firma_url = await subirFirmaProfesional(profesional.id, firmaFile)
      }
      return actualizarProfesional(profesional.id, { ...values, firma_url })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profesionales'] })
      toast.success('Profesional actualizado')
      setFirmaFile(null)
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
            nombre: profesional.nombre,
            rol: profesional.rol as EditarValues['rol'],
          })
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Editar profesional">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar profesional</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => guardar.mutate(v))}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label>Correo</Label>
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {profesional.email}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-nombre">Nombre</Label>
            <Input id="edit-nombre" {...form.register('nombre')} />
            {form.formState.errors.nombre && (
              <p className="text-sm text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-rol">Rol</Label>
            <Select
              value={form.watch('rol')}
              onValueChange={(v) =>
                form.setValue('rol', v as EditarValues['rol'])
              }
            >
              <SelectTrigger id="edit-rol" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="profesional">Profesional</SelectItem>
                <SelectItem value="coordinador">Coordinador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FirmaInput
            previewUrl={profesional.firma_url}
            onFileSelected={setFirmaFile}
          />
          <Button type="submit" className="w-full" disabled={guardar.isPending}>
            {guardar.isPending && <Loader2 className="size-4 animate-spin" />}
            Guardar cambios
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Formatea la última conexión. `undefined` es "todavía cargando"; `null` es
 * "sin conexión registrada", que cubre dos casos que no conviene distinguir en
 * la tabla: quien nunca ha entrado, y quien no ha vuelto a entrar desde que se
 * reinició el contador. Entrar actuando como esa persona no cuenta.
 */
function textoUltimaConexion(iso: string | null | undefined) {
  if (iso === undefined) return '—'
  if (iso === null) return 'Sin registro'
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function ResetearPasswordDialog({ profesional }: { profesional: Profesional }) {
  const [open, setOpen] = useState(false)

  const resetear = useMutation({
    mutationFn: () => resetearPassword(profesional.id),
    onSuccess: ({ profesionalNombre, passwordInicial }) => {
      setOpen(false)
      toast.success(`Contraseña de ${profesionalNombre} restablecida`, {
        description: `Ahora es "${passwordInicial}". Se le pedirá cambiarla al entrar.`,
        duration: 10000,
      })
    },
    onError: (e: Error) =>
      toast.error('No se pudo resetear la contraseña', { description: e.message }),
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Resetear contraseña">
          <KeyRound className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Resetear la contraseña de {profesional.nombre}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Su contraseña actual dejará de funcionar y volverá a ser la inicial
            (<strong>12345678</strong>). La próxima vez que entre, el sistema le
            pedirá definir una contraseña propia antes de poder usar la app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resetear.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={resetear.isPending}
            onClick={(e) => {
              // Sin esto Radix cierra el diálogo al instante y el estado de
              // carga del botón no se llega a ver; lo cierra `onSuccess`.
              e.preventDefault()
              resetear.mutate()
            }}
          >
            {resetear.isPending && <Loader2 className="size-4 animate-spin" />}
            Resetear contraseña
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function Profesionales() {
  const { rol } = useAuth()
  const esAdministrador = rol === 'administrador'

  const { data: profesionales = [], isLoading } = useQuery({
    queryKey: ['profesionales'],
    queryFn: getProfesionales,
  })

  // Solo el administrador ve las conexiones. La restricción real vive en el
  // RPC (que rechaza a cualquier otro rol); esto evita además disparar una
  // llamada que sabemos que va a fallar.
  const { data: conexiones } = useQuery({
    queryKey: ['ultimas-conexiones'],
    queryFn: getUltimasConexiones,
    enabled: esAdministrador,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Profesionales
          </h1>
          <p className="text-muted-foreground">
            Usuarios con acceso al sistema.
          </p>
        </div>
        <NuevoProfesionalDialog />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : (
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                {esAdministrador && <TableHead>Última conexión</TableHead>}
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profesionales.map((p) => (
                <TableRow key={p.id} className="hover:bg-primary/5">
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.rol === 'coordinador' ? 'default' : 'secondary'}>
                      {p.rol === 'coordinador' ? 'Coordinador' : 'Profesional'}
                    </Badge>
                  </TableCell>
                  {esAdministrador && (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {textoUltimaConexion(conexiones?.get(p.id))}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <ResetearPasswordDialog profesional={p} />
                      <EditarProfesionalDialog profesional={p} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
