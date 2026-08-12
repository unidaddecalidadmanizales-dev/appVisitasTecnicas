import { createClient } from 'jsr:@supabase/supabase-js@2'

const SECRET = 'c42ad4056a82d851c06acd5f9ca1d7793093fa0efbb89698'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  try {
    const body = await req.json().catch(() => null)
    if (body?.secret !== SECRET) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: CORS_HEADERS,
      })
    }
    const email = body?.email as string | undefined
    if (!email) {
      return new Response(JSON.stringify({ error: 'Falta email' }), {
        status: 400,
        headers: CORS_HEADERS,
      })
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (error || !data) {
      return new Response(JSON.stringify({ error: error?.message ?? 'Error generando link' }), {
        status: 500,
        headers: CORS_HEADERS,
      })
    }
    return new Response(JSON.stringify({ hashed_token: data.properties.hashed_token }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Error inesperado' }),
      { status: 500, headers: CORS_HEADERS },
    )
  }
})
