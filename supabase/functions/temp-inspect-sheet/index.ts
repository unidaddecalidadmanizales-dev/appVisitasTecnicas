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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  try {
    const body = await req.json().catch(() => null)
    if (body?.secret !== SECRET) return jsonResponse({ error: 'No autorizado' }, 401)

    const path = body?.deleteStoragePath as string | undefined
    if (path) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { error } = await admin.storage.from('visitas').remove([path])
      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ ok: true })
    }

    const driveFileId = body?.deleteDriveFileId as string | undefined
    if (driveFileId) {
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!
      const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!
      const refreshToken = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')!
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
      oauth2Client.setCredentials({ refresh_token: refreshToken })
      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      await drive.files.delete({ fileId: driveFileId })
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Falta deleteStoragePath o deleteDriveFileId' }, 400)
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
