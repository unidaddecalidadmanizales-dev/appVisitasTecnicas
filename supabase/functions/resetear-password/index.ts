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
 * Contraseña a la que se devuelve la cuenta. Se fija aquí, en el servidor, y
 * no se recibe del cliente: así nadie puede pedir un reseteo a una contraseña
 * elegida por él para luego entrar como esa persona.
 */
const PASSWORD_INICIAL = '12345678'

/**
 * Devuelve la contraseña de un profesional a la inicial y lo obliga a definir
 * una propia en su siguiente ingreso (`debe_cambiar_password = true`, que es
 * lo que revisa AppShell). Lo puede hacer el coordinador o el administrador.
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
    if (!llamante || !['coordinador', 'administrador'].includes(llamante.rol)) {
      return jsonResponse(
        { error: 'Solo el coordinador o el administrador pueden resetear contraseñas' },
        403,
      )
    }

    const body = await req.json().catch(() => null)
    const profesionalId = body?.profesionalId as string | undefined
    if (!profesionalId) return jsonResponse({ error: 'Falta profesionalId' }, 400)

    const { data: objetivo, error: objetivoErr } = await admin
      .from('profesionales')
      .select('nombre, rol')
      .eq('id', profesionalId)
      .single()
    if (objetivoErr || !objetivo) return jsonResponse({ error: 'Profesional no encontrado' }, 404)

    // La cuenta administrador es la llave maestra del sistema: dejar que un
    // coordinador la devuelva a una contraseña conocida sería entregarle esa
    // llave. Su contraseña solo se cambia desde su propio Perfil.
    if (objetivo.rol === 'administrador') {
      return jsonResponse(
        { error: 'La contraseña de la cuenta administrador no se puede resetear desde aquí' },
        403,
      )
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(profesionalId, {
      password: PASSWORD_INICIAL,
    })
    if (updateErr) return jsonResponse({ error: updateErr.message }, 500)

    // Marca el cambio obligatorio. Si esto fallara, la persona quedaría con la
    // contraseña conocida y sin obligación de cambiarla, así que se reporta
    // como error aunque la contraseña ya se haya cambiado.
    const { error: flagErr } = await admin
      .from('profesionales')
      .update({ debe_cambiar_password: true })
      .eq('id', profesionalId)
    if (flagErr) {
      return jsonResponse(
        {
          error:
            'La contraseña se reseteó, pero no se pudo marcar el cambio obligatorio: ' +
            flagErr.message,
        },
        500,
      )
    }

    return jsonResponse({
      profesionalNombre: objetivo.nombre,
      passwordInicial: PASSWORD_INICIAL,
    })
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Error inesperado' }, 500)
  }
})
