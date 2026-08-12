# Sistema de visitas técnicas — dirección visual

## Quién es esto / cómo debe sentirse
Herramienta oficial de la **Unidad de Calidad, Secretaría de Educación de
Manizales**, para que profesionales registren visitas de asistencia técnica a
instituciones educativas y el coordinador haga seguimiento. Es una
herramienta de auditoría/cumplimiento institucional — debe sentirse como un
acta o informe oficial: calmada, legible, de confianza. No es una app de
consumo; nada "playful" ni decorativo sin motivo.

## Identidad institucional
- El sistema es de la **Alcaldía de Manizales** (Unidad de Calidad /
  Secretaría de Educación), **no** del Comité de Cafeteros — no usar esa
  marca en ningún texto ni asset.
- Logos reales, extraídos del archivo que aportó el usuario
  (`Sem.png` en la raíz del proyecto):
  - `src/assets/logo-manizales-completo.png` — lockup completo (MzL + escudo
    + "Alcaldía de Manizales"). Usar en pantallas de entrada/portada (Login).
  - `src/assets/escudo-manizales.png` — solo el escudo, recortado, para
    espacios compactos (sidebar).
- Jerarquía textual: "Unidad de Calidad" es la unidad operativa real y debe
  tener más énfasis que "Secretaría de Educación" o "Alcaldía de Manizales"
  en los subtítulos (el logo ya cubre visualmente "Alcaldía de Manizales").

## Paleta de marca (tokens en `src/index.css`)
Extraída por muestreo de píxeles real del escudo (no inventada):
- **Terracota** `oklch(0.434 0.11 53.1)` (rgb `#7e3c00`, fondo del escudo) →
  `--primary`. Es el color de marca principal: botones, nav activo, acentos.
- **Teal** `oklch(0.497 0.089 218)` (rgb `#006e84`, nevado del escudo) →
  `--brand-teal` / `--ring`. Uso restringido: foco, acentos puntuales.
- El **rojo y verde del escudo NO se usan como marca** — quedan exclusivos
  del semáforo de resultados (`Existencia`→rojo, `Apropiación`→naranja,
  `Pertinencia`→amarillo, `Mejora continua`→verde, en
  `src/components/visitas/ResultadoSemaforo.tsx`). No mezclar significados:
  si se necesita un color de marca nuevo, no usar rojo ni verde.
- Dark mode: mismos hues, con L más alto para legibilidad (no se cae a
  gris neutro como el shadcn por defecto — la marca se mantiene en ambos
  temas).

## Depth / estructura
- Sombras con tinte de marca (ver "Dinamismo" más abajo) en vez de bordes
  puros — sigue vigente desde la pasada de dinamismo.
- Sidebar: **con lavado de marca** (`--sidebar` tintado en terracota, ver
  tokens), ya no "mismo fondo que el contenido". Se decidió así en la
  segunda pasada de color (ver "Color de superficie" abajo) porque con
  fondo idéntico al contenido el conjunto se veía "muy blanco / plano".
- Nav activo: `border-l-2 border-l-primary bg-primary/12 text-primary
  shadow-sm` (no fondo sólido, pero con más presencia que en la v1).

## Color de superficie (2ª pasada — "muy blanco, muy plano")
El usuario pidió explícitamente más color porque, tras la primera pasada de
dinamismo (sombras + movimiento), el conjunto seguía sintiéndose "muy
blanco". La causa real: fondo, `muted`, `secondary`, `accent`, `border` y
`sidebar` eran gris puro (croma 0 en OKLCH) — solo los acentos puntuales
(botones, nav activo, StatCard) tenían color de marca. La corrección **no**
fue agregar un color de marca nuevo, sino inyectarle un croma bajo (~0.01–
0.02) del hue de la terracota (53.1) a *todos* esos tokens neutros en
`src/index.css`. Efecto: bordes, zebra de tablas, hover de filas, fondo de
página y sidebar quedan con una calidez consistente sin tocar el contraste
(la luminancia/L no cambia, solo el croma). Aplica igual en `.dark`.
- Regla para nuevo código: **nunca** un componente "neutral" plano — si algo
  necesita un fondo de superficie, usar `bg-muted`/`bg-accent`/`bg-sidebar`
  (ya vienen con el tinte), no gris/blanco crudo.
- **Listados que antes eran solo texto/tabla plana** (Instituciones,
  Procesos, Profesionales): ahora la `<Table>` va envuelta en un `<Card
  className="overflow-hidden py-0">` para tener borde+sombra+esquinas
  redondeadas, y cualquier columna de estado/conteo usa `Badge` con color
  en vez de texto `text-muted-foreground` plano (ver "Badges de color").
  Las filas usan `hover:bg-primary/5` (o `hover:bg-brand-teal/5` si la fila
  representa un dato "teal" como Procesos) en vez del gris `hover:bg-muted`
  por defecto del componente `Table`.
- **VisitasList**: cada `Card` de visita lleva `border-l-4` + tinte de
  fondo al 3% según estado (mismo lenguaje visual que `StatCard`):
  `border-l-primary bg-primary/[0.03]` para borrador,
  `border-l-brand-teal bg-brand-teal/[0.03]` para finalizada.
- **Badges de color** (`badge.tsx`): dos variantes nuevas, `brand` (tinte
  terracota) y `teal` (tinte teal), pensadas para pares estado/categoría de
  dos valores (Borrador/Finalizada, Oficial/No oficial) — **no** usar
  amarillo/naranja/rojo/verde en badges de estado genérico: esos hues
  quedan exclusivos del semáforo (ver arriba) y usarlos en otro contexto
  (aunque sea otra pantalla) diluye su significado.
- **Button `outline`**: el hover pasó de gris (`hover:bg-accent`) a un tinte
  de marca (`hover:border-primary/30 hover:bg-primary/6 hover:text-primary`)
  — todos los botones "Ver/Editar" secundarios de la app heredan esto
  automáticamente.
- **StatCard**: evitar el tono `neutral` cuando hay una alternativa de
  marca real que aplique — alternar `primary`/`teal` entre las cifras de
  una misma fila en vez de dejar la mayoría en gris (ver `Semaforo.tsx`).

## Patrones ya establecidos
- **Stat/cifra de contexto** (`StatCard.tsx`): número grande + label, borde
  izquierdo sutil, sin ícono ni tarjeta con sombra. Ver `Semaforo.tsx`.
- **Matriz institución × proceso** (`SemaforoTable.tsx`): celdas como
  pequeños "sellos" cuadrados (`size-4 rounded-[3px]`) con el color del
  semáforo; sin dato = cuadro con borde punteado neutro (nunca vacío/roto a
  la vista). Encabezados de columna en texto vertical
  (`[writing-mode:vertical-rl] rotate-180`), **no** rotación diagonal a
  -45° — se recorta entre columnas cuando hay muchas.

## Fondos de pantallas "portada" (Login)
Las pantallas de trabajo (Semáforo, Instituciones, wizard) van sobre
`bg-background` liso — el color ahí lo llevan los datos (semáforo, StatCard),
no el fondo de la página. Pero la portada (`Login.tsx`) sí lleva un degradado
de marca sutil, evocando el paisaje del propio escudo (cielo/nevado → tierra):
`bg-linear-to-br from-brand-teal/15 via-background to-primary/20`. Es
theme-aware automáticamente (usa los tokens, no hex fijos). Reservar este
tratamiento para pantallas de entrada/portada, no para vistas de trabajo
densas en datos.

## Pendiente conocido
- El logo (`logo-manizales-completo.png` / `escudo-manizales.png`) tiene
  texto/trazos en negro fijo del PNG original — en dark mode pierde algo de
  contraste sobre tarjetas oscuras. Si se quiere resolver: generar una
  variante clara del logo para dark mode (no hay una todavía).

## Dinamismo ("vivo pero serio")
El usuario pidió más energía visual sin perder el tono institucional. La
regla: el dinamismo viene de **color + movimiento**, nunca de profundidad
(seguimos en solo-bordes, sin sombras decorativas).
- **StatCard**: bloque con tinte de fondo según `tone` (`primary` | `teal` |
  `neutral`, ver `TONE_CLASSES`), borde izquierdo grueso (4px) del mismo
  color, número grande con conteo animado de 0 al valor real
  (`useCountUp`, ease-out cubic, ~900ms). No usar tarjetas planas sin tono.
- **SemaforoTable**: celdas de sello a `size-6` (antes `size-4`), con
  entrada en cascada tipo "sello aplicándose" (`animate-in fade-in
  zoom-in-50 duration-300 fill-mode-backwards` + `animationDelay` por índice,
  tope en 500ms) y `hover:scale-125` en las celdas con resultado.
- **Button** (global, `button.tsx`): `hover:scale-[1.03] active:scale-[0.97]`
  en la base — aplica a todos los botones de la app, no solo casos puntuales.
- **Nav del sidebar**: ícono con `group-hover:scale-110`, borde izquierdo que
  aparece tenue en hover incluso antes de estar activo.
- **VisitaWizard**: cada paso entra con `animate-in fade-in
  slide-in-from-right-3 duration-300` (paso 4 usa `zoom-in-95` en vez de
  slide, por ser un cierre/celebración). El círculo activo del Stepper tiene
  `scale-110` + `ring-4 ring-primary/15`.
- Utilidades de animación: usar las de `tw-animate-css` (ya instalado,
  importado en `index.css`) — `animate-in/out`, `fade-in-*`, `zoom-in-*`,
  `slide-in-from-*`, `delay-*`, `fill-mode-*`. No agregar otra librería de
  animación.

## Gotchas
- `CardHeader` de shadcn/ui es `grid`, no `flex`. Para centrar contenido
  horizontalmente usar `justify-items-center`, **no** `items-center`
  (ese solo afecta el eje vertical en grid). Ya causó un bug real en
  `Login.tsx`.
- `useAuth.tsx`: no modelar la carga del perfil de `profesionales` con un
  booleano `profileLoading` aparte de `sessionLoading` — hay un render
  intermedio (entre que `session` resuelve y el efecto que carga el perfil
  se dispara) donde `userId` ya es real pero el booleano todavía dice
  "no cargando", y `ProtectedRoute` alcanza a redirigir con `rol=null` antes
  de que el perfil llegue. Pasaba en cualquier recarga directa (F5) de una
  ruta de coordinador/administrador (`/instituciones`, `/procesos`, etc.),
  no solo en el login. Solución: comparar `profesionalUserId` (el id para el
  que ya se cargó `profesional`) contra `userId` actual — `loading = 
  sessionLoading || (!!userId && profesionalUserId !== userId)` no depende
  del orden de ejecución de efectos.

## Base
- shadcn/ui estilo `new-york`, color base `neutral`, radius `0.625rem`.
- Iconos: `lucide-react`, un solo set en toda la app.
