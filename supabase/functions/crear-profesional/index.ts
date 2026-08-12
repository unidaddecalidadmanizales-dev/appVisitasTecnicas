import { createClient } from 'jsr:@supabase/supabase-js@2'

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

/**
 * Contraseña con la que arranca todo profesional nuevo. Se fija aquí, en el
 * servidor, y no se recibe del cliente ni se pide en el formulario — mismo
 * criterio que `resetear-password`, y evita un campo más que llenar al crear
 * la cuenta. `debe_cambiar_password` en `profesionales` ya nace en `true` por
 * defecto (ver columna en el esquema), así que el primer ingreso exige
 * definir una propia sin que esta función tenga que marcar nada aparte.
 */
const PASSWORD_INICIAL = '12345678'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'No autorizado' }, 401)
  }

  try {
    // Cliente con el JWT de quien llama, para verificar su rol respetando RLS.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) {
      return jsonResponse({ error: 'No autorizado' }, 401)
    }

    const { data: esCoordinador, error: rolErr } = await userClient.rpc(
      'is_coordinador',
    )
    if (rolErr || !esCoordinador) {
      return jsonResponse(
        { error: 'Solo el coordinador puede crear profesionales' },
        403,
      )
    }

    const body = await req.json().catch(() => null)
    const nombre = body?.nombre?.trim()
    const email = body?.email?.trim()
    const rol = body?.rol

    if (!nombre || !email || !rol) {
      return jsonResponse({ error: 'Faltan campos requeridos' }, 400)
    }
    if (rol !== 'profesional' && rol !== 'coordinador') {
      return jsonResponse({ error: 'Rol inválido' }, 400)
    }

    // Cliente con service_role, solo para esta operación puntual — nunca se
    // expone al frontend, vive únicamente dentro de la Edge Function.
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: created, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password: PASSWORD_INICIAL,
        email_confirm: true,
        user_metadata: { nombre, rol },
      })

    if (createErr) {
      return jsonResponse({ error: createErr.message }, 400)
    }

    return jsonResponse({ id: created.user.id, email: created.user.email })
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Error inesperado' },
      500,
    )
  }
})
