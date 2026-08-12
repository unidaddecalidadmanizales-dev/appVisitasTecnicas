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

    // Impersonar inicia una sesión real, y GoTrue sobrescribe con ella el
    // `last_sign_in_at` del profesional — un único valor, sin historia. Se
    // guarda el valor previo ANTES de generar el enlace para que la columna
    // "Última conexión" siga mostrando cuándo entró esa persona de verdad y
    // no cuándo el administrador entró a su cuenta.
    const { data: authObjetivo, error: authErr } =
      await admin.auth.admin.getUserById(profesionalId)
    if (authErr) return jsonResponse({ error: authErr.message }, 500)

    const { error: registroErr } = await admin.from('impersonaciones').insert({
      admin_id: userData.user.id,
      profesional_id: profesionalId,
      conexion_previa: authObjetivo?.user?.last_sign_in_at ?? null,
    })
    // Se corta aquí a propósito: sin este registro la impersonación falsearía
    // la última conexión de esa persona y no quedaría rastro de quién entró a
    // su cuenta. Es preferible no impersonar a hacerlo sin dejar huella.
    if (registroErr) {
      return jsonResponse(
        { error: 'No se pudo registrar la impersonación: ' + registroErr.message },
        500,
      )
    }

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: objetivo.email,
    })
    if (linkErr || !link) {
      return jsonResponse({ error: linkErr?.message ?? 'No se pudo generar el acceso' }, 500)
    }

    // `generateLink` busca por correo y, con signups habilitados, crearía un
    // usuario nuevo si ese correo no existiera en Auth (p. ej. si alguien editó
    // el email en `profesionales` sin actualizar Auth). Eso dejaría al
    // administrador dentro de una cuenta huérfana, sin fila en `profesionales`
    // y sin rol. Se verifica que el enlace sea del usuario que se pidió.
    if (link.user?.id !== profesionalId) {
      return jsonResponse(
        {
          error:
            'El correo de este profesional no coincide con su cuenta de acceso. ' +
            'Corrige el correo antes de actuar como esta persona.',
        },
        409,
      )
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
