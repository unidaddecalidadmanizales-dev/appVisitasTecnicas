import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, FileEdit, Loader2 } from 'lucide-react'
import { getConteoIndicadoresPorProceso, getProcesos } from '@/lib/queries/procesos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Procesos() {
  const { data: procesos = [], isLoading: cargandoProcesos } = useQuery({
    queryKey: ['procesos'],
    queryFn: getProcesos,
  })
  const { data: conteo = {}, isLoading: cargandoConteo } = useQuery({
    queryKey: ['conteo-indicadores'],
    queryFn: getConteoIndicadoresPorProceso,
  })

  const isLoading = cargandoProcesos || cargandoConteo

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Procesos</h1>
        <p className="text-muted-foreground">
          Catálogo de procesos e indicadores del checklist.
        </p>
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
                <TableHead>Proceso</TableHead>
                <TableHead>Clave</TableHead>
                <TableHead className="text-right">Indicadores</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {procesos.map((p) => (
                <TableRow key={p.id} className="hover:bg-brand-teal/5">
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{p.clave}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="teal">{conteo[p.id] ?? 0}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {p.plantilla_doc_id && (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={`https://docs.google.com/document/d/${p.plantilla_doc_id}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileEdit className="size-4" />
                            Editar plantilla
                          </a>
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/procesos/${p.id}`}>
                          <Eye className="size-4" />
                          Ver
                        </Link>
                      </Button>
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
