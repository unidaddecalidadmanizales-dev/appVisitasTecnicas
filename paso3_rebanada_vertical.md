# Paso 3 — Rebanada vertical: Servicio social

Objetivo: validar todo el flujo (auth → diligenciar → cerrar → PDF) con el proceso
más simple del catálogo, antes de generalizar a los 18 procesos.

## Ya preparado en Supabase (project ref `aavsfxynlrlcxfpzcfyl`)

- **Trigger `on_auth_user_created`**: al registrarse un usuario en Supabase Auth,
  se crea automáticamente su fila en `profesionales` (rol por defecto `'profesional'`,
  tomando `nombre`/`rol` de `raw_user_meta_data` si el signup los envía).
- **Institución de prueba**: `IE Rural La Trinidad` — id `89e6666e-08c9-4cd1-a12a-b8b7f51fd378`.
- **Proceso de prueba**: `servicio_social` — id `8ca6650c-65e5-4558-932d-30dfa2a5555c`
  (3 indicadores, área única "Gestión comunitaria", sin campos extra — el caso más simple).

## Pendiente manual (después de que exista la pantalla de login/signup)

1. Registrarse una vez desde la app con estos metadatos en el signup:
   `{ nombre: "Tu nombre", rol: "coordinador" }` — así tu primer usuario queda
   como coordinador y puede ver todo.
2. Crear la asignación de prueba con el `id` que te devuelva ese signup:
   ```sql
   insert into asignaciones (institucion_id, proceso_id, profesional_id)
   values (
     '89e6666e-08c9-4cd1-a12a-b8b7f51fd378',
     '8ca6650c-65e5-4558-932d-30dfa2a5555c',
     '<tu-user-id-de-auth.users>'
   );
   ```
   (Tráemelo cuando lo tengas y lo corro yo, o lo corres tú desde el SQL Editor de Supabase.)

## Spec del wizard (`VisitaWizard`, probado con Servicio social)

**Paso 1 — Datos generales**
- Campos: `fecha`, `hora_inicio`, `hora_fin`, `objetivo` (libre), `actividad_adicional`,
  `seguimiento_compromisos_anteriores`.
- Al guardar, crea la fila en `visitas` con `estado = 'borrador'` y calcula
  `numero_visita` como `count(*) + 1` para esa `institucion_id + proceso_id`.

**Paso 2 — Checklist**
- Carga `indicadores` donde `proceso_id = servicio_social` (3 filas), agrupados por `area`
  (en este caso una sola sección: "Gestión comunitaria").
- Por indicador: `calificacion` (select con las 4 opciones) + `observacion` (textarea).
- Guardar cada respuesta en `respuestas` con `upsert` sobre `(visita_id, indicador_id)`
  — esto es lo que permite el autosave/borrador sin duplicar filas.
- Servicio social no tiene `campos_extra_procesos`, así que el paso 2 no debe intentar
  renderizar ese bloque — el componente `CamposExtraForm` debe simplemente no montarse
  si la query devuelve un array vacío (así se prueba también esa rama del componente genérico).

**Paso 3 — Cierre**
- `CompromisosForm`: lista editable (agregar/quitar filas), cada una con
  `descripcion`, `responsable`, `fecha_verificacion`. No hay límite de 4 como en las
  plantillas viejas — se guarda como filas en `compromisos`, no como columnas fijas.
- `ResultadoSemaforo`: select con las 4 opciones (`Existencia` → `Mejora continua`).
- `observaciones` generales (textarea).
- `FirmaCapture`: canvas de firma, se sube a Supabase Storage y se guarda la URL en
  `visitas.firma_url`.
- Al confirmar, actualiza `visitas.estado = 'finalizado'`.

**Paso 4 — PDF**
- Componente genérico (no específico de Servicio social) que recibe como props:
  `visita`, `institucion`, `proceso`, `indicadoresConRespuestas`, `compromisos`.
- Estructura del PDF (igual al patrón de las plantillas Word originales):
  encabezado Alcaldía/SEM → datos generales → objetivo → actividades desarrolladas
  (texto fijo genérico) → seguimiento a compromisos anteriores → tabla de indicadores
  (área/aspecto/criterio/calificación/observación) → observaciones → tabla de
  compromisos → concepto final con el semáforo → firma.
- Se genera al confirmar el paso 3, se sube a Storage, la URL queda en `visitas.pdf_url`.
- **Importante**: aunque solo estamos probando con 3 indicadores, el componente debe
  construirse para recibir cualquier cantidad — es la misma prueba de fuego que el wizard.

## Definition of done de este paso

- [ ] Un usuario puede iniciar sesión y ver `/mis-visitas`.
- [ ] Puede crear una visita nueva para IE Rural La Trinidad + Servicio social.
- [ ] Completa los 3 indicadores, un compromiso, elige semáforo y firma.
- [ ] Al cerrar, se genera un PDF descargable con toda la información.
- [ ] Si cierra el navegador a mitad del checklist y vuelve, encuentra sus respuestas
      guardadas (borrador persistido).
- [ ] RLS se comporta como se espera: un segundo usuario `profesional` sin asignación
      a esa institución/proceso no puede ver ni editar esa visita.
