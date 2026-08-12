# Estructura del frontend — Sistema de visitas técnicas

## Stack

- **React + Vite + React Router v6**
- **Tailwind + shadcn/ui**
- **Supabase** (`@supabase/supabase-js`) para auth y datos
- **@tanstack/react-query** para estado de servidor (fetch/cache de procesos, indicadores, visitas)
- **react-hook-form + zod** para formularios y validación
- **react-signature-canvas** (o equivalente) para capturar la firma
- **@react-pdf/renderer** para la generación del informe en PDF (se integra en fase posterior)

## Rutas

| Ruta | Rol | Descripción |
|---|---|---|
| `/login` | público | Autenticación con Supabase Auth |
| `/` | ambos | Redirige según rol: profesional → `/mis-visitas`, coordinador → `/semaforo` |
| `/mis-visitas` | profesional | Lista de visitas asignadas/pendientes y borradores propios |
| `/visitas/nueva` | profesional | Selección de institución + proceso, crea la visita y entra al wizard |
| `/visitas/:id` | profesional / coordinador | Wizard de diligenciamiento o vista de solo lectura si ya está finalizada |
| `/visitas/:id/pdf` | ambos | Vista/descarga del PDF generado |
| `/semaforo` | coordinador | Tabla consolidada institución × proceso con colores |
| `/instituciones` | coordinador | Listado y CRUD de instituciones |
| `/instituciones/:id` | coordinador | Detalle: historial de visitas por proceso, semáforo individual |
| `/asignaciones` | coordinador | Asignar profesional ↔ institución ↔ proceso |
| `/perfil` | ambos | Datos del usuario, cambio de contraseña |

## Estructura de carpetas

```
src/
  main.tsx
  App.tsx                    # define las rutas con React Router
  lib/
    supabase.ts               # cliente de Supabase
    queryClient.ts            # instancia de React Query
    queries/
      procesos.ts             # fetch de procesos, indicadores, campos extra
      instituciones.ts
      visitas.ts               # fetch/mutate de visitas, respuestas, compromisos
      asignaciones.ts
  hooks/
    useAuth.ts                 # sesión + rol del usuario actual
    useProceso.ts              # indicadores y campos extra de un proceso
    useVisita.ts                # estado de una visita en progreso
  components/
    ui/                        # componentes shadcn (button, input, select, etc.)
    layout/
      AppShell.tsx             # sidebar + header
      ProtectedRoute.tsx       # guard por rol
    visitas/
      VisitaWizard.tsx          # orquesta los 4 pasos del flujo
      SelectorInstitucionProceso.tsx
      AreaSection.tsx           # agrupa indicadores por área dentro del checklist
      IndicadorItem.tsx         # calificación + observación de un indicador
      CamposExtraForm.tsx       # renderiza campos_extra_procesos dinámicamente
      CompromisosForm.tsx       # lista editable de compromisos
      FirmaCapture.tsx
      ResultadoSemaforo.tsx     # selector Existencia/Apropiación/Pertinencia/Mejora continua
    dashboard/
      SemaforoTable.tsx         # institución × proceso con colores
      VisitasList.tsx
      StatCard.tsx
  pages/
    Login.tsx
    MisVisitas.tsx
    VisitaNueva.tsx
    VisitaDetalle.tsx
    Semaforo.tsx
    Instituciones.tsx
    InstitucionDetalle.tsx
    Asignaciones.tsx
    Perfil.tsx
  types/
    database.types.ts          # generado con `supabase gen types typescript`
```

## Notas de implementación

- **Tipos generados**: correr `Supabase:generate_typescript_types` (o `supabase gen types typescript --project-id aavsfxynlrlcxfpzcfyl`) apenas se empiece a codear, para tener autocompletado del esquema real desde el día uno.
- **RLS ya está activo**: el cliente de Supabase en el frontend usa la `anon key` + JWT del usuario logueado; las políticas del `schema.sql` ya filtran qué ve cada rol, así que las queries no necesitan lógica de permisos adicional en el cliente.
- **`VisitaWizard` es el componente más complejo**: recibe `proceso_id`, carga sus `indicadores` y `campos_extra_procesos` con React Query, y arma el formulario dinámicamente — no hay 18 componentes de formulario distintos, hay uno solo que se adapta al catálogo.
- **Autosave de borradores**: como las visitas pueden quedar en estado `borrador`, conviene guardar respuestas por indicador con un `debounce` en vez de un solo submit al final — así nadie pierde el trabajo si cierra la pestaña a mitad de una visita de PEI con 96 indicadores.
