import { useQuery } from '@tanstack/react-query'
import { FileDown, Loader2 } from 'lucide-react'
import { getResumenVisita, type VisitaResumen } from '@/lib/queries/visitas'
import { ResumenVisita } from '@/components/visitas/ResumenVisita'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Arma los `indicadores` que espera `ResumenVisita` a partir de las respuestas
 * ya cargadas, en el orden del instrumento. Evita una consulta aparte al
 * catálogo de indicadores del proceso: los que no se respondieron no se
 * muestran de todos modos.
 */
function indicadoresDesdeRespuestas(visita: VisitaResumen) {
  return [...visita.respuestas]
    .sort((a, b) => (a.indicadores?.orden ?? 0) - (b.indicadores?.orden ?? 0))
    .flatMap((r) =>
      r.indicadores
        ? [{ id: r.indicadores.id, criterio: r.indicadores.criterio }]
        : [],
    )
}

interface Props {
  visitaId: string | null
  onOpenChange: (abierto: boolean) => void
  /**
   * Muestra el botón "Ver / descargar PDF" cuando la visita lo tiene. Por
   * defecto no: desde el semáforo general (2000 celdas) se viene a entender
   * de un vistazo por qué esa celda tiene ese color, no a descargar el
   * documento oficial. Se activa desde el detalle de institución, que es una
   * vista de "revisar una asistencia pasada" y sí tiene sentido bajar el PDF
   * ahí.
   */
  mostrarPdf?: boolean
}

/**
 * Resumen de solo lectura de la asistencia técnica que produjo un resultado del
 * semáforo. Reutiliza `ResumenVisita`, el mismo componente que se ve al abrir
 * una asistencia finalizada, para que el resumen sea uno solo y no dos que se
 * van separando con el tiempo.
 */
export function VisitaResumenDialog({
  visitaId,
  onOpenChange,
  mostrarPdf = false,
}: Props) {
  const { data: visita, isLoading } = useQuery({
    queryKey: ['resumen-visita', visitaId],
    queryFn: () => getResumenVisita(visitaId!),
    enabled: visitaId !== null,
  })

  return (
    <Dialog open={visitaId !== null} onOpenChange={onOpenChange}>
      {/* El ancho se fija en `sm:` a propósito: DialogContent trae `sm:max-w-lg`
          en su base, y una clase sin prefijo no lo sobrescribe (gana la
          variante, no el orden de la lista). En móvil sigue mandando el
          `max-w-[calc(100%-2rem)]` de la base. */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
        {isLoading || !visita ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Resumen de la asistencia técnica</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando resumen…
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{visita.instituciones.nombre}</DialogTitle>
              <DialogDescription>{visita.procesos.nombre}</DialogDescription>
            </DialogHeader>

            {mostrarPdf && visita.pdf_url && (
              <Button asChild className="w-fit">
                <a href={visita.pdf_url} target="_blank" rel="noreferrer">
                  <FileDown className="size-4" />
                  Ver / descargar PDF
                </a>
              </Button>
            )}

            <ResumenVisita
              visita={visita}
              indicadores={indicadoresDesdeRespuestas(visita)}
              respuestas={visita.respuestas}
              compromisos={visita.compromisos}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
