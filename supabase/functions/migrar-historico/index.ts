import { createClient } from 'jsr:@supabase/supabase-js@2'
import { google } from 'npm:googleapis@144'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

const SEMAFORO_VALIDOS = new Set(['Existencia', 'Apropiación', 'Pertinencia', 'Mejora continua'])
const CALIFICACION_VALIDAS = new Set([
  'Existe',
  'No existe',
  'Existe con oportunidad de mejora',
  'No aplica',
])

function parseFecha(raw: string | undefined): string | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const [, d, mo, y] = m
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseHora(raw: string | undefined): string | null {
  if (!raw) return null
  const v = raw.trim()
  if (/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v)) return v
  return null
}

function limpio(raw: string | undefined): string | null {
  const v = (raw ?? '').trim()
  return v ? v : null
}

const VALORES_VACIOS = new Set(['ninguno', 'ninguna', 'no aplica', 'na', 'n/a'])
/** Como limpio(), pero además trata "Ninguno"/"No aplica"/etc. como vacío —
 * en las hojas históricas esos textos se usaban como placeholder cuando en
 * realidad no había compromiso, no como un compromiso real a migrar. */
function limpioCompromiso(raw: string | undefined): string | null {
  const v = limpio(raw)
  if (!v) return null
  return VALORES_VACIOS.has(v.toLowerCase()) ? null : v
}

// ---- Helpers de relleno de plantilla (mismo algoritmo que generar-pdf-google) ----
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
        if (pe.textRun?.content) out.push({ text: pe.textRun.content, startIndex: pe.startIndex })
      }
    }
    if (el.table?.tableRows) {
      for (const row of el.table.tableRows) {
        for (const cell of row.tableCells ?? []) extraerRuns(cell.content, out)
      }
    }
  }
  return out
}
function ubicarTexto(runs: RunInfo[], needle: string) {
  for (const run of runs) {
    const idx = run.text.indexOf(needle)
    if (idx !== -1) {
      return { startIndex: run.startIndex + idx, endIndex: run.startIndex + idx + needle.length }
    }
  }
  return null
}
function extraerNumerosTag(runs: RunInfo[], prefijo: 'indicador' | 'observacion'): number[] {
  const texto = runs.map((r) => r.text).join('')
  const re = new RegExp(`\\{${prefijo}(\\d+)\\}`, 'g')
  const numeros: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) numeros.push(Number(m[1]))
  return numeros
}
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
      if (filaPorCompromiso.size > 0) return { startIndex: el.startIndex, filaPorCompromiso }
    }
  }
  return null
}
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
      if (filaPorIndicador.size > 0) return { startIndex: el.startIndex, filaPorIndicador }
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
function formatearFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}
function formatearFechaOpcional(fecha: string | null | undefined) {
  return fecha ? formatearFecha(fecha) : '—'
}
function fmt(value: string | null | undefined) {
  return value && value.trim() ? value : '—'
}
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
const SEMAFORO_NUMERO: Record<string, number> = {
  Existencia: 1,
  Apropiación: 2,
  Pertinencia: 3,
  'Mejora continua': 4,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Método no permitido' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'No autorizado' }, 401)

  try {
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return jsonResponse({ error: 'No autorizado' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: llamante } = await admin
      .from('profesionales')
      .select('rol')
      .eq('id', userData.user.id)
      .single()
    if (!llamante || (llamante.rol !== 'coordinador' && llamante.rol !== 'administrador')) {
      return jsonResponse({ error: 'Solo coordinador o administrador pueden migrar histórico' }, 403)
    }

    const body = await req.json().catch(() => null)
    const procesoClave = body?.procesoClave as string | undefined
    const dryRun = body?.dryRun !== false // por defecto true (a menos que se pida explícitamente false)
    const offset = Number(body?.offset ?? 0)
    const limit = Number(body?.limit ?? 10)
    if (!procesoClave) return jsonResponse({ error: 'Falta procesoClave' }, 400)

    const { data: proceso, error: procesoErr } = await admin
      .from('procesos')
      .select('id, nombre, objetivo_fijo, plantilla_doc_id, consolidado_sheet_id, abreviatura')
      .eq('clave', procesoClave)
      .single()
    if (procesoErr || !proceso) return jsonResponse({ error: 'Proceso no encontrado' }, 404)
    if (!proceso.consolidado_sheet_id)
      return jsonResponse({ error: 'Este proceso no tiene consolidado_sheet_id configurado' }, 400)
    if (!proceso.plantilla_doc_id)
      return jsonResponse({ error: 'Este proceso no tiene plantilla_doc_id configurado' }, 400)

    const { data: indicadores } = await admin
      .from('indicadores')
      .select('id, criterio, orden')
      .eq('proceso_id', proceso.id)
      .order('orden')
    const { data: camposExtra } = await admin
      .from('campos_extra_procesos')
      .select('clave_campo, etiqueta, orden')
      .eq('proceso_id', proceso.id)
      .order('orden')
    const { data: instituciones } = await admin.from('instituciones').select('id, nombre')
    const { data: profesionales } = await admin.from('profesionales').select('id, nombre, email')

    const institucionPorNombre = new Map<string, string>()
    for (const i of instituciones ?? []) institucionPorNombre.set(i.nombre.trim().toLowerCase(), i.id)
    const profesionalPorEmail = new Map<string, { id: string; nombre: string }>()
    for (const p of profesionales ?? []) {
      if (p.email) profesionalPorEmail.set(p.email.trim().toLowerCase(), { id: p.id, nombre: p.nombre })
    }

    // ---- 1. Leer la hoja "Consolidado informes {proceso}" ----
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!
    const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')!
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const tokenData = await tokenResp.json()
    if (!tokenResp.ok) return jsonResponse({ error: 'oauth: ' + JSON.stringify(tokenData) }, 500)
    const accessToken = tokenData.access_token as string

    // PEI llega a 221 columnas (96 indicadores x 2 + fijas) — DZ (columna 130) se
    // quedaba corto y cortaba OBSERVACIONES/SEMAFORO/EMAIL al final de la fila.
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${proceso.consolidado_sheet_id}/values/A1:ZZ3000`
    const sheetsResp = await fetch(sheetsUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
    const sheetsData = await sheetsResp.json()
    if (!sheetsResp.ok) return jsonResponse({ error: 'sheets: ' + JSON.stringify(sheetsData) }, 500)
    const filas: string[][] = sheetsData.values ?? []

    const headerRowIndex = filas.findIndex((f) => f.includes('PROFESIONAL'))
    if (headerRowIndex === -1) return jsonResponse({ error: 'No se encontró la fila de encabezados (PROFESIONAL)' }, 500)
    const header = filas[headerRowIndex]

    const idx = (nombre: string) => header.indexOf(nombre)
    const idxProfesional = idx('PROFESIONAL')
    const idxFecha = idx('FECHA VISITA')
    const idxInstitucion = idx('INSTITUCIÓN')
    const idxHoraInicio = idx('HORA INICIO')
    const idxHoraFin = idx('HORA FINALIZACIÓN')
    const idxActividad = idx('ACTIVIDADES ADICIONALES')
    const idxSeguimiento = idx('SEGUIMIENTO A COMPROMISOS')
    const idxObservacionesGenerales = idx('OBSERVACIONES')
    const idxObjetivo = idx('OBJETIVO')
    const idxSemaforo = idx('SEMAFORO')
    const idxEmail = header.findIndex((h) => h.toUpperCase().includes('EMAIL'))

    const faltantes = [
      ['PROFESIONAL', idxProfesional],
      ['FECHA VISITA', idxFecha],
      ['INSTITUCIÓN', idxInstitucion],
      ['SEGUIMIENTO A COMPROMISOS', idxSeguimiento],
      ['OBSERVACIONES', idxObservacionesGenerales],
      ['SEMAFORO', idxSemaforo],
      ['EMAIL', idxEmail],
    ].filter(([, i]) => (i as number) === -1)
    if (faltantes.length > 0) {
      return jsonResponse({ error: `Columnas no encontradas en la hoja: ${faltantes.map((f) => f[0]).join(', ')}` }, 500)
    }

    const nInd = (indicadores ?? []).length
    const inicioIndicadores = idxSeguimiento + 1

    // Normalmente son 2*nInd columnas consecutivas justo después de SEGUIMIENTO
    // A COMPROMISOS, pero plantillas como la de PEI tienen columnas en blanco
    // intercaladas (indicadores que se eliminaron del catálogo en su momento),
    // así que se detectan los pares (criterio, "Observaciones") en lugar de
    // asumir posiciones fijas.
    const indicadorCols: number[] = []
    for (let c = inicioIndicadores; c < header.length && indicadorCols.length < nInd; c++) {
      if (header[c + 1] === 'Observaciones') {
        indicadorCols.push(c)
        c++
      }
    }
    if (indicadorCols.length !== nInd) {
      return jsonResponse(
        {
          error: `Se esperaban ${nInd} indicadores pero se detectaron ${indicadorCols.length} pares (criterio, Observaciones) en la hoja.`,
        },
        500,
      )
    }

    const nExtra = (camposExtra ?? []).length
    const inicioExtra = indicadorCols[indicadorCols.length - 1] + 2

    const idxCompromiso = [1, 2, 3, 4].map((n) => idx(`COMPROMISO ${n}`))
    const idxResponsable = [1, 2, 3, 4].map((n) => idx(`RESPONSABLE ${n}`))
    const idxFechaVer = [1, 2, 3, 4].map((n) => idx(`FECHA VERIFICACIÓN ${n}`))

    // ---- 2. Parsear filas de datos ----
    interface Candidata {
      filaSheet: number
      profesionalEmail: string
      profesionalNombreSheet: string
      institucionId: string
      fecha: string
      hora_inicio: string | null
      hora_fin: string | null
      actividad_adicional: string | null
      seguimiento: string | null
      objetivo: string | null
      observaciones: string | null
      semaforo: string | null
      respuestas: { indicador_id: string; calificacion: string; observacion: string | null }[]
      compromisos: { descripcion: string; responsable: string | null; fecha_verificacion: string | null }[]
      datosAdicionales: Record<string, string>
    }
    const validas: Candidata[] = []
    const omitidas: { fila: number; motivo: string }[] = []
    const advertencias: string[] = []
    const profesionalesNuevos = new Set<string>()

    for (let r = headerRowIndex + 1; r < filas.length; r++) {
      const fila = filas[r]
      if (!fila || !fila[idxProfesional]?.trim()) continue // fila vacía

      const nombreSheet = fila[idxProfesional].trim()
      const email = (fila[idxEmail] ?? '').trim().toLowerCase()
      const fecha = parseFecha(fila[idxFecha])
      const nombreInstitucion = (fila[idxInstitucion] ?? '').trim()
      const institucionId = institucionPorNombre.get(nombreInstitucion.toLowerCase())

      if (!email) {
        omitidas.push({ fila: r + 1, motivo: `Sin email de profesional (${nombreSheet})` })
        continue
      }
      if (!fecha) {
        omitidas.push({ fila: r + 1, motivo: `Fecha inválida: "${fila[idxFecha] ?? ''}"` })
        continue
      }
      if (!institucionId) {
        omitidas.push({ fila: r + 1, motivo: `Institución no encontrada: "${nombreInstitucion}"` })
        continue
      }
      if (!profesionalPorEmail.has(email)) {
        profesionalesNuevos.add(`${nombreSheet} <${email}>`)
      }

      const respuestas: Candidata['respuestas'] = []
      for (let i = 0; i < nInd; i++) {
        const colCrit = indicadorCols[i]
        const colObs = colCrit + 1
        const calRaw = (fila[colCrit] ?? '').trim()
        if (!calRaw) continue
        if (!CALIFICACION_VALIDAS.has(calRaw)) {
          advertencias.push(`Fila ${r + 1}: calificación no reconocida "${calRaw}" (indicador #${i + 1}) — se omite esa respuesta`)
          continue
        }
        respuestas.push({
          indicador_id: (indicadores ?? [])[i].id,
          calificacion: calRaw,
          observacion: limpio(fila[colObs]),
        })
      }

      const datosAdicionales: Record<string, string> = {}
      for (let i = 0; i < nExtra; i++) {
        const val = limpio(fila[inicioExtra + i])
        if (val) datosAdicionales[(camposExtra ?? [])[i].clave_campo] = val
      }

      const compromisos: Candidata['compromisos'] = []
      for (let i = 0; i < 4; i++) {
        const desc = limpioCompromiso(fila[idxCompromiso[i]])
        if (!desc) continue
        compromisos.push({
          descripcion: desc,
          responsable: limpio(fila[idxResponsable[i]]),
          fecha_verificacion: parseFecha(fila[idxFechaVer[i]]),
        })
      }

      const semaforoRaw = (fila[idxSemaforo] ?? '').trim()
      if (semaforoRaw && !SEMAFORO_VALIDOS.has(semaforoRaw)) {
        advertencias.push(`Fila ${r + 1}: semáforo no reconocido "${semaforoRaw}" — queda sin resultado`)
      }

      validas.push({
        filaSheet: r + 1,
        profesionalEmail: email,
        profesionalNombreSheet: nombreSheet,
        institucionId,
        fecha,
        hora_inicio: parseHora(fila[idxHoraInicio]),
        hora_fin: parseHora(fila[idxHoraFin]),
        actividad_adicional: limpio(fila[idxActividad]),
        seguimiento: limpio(fila[idxSeguimiento]),
        objetivo: proceso.objetivo_fijo ? null : limpio(fila[idxObjetivo]),
        observaciones: limpio(fila[idxObservacionesGenerales]),
        semaforo: SEMAFORO_VALIDOS.has(semaforoRaw) ? semaforoRaw : null,
        respuestas,
        compromisos,
        datosAdicionales,
      })
    }

    // ---- 3. Numeración por institución (orden cronológico) ----
    const porInstitucion = new Map<string, Candidata[]>()
    for (const c of validas) {
      if (!porInstitucion.has(c.institucionId)) porInstitucion.set(c.institucionId, [])
      porInstitucion.get(c.institucionId)!.push(c)
    }
    const numeroPorFila = new Map<number, number>()
    for (const grupo of porInstitucion.values()) {
      grupo.sort((a, b) => a.fecha.localeCompare(b.fecha))
      grupo.forEach((c, i) => numeroPorFila.set(c.filaSheet, i + 1))
    }

    if (dryRun) {
      return jsonResponse({
        dryRun: true,
        proceso: proceso.nombre,
        totalFilasHoja: filas.length - headerRowIndex - 1,
        validas: validas.length,
        omitidas,
        advertencias,
        profesionalesNuevos: Array.from(profesionalesNuevos),
        indicadoresEsperados: nInd,
        camposExtraEsperados: nExtra,
        ejemplo: validas[0]
          ? { ...validas[0], numero_visita: numeroPorFila.get(validas[0].filaSheet) }
          : null,
      })
    }

    // ---- 4. Escritura real (con OAuth de Google para Docs/Drive) ----
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const docs = google.docs({ version: 'v1', auth: oauth2Client })
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const lote = validas.slice(offset, offset + limit)
    const resultados: { fila: number; estado: string; detalle?: string }[] = []

    for (const c of lote) {
      try {
        // Profesional: resolver o crear.
        let profesional = profesionalPorEmail.get(c.profesionalEmail)
        if (!profesional) {
          const { data: creado, error: createErr } = await admin.auth.admin.createUser({
            email: c.profesionalEmail,
            password: crypto.randomUUID() + crypto.randomUUID(),
            email_confirm: true,
            user_metadata: { nombre: c.profesionalNombreSheet, rol: 'profesional' },
          })
          if (createErr || !creado.user) throw new Error('No se pudo crear profesional: ' + createErr?.message)
          profesional = { id: creado.user.id, nombre: c.profesionalNombreSheet }
          profesionalPorEmail.set(c.profesionalEmail, profesional)
        }

        // Evitar duplicados si esta fila ya se migró en una corrida anterior.
        const { data: existente } = await admin
          .from('visitas')
          .select('id')
          .eq('institucion_id', c.institucionId)
          .eq('proceso_id', proceso.id)
          .eq('profesional_id', profesional.id)
          .eq('fecha', c.fecha)
          .maybeSingle()
        if (existente) {
          resultados.push({ fila: c.filaSheet, estado: 'ya_existia' })
          continue
        }

        const { data: profesionalFirma } = await admin
          .from('profesionales')
          .select('firma_url')
          .eq('id', profesional.id)
          .single()

        const { data: visitaInsertada, error: visErr } = await admin
          .from('visitas')
          .insert({
            institucion_id: c.institucionId,
            proceso_id: proceso.id,
            profesional_id: profesional.id,
            numero_visita: numeroPorFila.get(c.filaSheet) ?? 1,
            fecha: c.fecha,
            hora_inicio: c.hora_inicio,
            hora_fin: c.hora_fin,
            objetivo: c.objetivo,
            actividad_adicional: c.actividad_adicional,
            seguimiento_compromisos_anteriores: c.seguimiento,
            observaciones: c.observaciones,
            resultado_semaforo: c.semaforo,
            datos_adicionales: c.datosAdicionales,
            estado: 'finalizado',
          })
          .select()
          .single()
        if (visErr || !visitaInsertada) throw new Error('insert visita: ' + visErr?.message)
        const visitaId = visitaInsertada.id as string

        if (c.respuestas.length > 0) {
          const { error: respErr } = await admin.from('respuestas').insert(
            c.respuestas.map((r) => ({ ...r, visita_id: visitaId })),
          )
          if (respErr) throw new Error('insert respuestas: ' + respErr.message)
        }
        if (c.compromisos.length > 0) {
          const { error: compErr } = await admin.from('compromisos').insert(
            c.compromisos.map((cp) => ({ ...cp, visita_id: visitaId })),
          )
          if (compErr) throw new Error('insert compromisos: ' + compErr.message)
        }

        // ---- Generar PDF (mismo algoritmo que generar-pdf-google) ----
        const copia = await drive.files.copy({
          fileId: proceso.plantilla_doc_id!,
          requestBody: { name: `tmp-informe-${visitaId}` },
        })
        const copiaId = copia.data.id!
        try {
          const docInicial = await docs.documents.get({ documentId: copiaId })
          const runsIniciales = extraerRuns(docInicial.data.body?.content)
          const numerosIndicador = extraerNumerosTag(runsIniciales, 'indicador')
          if (numerosIndicador.length < nInd) {
            throw new Error(
              `La plantilla solo tiene espacio para ${numerosIndicador.length} indicadores pero el proceso tiene ${nInd} registrados.`,
            )
          }
          const numerosIndicadorSobrantes = numerosIndicador.slice(nInd)

          const numCompromisos = c.compromisos.length
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

          const resultadoSemaforo = c.semaforo
          const reemplazos: Record<string, string> = {
            '{nvisita}': String(numeroPorFila.get(c.filaSheet) ?? 1),
            '{fecha}': formatearFecha(c.fecha),
            '{institucion}': (instituciones ?? []).find((i) => i.id === c.institucionId)!.nombre,
            '{horaInicio}': formatearHora(c.hora_inicio),
            '{horaFin}': formatearHora(c.hora_fin),
            '{objetivo}': fmt(proceso.objetivo_fijo ?? c.objetivo),
            '{actividadAdicional}': fmt(c.actividad_adicional),
            '{segCompromisos}': fmt(c.seguimiento),
            '{observacion}': fmt(c.observaciones),
            '{semaforo}': fmt(resultadoSemaforo),
            '{numSemaforo}': resultadoSemaforo ? String(SEMAFORO_NUMERO[resultadoSemaforo] ?? '') : '—',
            '{profesional}': profesional.nombre,
          }
          const respuestasPorIndicador = new Map(c.respuestas.map((r) => [r.indicador_id, r]))
          ;(indicadores ?? []).forEach((ind, i) => {
            const n = numerosIndicador[i]
            const r = respuestasPorIndicador.get(ind.id)
            reemplazos[`{criterio${n}}`] = ind.criterio
            reemplazos[`{indicador${n}}`] = fmt(r?.calificacion)
            reemplazos[`{observacion${n}}`] = fmt(r?.observacion)
          })
          c.compromisos.forEach((cp, i) => {
            reemplazos[`{compromiso${i + 1}}`] = cp.descripcion
            reemplazos[`{responsable${i + 1}}`] = fmt(cp.responsable)
            reemplazos[`{fechaVer${i + 1}}`] = formatearFechaOpcional(cp.fecha_verificacion)
          })
          for (const [clave, valor] of Object.entries(c.datosAdicionales)) {
            reemplazos[`{${clave}}`] = valor
          }

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
            replaceAllText: { containsText: { text: texto, matchCase: true }, replaceText: valor },
          }))
          await docs.documents.batchUpdate({
            documentId: copiaId,
            requestBody: { requests: [...deleteRowRequests, ...textRequests] },
          })

          const docTrasTexto = await docs.documents.get({ documentId: copiaId })
          const runsTrasTexto = extraerRuns(docTrasTexto.data.body?.content)
          const rangoFirma = ubicarTexto(runsTrasTexto, '{firma}')
          if (rangoFirma && profesionalFirma?.firma_url) {
            await docs.documents.batchUpdate({
              documentId: copiaId,
              requestBody: {
                requests: [
                  { deleteContentRange: { range: { startIndex: rangoFirma.startIndex, endIndex: rangoFirma.endIndex } } },
                  {
                    insertInlineImage: {
                      location: { index: rangoFirma.startIndex },
                      uri: profesionalFirma.firma_url,
                      objectSize: { height: { magnitude: 60, unit: 'PT' }, width: { magnitude: 150, unit: 'PT' } },
                    },
                  },
                ],
              },
            })
          } else if (rangoFirma) {
            await docs.documents.batchUpdate({
              documentId: copiaId,
              requestBody: {
                requests: [{ deleteContentRange: { range: { startIndex: rangoFirma.startIndex, endIndex: rangoFirma.endIndex } } }],
              },
            })
          }

          const pdfResp = await drive.files.export(
            { fileId: copiaId, mimeType: 'application/pdf' },
            { responseType: 'arraybuffer' },
          )
          const pdfBytes = new Uint8Array(pdfResp.data as ArrayBuffer)
          const nombreArchivo = construirNombreArchivo(
            c.fecha,
            proceso.abreviatura ?? proceso.nombre,
            (instituciones ?? []).find((i) => i.id === c.institucionId)!.nombre,
            numeroPorFila.get(c.filaSheet) ?? 1,
          )
          const path = `pdfs/${nombreArchivo}`
          const { error: uploadErr } = await admin.storage
            .from('visitas')
            .upload(path, pdfBytes, { upsert: true, contentType: 'application/pdf' })
          if (uploadErr) throw new Error('upload pdf: ' + uploadErr.message)
          const pdfUrl = admin.storage.from('visitas').getPublicUrl(path).data.publicUrl
          await admin.from('visitas').update({ pdf_url: pdfUrl }).eq('id', visitaId)

          resultados.push({ fila: c.filaSheet, estado: 'migrada' })
        } finally {
          await drive.files.delete({ fileId: copiaId }).catch(() => {})
        }
      } catch (e) {
        resultados.push({ fila: c.filaSheet, estado: 'error', detalle: e instanceof Error ? e.message : String(e) })
      }
    }

    return jsonResponse({
      dryRun: false,
      proceso: proceso.nombre,
      totalValidas: validas.length,
      offset,
      limit,
      procesadasEnEstaCorrida: lote.length,
      hasMore: offset + limit < validas.length,
      nextOffset: offset + limit < validas.length ? offset + limit : null,
      resultados,
      omitidasEnParseo: omitidas,
      advertencias,
    })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
