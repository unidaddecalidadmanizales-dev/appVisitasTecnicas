import { createClient } from 'jsr:@supabase/supabase-js@2'
import { google } from 'npm:googleapis@144'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS_HEADERS }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

/** Escala 1-4 usada en el "Concepto final" de las plantillas oficiales. */
const SEMAFORO_NUMERO: Record<string, number> = {
  Existencia: 1,
  Apropiación: 2,
  Pertinencia: 3,
  'Mejora continua': 4,
}

function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

/** Como formatearFecha, pero tolera null/undefined (usada en fechas opcionales). */
function formatearFechaOpcional(fecha: string | null | undefined) {
  return fecha ? formatearFecha(fecha) : '—'
}

function fmt(value: string | null | undefined) {
  return value && value.trim() ? value : '—'
}

/** Convierte "HH:mm:ss" (24h) a "hh:mm a.m./p.m.". */
function formatearHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  const [hStr, mStr] = hora.split(':')
  let h = parseInt(hStr, 10)
  const sufijo = h >= 12 ? 'p.m.' : 'a.m.'
  h = h % 12
  if (h === 0) h = 12
  return `${String(h).padStart(2, '0')}:${mStr} ${sufijo}`
}

/** Nombre de archivo legible: "dd-mm-aaaa-ABREV-Nombre-Institucion.pdf".
 * Sin tildes/eñes: Supabase Storage rechaza esos bytes en la key del objeto.
 * Cuando hay más de una visita histórica a la misma institución+proceso se
 * agrega "-VN" al final — sin eso, dos visitas de profesionales distintos el
 * mismo día terminaban compartiendo el mismo nombre y una sobreescribía el
 * PDF de la otra. */
function construirNombreArchivo(
  fecha: string,
  abreviatura: string,
  institucion: string,
  numeroVisita: number,
): string {
  const [y, m, d] = fecha.split('-')
  const institucionLimpia = institucion
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ /g, '-')
  const sufijo = numeroVisita > 1 ? `-V${numeroVisita}` : ''
  return `${d}-${m}-${y}-${abreviatura}-${institucionLimpia}${sufijo}.pdf`
}

/** Recorre el contenido estructurado de un Google Doc (incluyendo tablas
 * anidadas) y devuelve todos los textRun con su posición absoluta. */
interface RunInfo {
  text: string
  startIndex: number
}

// deno-lint-ignore no-explicit-any
function extraerRuns(content: any[] | undefined, out: RunInfo[] = []): RunInfo[] {
  if (!content) return out
  for (const el of content) {
    if (el.paragraph?.elements) {
      for (const pe of el.paragraph.elements) {
        if (pe.textRun?.content) {
          out.push({ text: pe.textRun.content, startIndex: pe.startIndex })
        }
      }
    }
    if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          extraerRuns(cell.content, out)
        }
      }
    }
  }
  return out
}

/** Ubica el rango [start,end) de la primera ocurrencia de `needle` en el
 * documento, buscando dentro de cada textRun (no cruza dos runs distintos —
 * suficiente porque los tags {tag} de estas plantillas siempre quedan dentro
 * de un mismo run de texto). */
function ubicarTexto(runs: RunInfo[], needle: string) {
  for (const run of runs) {
    const idx = run.text.indexOf(needle)
    if (idx !== -1) {
      return { startIndex: run.startIndex + idx, endIndex: run.startIndex + idx + needle.length }
    }
  }
  return null
}

/** Extrae, en orden de aparición en el documento, los números de los tags
 * {indicadorN} (o {observacionN}) — puede haber saltos en la numeración
 * respecto al catálogo de indicadores, así que no se puede asumir 1..N. */
function extraerNumerosTag(runs: RunInfo[], prefijo: 'indicador' | 'observacion'): number[] {
  const texto = runs.map((r) => r.text).join('')
  const re = new RegExp(`\\{${prefijo}(\\d+)\\}`, 'g')
  const numeros: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) numeros.push(Number(m[1]))
  return numeros
}

/** Ubica la tabla de compromisos (la que contiene {compromisoN}) y, para
 * cada N presente en la plantilla, en qué rowIndex de esa tabla está. */
interface TablaCompromisos {
  startIndex: number
  filaPorCompromiso: Map<number, number>
}

// deno-lint-ignore no-explicit-any
function localizarTablaCompromisos(content: any[] | undefined): TablaCompromisos | null {
  if (!content) return null
  for (const el of content) {
    if (el.table?.tableRows) {
      const filaPorCompromiso = new Map<number, number>()
      // deno-lint-ignore no-explicit-any
      el.table.tableRows.forEach((row: any, rowIndex: number) => {
        const celdas = row.tableCells ?? []
        // deno-lint-ignore no-explicit-any
        const runs = celdas.flatMap((c: any) => extraerRuns(c.content))
        const texto = runs.map((r: RunInfo) => r.text).join('')
        const m = texto.match(/\{compromiso(\d+)\}/)
        if (m) filaPorCompromiso.set(Number(m[1]), rowIndex)
      })
      if (filaPorCompromiso.size > 0) {
        return { startIndex: el.startIndex, filaPorCompromiso }
      }
    }
  }
  return null
}

/** Ubica la tabla de indicadores (la que contiene {indicadorN} en la última
 * celda de cada fila) y, para cada N, en qué rowIndex está su fila de
 * calificación — la fila de observación es siempre la siguiente. */
interface TablaIndicadores {
  startIndex: number
  filaPorIndicador: Map<number, number>
}

// deno-lint-ignore no-explicit-any
function localizarTablaIndicadores(content: any[] | undefined): TablaIndicadores | null {
  if (!content) return null
  for (const el of content) {
    if (el.table?.tableRows) {
      const filaPorIndicador = new Map<number, number>()
      // deno-lint-ignore no-explicit-any
      el.table.tableRows.forEach((row: any, rowIndex: number) => {
        const celdas = row.tableCells ?? []
        if (celdas.length < 2) return
        const runs = extraerRuns(celdas[celdas.length - 1].content)
        const texto = runs.map((r: RunInfo) => r.text).join('')
        const m = texto.match(/\{indicador(\d+)\}/)
        if (m) filaPorIndicador.set(Number(m[1]), rowIndex)
      })
      if (filaPorIndicador.size > 0) {
        return { startIndex: el.startIndex, filaPorIndicador }
      }
    }
  }
  return null
}

interface FilaABorrar {
  tableStartIndex: number
  rowIndex: number
  columnIndex: number
}

/** Combina las filas a borrar de ambas tablas (compromisos e indicadores) y
 * las ordena de abajo hacia arriba del documento completo — necesario porque
 * borrar filas en una tabla desplaza los índices de todo lo que viene
 * después, incluyendo el inicio de otra tabla más abajo. */
function ordenarFilasABorrar(filas: FilaABorrar[]): FilaABorrar[] {
  return [...filas].sort(
    (a, b) => b.tableStartIndex - a.tableStartIndex || b.rowIndex - a.rowIndex,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401)

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) {
      return jsonResponse({ error: 'No autorizado' }, 401)
    }

    const body = await req.json().catch(() => null)
    const visitaId = body?.visitaId
    if (!visitaId) return jsonResponse({ error: 'Falta visitaId' }, 400)

    // 1. Cargar todos los datos de la visita (RLS filtra: solo el dueño o coordinador).
    const { data: visita, error: visitaErr } = await userClient
      .from('visitas')
      .select(
        '*, instituciones(nombre), procesos(nombre, objetivo_fijo, plantilla_doc_id, abreviatura)',
      )
      .eq('id', visitaId)
      .single()
    if (visitaErr || !visita) {
      return jsonResponse({ error: 'Visita no encontrada o sin acceso' }, 404)
    }

    const plantillaDocId = visita.procesos?.plantilla_doc_id as string | null
    if (!plantillaDocId) {
      return jsonResponse(
        { error: 'Este proceso todavía no tiene una plantilla oficial configurada' },
        400,
      )
    }

    const { data: profesional, error: profErr } = await userClient
      .from('profesionales')
      .select('nombre, firma_url')
      .eq('id', visita.profesional_id)
      .single()
    if (profErr || !profesional) {
      return jsonResponse({ error: 'No se encontró el profesional de la visita' }, 404)
    }

    const { data: indicadores, error: indErr } = await userClient
      .from('indicadores')
      .select('id, area, aspecto, criterio, orden')
      .eq('proceso_id', visita.proceso_id)
      .order('orden')
    if (indErr) return jsonResponse({ error: indErr.message }, 500)

    const { data: respuestas } = await userClient
      .from('respuestas')
      .select('indicador_id, calificacion, observacion')
      .eq('visita_id', visitaId)
    const respuestasPorIndicador = new Map(
      (respuestas ?? []).map((r) => [r.indicador_id, r]),
    )

    const { data: compromisos } = await userClient
      .from('compromisos')
      .select('descripcion, responsable, fecha_verificacion')
      .eq('visita_id', visitaId)
      .order('created_at')

    const { data: camposExtra } = await userClient
      .from('campos_extra_procesos')
      .select('clave_campo')
      .eq('proceso_id', visita.proceso_id)
    const datosAdicionales = (visita.datos_adicionales ?? {}) as Record<string, unknown>

    // 2. Autenticarse ante Google como unidaddecalidadmanizales@gmail.com
    //    (OAuth con refresh token) — no con una cuenta de servicio, porque
    //    esas tienen 0 GB de cuota propia en Drive y no pueden ser dueñas de
    //    los documentos temporales que se copian aquí.
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')
    if (!clientId || !clientSecret || !refreshToken) {
      return jsonResponse(
        {
          error:
            'Faltan GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN en los secretos del proyecto',
        },
        500,
      )
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const docs = google.docs({ version: 'v1', auth: oauth2Client })
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // 3. Copiar la plantilla.
    const copia = await drive.files.copy({
      fileId: plantillaDocId,
      requestBody: { name: `tmp-informe-${visitaId}` },
    })
    const copiaId = copia.data.id!

    try {
      // 4. Leer la estructura del documento copiado para saber qué números
      //    de {indicadorN}/{observacionN} usa realmente esta plantilla.
      const docInicial = await docs.documents.get({ documentId: copiaId })
      const runsIniciales = extraerRuns(docInicial.data.body?.content)
      const numerosIndicador = extraerNumerosTag(runsIniciales, 'indicador')

      if (numerosIndicador.length < indicadores.length) {
        return jsonResponse(
          {
            error: `La plantilla solo tiene espacio para ${numerosIndicador.length} indicadores pero el proceso tiene ${indicadores.length} registrados. Agrega ${indicadores.length - numerosIndicador.length} fila(s) de indicador en la plantilla antes de generar el informe.`,
          },
          409,
        )
      }
      // Si la plantilla tiene más filas de indicador de las que el proceso
      // usa hoy (por ejemplo, tras eliminar uno desde la plataforma), las
      // filas sobrantes se emparejan con los últimos números de tag —en
      // orden de aparición— y se borran más abajo, igual que ya se hace con
      // los compromisos.
      const numerosIndicadorSobrantes = numerosIndicador.slice(indicadores.length)

      const numCompromisos = compromisos?.length ?? 0
      const tablaCompromisos = localizarTablaCompromisos(docInicial.data.body?.content)
      const tablaIndicadores = localizarTablaIndicadores(docInicial.data.body?.content)

      const filasABorrarCompromisos: FilaABorrar[] = tablaCompromisos
        ? [...tablaCompromisos.filaPorCompromiso]
            .filter(([n]) => n > numCompromisos)
            .map(([, rowIndex]) => ({
              tableStartIndex: tablaCompromisos.startIndex,
              rowIndex,
              columnIndex: 0,
            }))
        : []
      // columnIndex 3 (calificación) porque las columnas 0-1 (área/aspecto)
      // usan celdas combinadas verticalmente (rowSpan) entre indicadores de
      // un mismo grupo — deleteTableRow con columnIndex 0 ahí no resuelve
      // bien la fila real a borrar.
      const filasABorrarIndicadores: FilaABorrar[] = tablaIndicadores
        ? numerosIndicadorSobrantes.flatMap((n) => {
            const rowIndex = tablaIndicadores.filaPorIndicador.get(n)
            if (rowIndex === undefined) return []
            // La fila de "Observación" siempre queda inmediatamente después
            // de la fila de calificación del mismo indicador.
            return [
              { tableStartIndex: tablaIndicadores.startIndex, rowIndex, columnIndex: 3 },
              { tableStartIndex: tablaIndicadores.startIndex, rowIndex: rowIndex + 1, columnIndex: 3 },
            ]
          })
        : []
      const filasABorrar = ordenarFilasABorrar([
        ...filasABorrarCompromisos,
        ...filasABorrarIndicadores,
      ])

      // 5. Armar los reemplazos de texto.
      const resultado = visita.resultado_semaforo as string | null
      const reemplazos: Record<string, string> = {
        '{nvisita}': String(visita.numero_visita),
        '{fecha}': formatearFecha(visita.fecha),
        '{institucion}': visita.instituciones.nombre,
        '{horaInicio}': formatearHora(visita.hora_inicio),
        '{horaFin}': formatearHora(visita.hora_fin),
        '{objetivo}': fmt(visita.procesos.objetivo_fijo ?? visita.objetivo),
        '{actividadAdicional}': fmt(visita.actividad_adicional),
        '{segCompromisos}': fmt(visita.seguimiento_compromisos_anteriores),
        '{observacion}': fmt(visita.observaciones),
        '{semaforo}': fmt(resultado),
        '{numSemaforo}': resultado ? String(SEMAFORO_NUMERO[resultado] ?? '') : '—',
        '{profesional}': profesional.nombre,
      }

      indicadores.forEach((ind, i) => {
        const n = numerosIndicador[i]
        const r = respuestasPorIndicador.get(ind.id)
        reemplazos[`{criterio${n}}`] = ind.criterio
        reemplazos[`{indicador${n}}`] = fmt(r?.calificacion)
        reemplazos[`{observacion${n}}`] = fmt(r?.observacion)
      })

      // Solo se rellenan los tags de las filas que se conservan; las filas
      // sobrantes (sin compromiso) se eliminan de la copia más abajo.
      for (let i = 0; i < Math.min(numCompromisos, 4); i++) {
        const c = compromisos![i]
        reemplazos[`{compromiso${i + 1}}`] = c.descripcion
        reemplazos[`{responsable${i + 1}}`] = fmt(c.responsable)
        reemplazos[`{fechaVer${i + 1}}`] = formatearFechaOpcional(c.fecha_verificacion)
      }

      // Campos extra específicos del proceso (ej. Lengua extranjera:
      // {docentesIngles}, {horasPrimaria}...) — el nombre del tag es
      // exactamente `clave_campo`, guardado por CamposExtraForm en
      // `visita.datos_adicionales`.
      for (const campo of camposExtra ?? []) {
        const valor = datosAdicionales[campo.clave_campo]
        reemplazos[`{${campo.clave_campo}}`] =
          valor === null || valor === undefined || valor === '' ? '—' : String(valor)
      }

      // Las filas sobrantes se borran ANTES de sustituir texto, ya ordenadas
      // de abajo hacia arriba de todo el documento (ver ordenarFilasABorrar).
      const deleteRowRequests = filasABorrar.map(({ tableStartIndex, rowIndex, columnIndex }) => ({
        deleteTableRow: {
          tableCellLocation: {
            tableStartLocation: { index: tableStartIndex },
            rowIndex,
            columnIndex,
          },
        },
      }))

      const textRequests = Object.entries(reemplazos).map(([texto, valor]) => ({
        replaceAllText: {
          containsText: { text: texto, matchCase: true },
          replaceText: valor,
        },
      }))

      await docs.documents.batchUpdate({
        documentId: copiaId,
        requestBody: { requests: [...deleteRowRequests, ...textRequests] },
      })

      // 6. Insertar la imagen de la firma en el lugar de {firma}.
      const docTrasTexto = await docs.documents.get({ documentId: copiaId })
      const runsTrasTexto = extraerRuns(docTrasTexto.data.body?.content)
      const rangoFirma = ubicarTexto(runsTrasTexto, '{firma}')

      if (rangoFirma && profesional.firma_url) {
        await docs.documents.batchUpdate({
          documentId: copiaId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: { startIndex: rangoFirma.startIndex, endIndex: rangoFirma.endIndex },
                },
              },
              {
                insertInlineImage: {
                  location: { index: rangoFirma.startIndex },
                  uri: profesional.firma_url,
                  objectSize: {
                    height: { magnitude: 60, unit: 'PT' },
                    width: { magnitude: 150, unit: 'PT' },
                  },
                },
              },
            ],
          },
        })
      } else if (rangoFirma) {
        // Sin firma configurada: no debería llegar hasta aquí (la app lo
        // bloquea antes), pero por seguridad no dejamos el tag suelto.
        await docs.documents.batchUpdate({
          documentId: copiaId,
          requestBody: {
            requests: [
              {
                deleteContentRange: {
                  range: { startIndex: rangoFirma.startIndex, endIndex: rangoFirma.endIndex },
                },
              },
            ],
          },
        })
      }

      // 7. Exportar a PDF.
      const pdfResp = await drive.files.export(
        { fileId: copiaId, mimeType: 'application/pdf' },
        { responseType: 'arraybuffer' },
      )
      const pdfBytes = new Uint8Array(pdfResp.data as ArrayBuffer)

      // 8. Subir a Storage y marcar la visita como finalizada.
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const nombreArchivo = construirNombreArchivo(
        visita.fecha,
        visita.procesos.abreviatura ?? visita.procesos.nombre,
        visita.instituciones.nombre,
        visita.numero_visita,
      )
      const path = `pdfs/${nombreArchivo}`

      // Limpieza best-effort del PDF anterior (nombre viejo o regeneración
      // con un nombre distinto, p. ej. si cambió la institución o la fecha).
      if (visita.pdf_url) {
        const marcador = '/visitas/'
        const idx = visita.pdf_url.indexOf(marcador)
        if (idx !== -1) {
          const pathAnterior = decodeURIComponent(visita.pdf_url.slice(idx + marcador.length))
          if (pathAnterior && pathAnterior !== path) {
            await adminClient.storage.from('visitas').remove([pathAnterior]).catch(() => {})
          }
        }
      }
      await adminClient.storage.from('visitas').remove([`pdfs/${visitaId}.pdf`]).catch(() => {})

      const { error: uploadErr } = await adminClient.storage
        .from('visitas')
        .upload(path, pdfBytes, { upsert: true, contentType: 'application/pdf' })
      if (uploadErr) return jsonResponse({ error: uploadErr.message }, 500)

      const pdfUrl = adminClient.storage.from('visitas').getPublicUrl(path).data.publicUrl

      const { error: updateErr } = await userClient
        .from('visitas')
        .update({ pdf_url: pdfUrl, estado: 'finalizado' })
        .eq('id', visitaId)
      if (updateErr) return jsonResponse({ error: updateErr.message }, 500)

      return jsonResponse({ pdfUrl })
    } finally {
      // Limpieza best-effort de la copia temporal en Drive.
      await drive.files.delete({ fileId: copiaId }).catch(() => {})
    }
  } catch (e) {
    console.error(e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Error inesperado generando el PDF' },
      500,
    )
  }
})
