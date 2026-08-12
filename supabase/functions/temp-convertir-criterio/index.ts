import { createClient } from 'jsr:@supabase/supabase-js@2'
import { google } from 'npm:googleapis@144'

const SECRET = 'c42ad4056a82d851c06acd5f9ca1d7793093fa0efbb89698'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  })
}

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

/** Ubica, dentro de la tabla de indicadores, cada fila que contiene un tag
 * {indicadorN} y devuelve el texto actual de su celda de criterio (la
 * penúltima de las 4 columnas: ÁREA | ASPECTO | CRITERIO | CALIFICACIÓN). */
interface FilaIndicador {
  numero: number
  textoActualCriterio: string
}
// deno-lint-ignore no-explicit-any
function localizarCriterios(content: any[] | undefined): FilaIndicador[] {
  const encontrados: FilaIndicador[] = []
  if (!content) return encontrados
  for (const el of content) {
    if (el.table?.tableRows) {
      // deno-lint-ignore no-explicit-any
      for (const row of el.table.tableRows) {
        const celdas = row.tableCells ?? []
        if (celdas.length < 2) continue
        const celdaCalificacion = celdas[celdas.length - 1]
        // deno-lint-ignore no-explicit-any
        const runsCalificacion = extraerRuns(celdaCalificacion.content)
        const textoCalificacion = runsCalificacion.map((r) => r.text).join('')
        const m = textoCalificacion.match(/\{indicador(\d+)\}/)
        if (!m) continue
        const numero = Number(m[1])
        const celdaCriterio = celdas[celdas.length - 2]
        const runsCriterio = extraerRuns(celdaCriterio.content)
        const textoActualCriterio = runsCriterio
          .map((r) => r.text)
          .join('')
          .replace(/\n+$/, '')
        encontrados.push({ numero, textoActualCriterio })
      }
      // Las tablas también pueden tener sub-tablas anidadas (no es el caso
      // conocido aquí, pero por seguridad no se recorre recursivamente para
      // evitar contar dos veces).
    }
  }
  return encontrados
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  try {
    const body = await req.json().catch(() => null)
    if (body?.secret !== SECRET) return jsonResponse({ error: 'No autorizado' }, 401)
    const procesoClave = body?.procesoClave as string | undefined
    const dryRun = body?.dryRun !== false
    if (!procesoClave) return jsonResponse({ error: 'Falta procesoClave' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: proceso, error: procesoErr } = await admin
      .from('procesos')
      .select('id, nombre, plantilla_doc_id')
      .eq('clave', procesoClave)
      .single()
    if (procesoErr || !proceso) return jsonResponse({ error: 'Proceso no encontrado' }, 404)
    if (!proceso.plantilla_doc_id)
      return jsonResponse({ error: 'Proceso sin plantilla_doc_id' }, 400)

    const { data: indicadores } = await admin
      .from('indicadores')
      .select('id, criterio, orden')
      .eq('proceso_id', proceso.id)
      .order('orden')

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!
    const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')!
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const docs = google.docs({ version: 'v1', auth: oauth2Client })

    const doc = await docs.documents.get({ documentId: proceso.plantilla_doc_id })
    const filas = localizarCriterios(doc.data.body?.content)
    filas.sort((a, b) => a.numero - b.numero)

    const resultado = filas.map((f) => ({
      numero: f.numero,
      textoActual: f.textoActualCriterio,
      yaEsTag: /^\{criterio\d+\}$/.test(f.textoActualCriterio),
    }))

    if (dryRun) {
      return jsonResponse({
        dryRun: true,
        proceso: proceso.nombre,
        filasEnPlantilla: filas.length,
        indicadoresEnDB: (indicadores ?? []).length,
        filas: resultado,
      })
    }

    const pendientes = filas.filter((f) => !/^\{criterio\d+\}$/.test(f.textoActualCriterio))
    const requests = pendientes.map((f) => ({
      replaceAllText: {
        containsText: { text: f.textoActualCriterio, matchCase: true },
        replaceText: `{criterio${f.numero}}`,
      },
    }))

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: proceso.plantilla_doc_id,
        requestBody: { requests },
      })
    }

    // Verificación: releer y confirmar que cada {criterioN} quedó exactamente una vez.
    const docTrasCambio = await docs.documents.get({ documentId: proceso.plantilla_doc_id })
    const runsTrasCambio = extraerRuns(docTrasCambio.data.body?.content)
    const textoCompleto = runsTrasCambio.map((r) => r.text).join('')
    const verificacion = filas.map((f) => {
      const re = new RegExp(`\\{criterio${f.numero}\\}`, 'g')
      const apariciones = (textoCompleto.match(re) ?? []).length
      return { numero: f.numero, apariciones }
    })
    const conProblema = verificacion.filter((v) => v.apariciones !== 1)

    return jsonResponse({
      dryRun: false,
      proceso: proceso.nombre,
      filasEnPlantilla: filas.length,
      indicadoresEnDB: (indicadores ?? []).length,
      reemplazosAplicados: requests.length,
      conProblema,
    })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
