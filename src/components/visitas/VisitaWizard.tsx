import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  FileDown,
  CheckCircle2,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useVisita } from '@/hooks/useVisita'
import { useProceso } from '@/hooks/useProceso'
import {
  actualizarVisita,
  eliminarCompromisosPorId,
  generarPdfGoogle,
  getCompromisos,
  guardarCompromisos,
  type CompromisoInput,
} from '@/lib/queries/visitas'
import { calcularSemaforo } from '@/lib/constants'
import { AreaSection } from './AreaSection'
import { CamposExtraForm, type ValoresExtra } from './CamposExtraForm'
import {
  CompromisosForm,
  nuevoCompromiso,
  type CompromisoDraft,
} from './CompromisosForm'
import { ResultadoSemaforo } from './ResultadoSemaforo'
import { ResumenVisita } from './ResumenVisita'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const PASOS = [
  { n: 1, label: 'Datos generales' },
  { n: 2, label: 'Valoración' },
  { n: 3, label: 'Cierre' },
  { n: 4, label: 'PDF' },
] as const

interface Props {
  visitaId: string
}

/**
 * Orquesta el flujo de diligenciamiento en 4 pasos. Se adapta al catálogo del
 * proceso (indicadores + campos extra) en vez de tener un formulario por proceso.
 */
export function VisitaWizard({ visitaId }: Props) {
  const { profesional } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const {
    visita,
    respuestas,
    isLoading: cargandoVisita,
    guardarRespuesta,
    refetchVisita,
  } = useVisita(visitaId)
  const {
    proceso,
    indicadores,
    camposExtra,
    isLoading: cargandoProceso,
  } = useProceso(visita?.proceso_id)

  const finalizada = visita?.estado === 'finalizado'
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Una visita ya finalizada se abre directo en el resumen (solo lectura).
  useEffect(() => {
    if (finalizada) setStep(4)
  }, [finalizada])

  // ---- Paso 1: datos generales ----
  const [fecha, setFecha] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [actividadAdicional, setActividadAdicional] = useState('')
  const [seguimiento, setSeguimiento] = useState('')

  useEffect(() => {
    if (!visita) return
    setFecha(visita.fecha)
    setHoraInicio(visita.hora_inicio ?? '')
    setHoraFin(visita.hora_fin ?? '')
    setObjetivo(proceso?.objetivo_fijo ?? visita.objetivo ?? '')
    setActividadAdicional(visita.actividad_adicional ?? '')
    setSeguimiento(visita.seguimiento_compromisos_anteriores ?? '')
  }, [visita, proceso])

  const guardarDatosGenerales = useMutation({
    mutationFn: () =>
      actualizarVisita(visitaId, {
        fecha,
        hora_inicio: horaInicio || null,
        hora_fin: horaFin || null,
        objetivo: objetivo || null,
        actividad_adicional: actividadAdicional || null,
        seguimiento_compromisos_anteriores: seguimiento || null,
      }),
    onSuccess: () => {
      refetchVisita()
      setStep(2)
    },
    onError: (e: Error) =>
      toast.error('No se pudo guardar', { description: e.message }),
  })

  // ---- Paso 2: checklist ----
  const respuestasPorIndicador = useMemo(
    () => new Map(respuestas.map((r) => [r.indicador_id, r])),
    [respuestas],
  )
  const indicadoresPorArea = useMemo(() => {
    const map = new Map<string, typeof indicadores>()
    for (const ind of indicadores) {
      const list = map.get(ind.area) ?? []
      list.push(ind)
      map.set(ind.area, list)
    }
    return map
  }, [indicadores])

  const [valoresExtra, setValoresExtra] = useState<ValoresExtra>({})
  useEffect(() => {
    if (visita?.datos_adicionales && typeof visita.datos_adicionales === 'object') {
      setValoresExtra(visita.datos_adicionales as ValoresExtra)
    }
    // Solo al cambiar de visita, no en cada cambio de valoresExtra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visita?.id])

  useEffect(() => {
    if (camposExtra.length === 0 || Object.keys(valoresExtra).length === 0) return
    const t = setTimeout(() => {
      actualizarVisita(visitaId, { datos_adicionales: valoresExtra }).catch(
        () => {},
      )
    }, 700)
    return () => clearTimeout(t)
  }, [valoresExtra, visitaId, camposExtra.length])

  const todasRespondidas =
    indicadores.length > 0 &&
    indicadores.every((i) => respuestasPorIndicador.has(i.id))

  // Cada indicador ya se autoguarda al responder; este botón solo confirma
  // el estado desde el servidor, para que el profesional tenga la
  // tranquilidad de que puede cerrar la pestaña y continuar después.
  const guardarAvanceValoracion = useMutation({
    mutationFn: () =>
      Promise.all([
        refetchVisita(),
        queryClient.invalidateQueries({ queryKey: ['respuestas', visitaId] }),
      ]),
    onSuccess: () => {
      toast.success('Avance guardado', {
        description: 'Puedes continuar después desde cualquier dispositivo.',
      })
    },
    onError: (e: Error) =>
      toast.error('No se pudo guardar el avance', { description: e.message }),
  })

  // ---- Paso 3: cierre ----
  const compromisosGuardadosQuery = useQuery({
    queryKey: ['compromisos', visitaId],
    queryFn: () => getCompromisos(visitaId),
  })
  const [compromisos, setCompromisos] = useState<CompromisoDraft[]>([
    nuevoCompromiso(),
  ])
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    if (!visita) return
    setObservaciones(visita.observaciones ?? '')
  }, [visita])

  // El resultado ya no se elige manualmente: se calcula con el mismo
  // promedio que usaba el sistema anterior (Existe=5, con oportunidad de
  // mejora=3, No existe=1; "No aplica" no cuenta).
  const resultadoCalculado = useMemo(() => calcularSemaforo(respuestas), [respuestas])

  // Al abrir una visita con compromisos ya guardados (de una sesión anterior,
  // en este mismo dispositivo u otro), precargarlos en vez de partir en blanco.
  useEffect(() => {
    if (!compromisosGuardadosQuery.data) return
    if (compromisosGuardadosQuery.data.length === 0) return
    setCompromisos(
      compromisosGuardadosQuery.data.map((c) => ({
        id: c.id,
        descripcion: c.descripcion,
        responsable: c.responsable ?? '',
        fecha_verificacion: c.fecha_verificacion ?? '',
      })),
    )
    // Solo al recibir los datos por primera vez, no en cada cambio local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compromisosGuardadosQuery.data?.length])

  /**
   * Guarda compromisos, resultado y observaciones sin finalizar la visita.
   * La usan tanto "Guardar avance" como "Finalizar asistencia técnica" (que además
   * genera el PDF), así que la lógica de persistencia vive en un solo lugar.
   */
  async function guardarCierreEnDB(): Promise<void> {
    const compromisosValidos: CompromisoInput[] = compromisos
      .filter((c) => c.descripcion.trim())
      .map((c) => ({
        id: c.id,
        descripcion: c.descripcion.trim(),
        responsable: c.responsable.trim() || null,
        fecha_verificacion: c.fecha_verificacion || null,
      }))
    const idsGuardados = new Set(
      (compromisosGuardadosQuery.data ?? []).map((c) => c.id),
    )
    const idsActuales = new Set(compromisosValidos.map((c) => c.id))
    const idsAEliminar = [...idsGuardados].filter((id) => !idsActuales.has(id))
    if (idsAEliminar.length) await eliminarCompromisosPorId(idsAEliminar)
    await guardarCompromisos(visitaId, compromisosValidos)

    await actualizarVisita(visitaId, {
      resultado_semaforo: resultadoCalculado,
      observaciones: observaciones || null,
    })
  }

  const guardarAvance = useMutation({
    mutationFn: guardarCierreEnDB,
    onSuccess: async () => {
      await Promise.all([
        refetchVisita(),
        queryClient.invalidateQueries({ queryKey: ['compromisos', visitaId] }),
      ])
      toast.success('Avance guardado', {
        description: 'Puedes continuar desde cualquier dispositivo.',
      })
    },
    onError: (e: Error) =>
      toast.error('No se pudo guardar el avance', { description: e.message }),
  })

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!visita || !proceso) throw new Error('Asistencia técnica no cargada')
      if (!profesional?.firma_url) {
        throw new Error(
          'Configura tu firma digital en Perfil antes de finalizar',
        )
      }

      await guardarCierreEnDB()
      // La Edge Function rellena la plantilla oficial de Google Docs del
      // proceso con los datos ya guardados y la exporta a PDF; también deja
      // la visita en estado 'finalizado' del lado del servidor.
      await generarPdfGoogle(visitaId)
    },
    onSuccess: async () => {
      await refetchVisita()
      queryClient.invalidateQueries({ queryKey: ['visitas'] })
      setStep(4)
      toast.success('Asistencia técnica finalizada')
    },
    onError: (e: Error) =>
      toast.error('No se pudo finalizar la asistencia técnica', { description: e.message }),
  })

  if (cargandoVisita || cargandoProceso || !visita || !proceso) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando visita…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Stepper current={step} finalizada={finalizada} />

      {step === 1 && (
        <Card
          key="paso-1"
          className="animate-in fade-in slide-in-from-right-3 duration-300 ease-out"
        >
          <CardHeader>
            <CardTitle>Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={fecha}
                  disabled={finalizada}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hora_inicio">Hora de inicio</Label>
                <Input
                  id="hora_inicio"
                  type="time"
                  value={horaInicio}
                  disabled={finalizada}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hora_fin">Hora de fin</Label>
                <Input
                  id="hora_fin"
                  type="time"
                  value={horaFin}
                  disabled={finalizada}
                  onChange={(e) => setHoraFin(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="objetivo">Objetivo</Label>
              {proceso.objetivo_fijo ? (
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {proceso.objetivo_fijo}
                </p>
              ) : (
                <Textarea
                  id="objetivo"
                  value={objetivo}
                  disabled={finalizada}
                  onChange={(e) => setObjetivo(e.target.value)}
                  rows={3}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actividad">Actividad adicional</Label>
              <Textarea
                id="actividad"
                value={actividadAdicional}
                disabled={finalizada}
                onChange={(e) => setActividadAdicional(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seguimiento">
                Seguimiento a compromisos anteriores
              </Label>
              <Textarea
                id="seguimiento"
                value={seguimiento}
                disabled={finalizada}
                onChange={(e) => setSeguimiento(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button
                disabled={!fecha || finalizada || guardarDatosGenerales.isPending}
                onClick={() => guardarDatosGenerales.mutate()}
              >
                {guardarDatosGenerales.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Guardar y continuar
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card
          key="paso-2"
          className="animate-in fade-in slide-in-from-right-3 duration-300 ease-out"
        >
          <CardHeader>
            <CardTitle>Valoración de indicadores — {proceso.nombre}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {[...indicadoresPorArea.entries()].map(([area, items]) => (
              <AreaSection
                key={area}
                area={area}
                indicadores={items}
                respuestasPorIndicador={respuestasPorIndicador}
                onGuardar={(input) =>
                  guardarRespuesta.mutate({ visita_id: visitaId, ...input })
                }
              />
            ))}

            <CamposExtraForm
              campos={camposExtra}
              valores={valoresExtra}
              onChange={setValoresExtra}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" />
                Anterior
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => guardarAvanceValoracion.mutate()}
                  disabled={guardarAvanceValoracion.isPending}
                >
                  {guardarAvanceValoracion.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Guardar avance
                </Button>
                <Button disabled={!todasRespondidas} onClick={() => setStep(3)}>
                  Siguiente
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
            {!todasRespondidas && (
              <p className="text-right text-xs text-muted-foreground">
                Responde todos los indicadores para continuar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card
          key="paso-3"
          className="animate-in fade-in slide-in-from-right-3 duration-300 ease-out"
        >
          <CardHeader>
            <CardTitle>Cierre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-1.5">
              <Label>Compromisos</Label>
              <CompromisosForm value={compromisos} onChange={setCompromisos} />
            </div>

            <div className="space-y-1.5">
              <Label>Resultado (semáforo)</Label>
              <p className="text-xs text-muted-foreground">
                Se calcula automáticamente a partir de la valoración de los indicadores.
              </p>
              <ResultadoSemaforo value={resultadoCalculado} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="observaciones">Observaciones generales</Label>
              <Textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Firma del profesional
              </Label>
              {profesional?.firma_url ? (
                <img
                  src={profesional.firma_url}
                  alt="Tu firma"
                  className="h-32 w-full max-w-xs rounded-lg border bg-white object-contain p-2"
                />
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    No tienes una firma digital configurada. Debes{' '}
                    <Link
                      to="/perfil"
                      className="font-medium underline underline-offset-2"
                    >
                      configurarla en tu Perfil
                    </Link>{' '}
                    antes de poder finalizar esta asistencia técnica.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={finalizar.isPending || guardarAvance.isPending}
              >
                <ArrowLeft className="size-4" />
                Anterior
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => guardarAvance.mutate()}
                  disabled={finalizar.isPending || guardarAvance.isPending}
                >
                  {guardarAvance.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Guardar avance
                </Button>
                <Button
                  onClick={() => finalizar.mutate()}
                  disabled={
                    finalizar.isPending ||
                    guardarAvance.isPending ||
                    !profesional?.firma_url
                  }
                >
                  {finalizar.isPending && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                Finalizar asistencia técnica
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card
          key="paso-4"
          className="animate-in fade-in zoom-in-95 duration-300 ease-out"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Visita finalizada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {visita.instituciones.nombre} — {visita.procesos.nombre}
            </p>
            {visita.pdf_url ? (
              <Button asChild>
                <a href={visita.pdf_url} target="_blank" rel="noreferrer">
                  <FileDown className="size-4" />
                  Ver / descargar PDF
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Generando PDF…</p>
            )}
            <div>
              <Button variant="outline" onClick={() => navigate('/mis-visitas')}>
                Volver a mis visitas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card
          key="paso-4-resumen"
          className="animate-in fade-in zoom-in-95 duration-300 ease-out"
        >
          <CardHeader>
            <CardTitle>Resumen de la asistencia técnica</CardTitle>
          </CardHeader>
          <CardContent>
            <ResumenVisita
              visita={visita}
              indicadores={indicadores}
              respuestas={respuestas}
              compromisos={compromisosGuardadosQuery.data ?? []}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stepper({
  current,
  finalizada,
}: {
  current: number
  finalizada: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      {PASOS.map((p, i) => (
        <div key={p.n} className="flex flex-1 items-center gap-2">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-all duration-300',
              current === p.n
                ? 'scale-110 border-primary bg-primary text-primary-foreground ring-4 ring-primary/15'
                : current > p.n || finalizada
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-muted-foreground/30 text-muted-foreground',
            )}
          >
            {p.n}
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">
            {p.label}
          </span>
          {i < PASOS.length - 1 && <div className="h-px flex-1 bg-border" />}
        </div>
      ))}
    </div>
  )
}
