import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Loader2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  crearInstitucion,
  getInstituciones,
} from '@/lib/queries/instituciones'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const schema = z.object({
  nombre: z.string().min(2, 'Ingresa el nombre de la institución'),
  sector: z.string().optional(),
  sede: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function NuevaInstitucionDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', sector: '', sede: '' },
  })

  const crear = useMutation({
    mutationFn: (values: FormValues) =>
      crearInstitucion({
        nombre: values.nombre,
        sector: values.sector || null,
        sede: values.sede || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instituciones'] })
      toast.success('Institución creada')
      form.reset()
      setOpen(false)
    },
    onError: (e: Error) =>
      toast.error('No se pudo crear la institución', { description: e.message }),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nueva institución
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva institución</DialogTitle>
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
            <Label htmlFor="sector">Sector</Label>
            <Input id="sector" {...form.register('sector')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sede">Sede</Label>
            <Input id="sede" {...form.register('sede')} />
          </div>
          <Button type="submit" className="w-full" disabled={crear.isPending}>
            {crear.isPending && <Loader2 className="size-4 animate-spin" />}
            Crear institución
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function Instituciones() {
  const { data: instituciones = [], isLoading } = useQuery({
    queryKey: ['instituciones'],
    queryFn: getInstituciones,
  })

  const [busqueda, setBusqueda] = useState('')
  const [sector, setSector] = useState<'todas' | 'oficial' | 'no-oficial'>('todas')

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return instituciones.filter((inst) => {
      if (texto && !inst.nombre.toLowerCase().includes(texto)) return false
      if (sector === 'todas') return true
      const esOficial = inst.sector === 'Oficial'
      return sector === 'oficial' ? esOficial : !esOficial
    })
  }, [instituciones, busqueda, sector])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Instituciones
          </h1>
          <p className="text-muted-foreground">
            Listado de instituciones educativas.
          </p>
        </div>
        <NuevaInstitucionDialog />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : instituciones.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay instituciones registradas todavía.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sector} onValueChange={(v) => setSector(v as typeof sector)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos los sectores</SelectItem>
                <SelectItem value="oficial">Oficiales</SelectItem>
                <SelectItem value="no-oficial">No oficiales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguna institución coincide con el filtro.
            </p>
          ) : (
            <Card className="overflow-hidden py-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((inst) => (
                    <TableRow key={inst.id} className="hover:bg-primary/5">
                      <TableCell className="font-medium">{inst.nombre}</TableCell>
                      <TableCell>
                        {inst.sector ? (
                          <Badge variant={inst.sector === 'Oficial' ? 'brand' : 'teal'}>
                            {inst.sector}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/instituciones/${inst.id}`}>
                            <Eye className="size-4" />
                            Ver
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
