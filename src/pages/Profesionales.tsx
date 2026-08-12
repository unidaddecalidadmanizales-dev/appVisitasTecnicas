import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  actualizarProfesional,
  crearProfesional,
  getProfesionales,
  subirFirmaProfesional,
  type Profesional,
} from '@/lib/queries/profesionales'
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
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.enum(['profesional', 'coordinador']),
})
type CrearValues = z.infer<typeof crearSchema>

function NuevoProfesionalDialog() {
  const [open, setOpen] = useState(false)
  const [firmaFile, setFirmaFile] = useState<File | null>(null)
  const queryClient = useQueryClient()
  const form = useForm<CrearValues>({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre: '', email: '', password: '', rol: 'profesional' },
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
            <Label htmlFor="password">Contraseña inicial</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              El profesional podrá cambiarla luego desde su Perfil.
            </p>
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

export default function Profesionales() {
  const { data: profesionales = [], isLoading } = useQuery({
    queryKey: ['profesionales'],
    queryFn: getProfesionales,
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
                <TableHead className="w-10" />
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
                  <TableCell>
                    <EditarProfesionalDialog profesional={p} />
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
