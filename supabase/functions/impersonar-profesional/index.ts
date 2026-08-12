import { createClient } from 'jsr:@supabase/supabase-js@2'

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

/**
 * Genera un magic link para que el administrador pueda "actuar como" un
 * profesional — una sesión real de esa persona (no una simulación), así que
 * ve y hace exactamente lo mismo que vería/haría esa cuenta. Restringido a
 * rol==='administrador' (coordinador queda afuera a propósito).
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
    if (!llamante || llamante.rol !== 'administrador') {
      return jsonResponse({ error: 'Solo el administrador puede actuar como otro profesional' }, 403)
    }

    const body = await req.json().catch(() => null)
    const profesionalId = body?.profesionalId as string | undefined
    if (!profesionalId) return jsonResponse({ error: 'Falta profesionalId' }, 400)

    const { data: objetivo, error: objetivoErr } = await admin
      .from('profesionales')
      .select('email, nombre, rol')
      .eq('id', profesionalId)
      .single()
    if (objetivoErr || !objetivo) return jsonResponse({ error: 'Profesional no encontrado' }, 404)
    if (objetivo.rol === 'administrador') {
      return jsonResponse({ error: 'No tiene sentido actuar como otra cuenta administrador' }, 400)
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: objetivo.email,
    })
    if (linkErr || !link) {
      return jsonResponse({ error: linkErr?.message ?? 'No se pudo generar el acceso' }, 500)
    }

    return jsonResponse({
      hashed_token: link.properties.hashed_token,
      profesionalNombre: objetivo.nombre,
    })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
