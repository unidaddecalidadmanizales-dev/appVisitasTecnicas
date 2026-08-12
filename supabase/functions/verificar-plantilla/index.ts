import { createClient } from 'jsr:@supabase/supabase-js@2'
import { google } from 'npm:googleapis@144'

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
function extraerNumerosTag(runs: RunInfo[]): number[] {
  const texto = runs.map((r) => r.text).join('')
  const re = /\{indicador(\d+)\}/g
  const numeros: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) numeros.push(Number(m[1]))
  return numeros
}

/**
 * Compara la cantidad de indicadores del proceso contra la cantidad de tags
 * {indicadorN} que realmente tiene su plantilla de Google Docs — la única
 * forma de saber, antes de intentar generar un PDF, si agregar un indicador
 * nuevo va a necesitar también agregar una fila a mano en la plantilla.
 */
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
      return jsonResponse({ error: 'Solo coordinador o administrador pueden verificar la plantilla' }, 403)
    }

    const body = await req.json().catch(() => null)
    const procesoId = body?.procesoId as string | undefined
    if (!procesoId) return jsonResponse({ error: 'Falta procesoId' }, 400)

    const { data: proceso, error: procesoErr } = await admin
      .from('procesos')
      .select('plantilla_doc_id')
      .eq('id', procesoId)
      .single()
    if (procesoErr || !proceso) return jsonResponse({ error: 'Proceso no encontrado' }, 404)
    if (!proceso.plantilla_doc_id) {
      return jsonResponse({ error: 'Este proceso todavía no tiene una plantilla oficial configurada' }, 400)
    }

    const { count: actual, error: countErr } = await admin
      .from('indicadores')
      .select('id', { count: 'exact', head: true })
      .eq('proceso_id', procesoId)
    if (countErr) return jsonResponse({ error: countErr.message }, 500)

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!
    const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')!
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials({ refresh_token: refreshToken })
    const docs = google.docs({ version: 'v1', auth: oauth2Client })

    const doc = await docs.documents.get({ documentId: proceso.plantilla_doc_id })
    const runs = extraerRuns(doc.data.body?.content)
    const capacidad = extraerNumerosTag(runs).length

    return jsonResponse({ capacidad, actual: actual ?? 0, disponible: capacidad - (actual ?? 0) })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
