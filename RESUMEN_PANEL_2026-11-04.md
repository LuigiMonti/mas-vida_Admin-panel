# Panel de admin de +Vida: lo hecho y lo decidido (4 de noviembre de 2026)

Resumen del arranque del panel: qué se construyó, en qué branch, y las
decisiones que se tomaron en el camino. Lo que el backend tiene que cambiar
para conectar el panel está aparte, en `PENDIENTES_BACKEND.md`.

---

## 1. Decisiones

### Arquitectura y forma de trabajo
- **El panel es un frontend aparte**, en este repo (`mas-vida_Admin-panel`), y no
  una extensión del admin de Django. Va a hablar con endpoints nuevos
  `/api/v1/admin/` del backend.
- **El panel nunca toca la base de datos.** Todo va panel → API de Django →
  Django valida y guarda → base de datos.
- **Primero la UI, después la conexión.** Hoy las pantallas usan datos de
  muestra con la forma de los modelos de Django. La conexión se hace después,
  siguiendo `PENDIENTES_BACKEND.md`.
- **En este repo solo se toca el panel.** Los cambios que necesita el backend
  de la app no se hacen ahora: se anotan en `PENDIENTES_BACKEND.md`.
- **Una branch por tema**, cada una saliendo de la anterior. Los commits y el
  push los hace Luis.

### Alcance
- **Se construye todo** (6 nov). Ya no se separa "piloto" de "post-piloto".
  Primero se hizo lo de uso diario (usuarios y pólizas, retroactivo denegado,
  objetivo semanal y su cierre, ledger, soporte de sync, reglas y bitácora), y
  después premios, cupones, La Liga (con su nombre por mes, por ejemplo "Liga
  Nike" debajo de "La Liga · noviembre"), las **estadísticas de canje** y los
  patrocinios.
- **Salieron del plan:**
  - El reporte a la aseguradora (Excel mensual y de cierre anual). Lo
    reemplazan las estadísticas de canje.
  - El Plan Empresarial.

### Diseño
- **La UI quedó aprobada tal como está.** Se armó a partir de masvidaapp.com y
  de la app Flutter, con los valores reales de las dos (no los aproximados):
  - Azul de marca `#022196`.
  - Títulos en Poppins y texto en Manrope.
  - Dorado `#F4C542` para destacados puntuales.
  - Naranja `#F58A07` solo para monedas.
  - Niveles de cashback en la escala de azules de la app.
  - Escalones de pasos en café, gris, dorado y arcoíris.
- Sin mascota, ilustraciones, monedas animadas ni fotos. Nunca nombres de metal
  para los niveles: se dice "Nivel 3".
- **La barra lateral arranca oculta** y se abre con ☰. No recuerda si se dejó
  abierta.
- **Se quitó la página de guía de estilo (`/estilo`):** el estilo se mantiene
  en el código. Los tokens están en `src/styles/tokens.css`.

### Reglas que el panel respeta
- **Los ledgers de puntos y monedas nunca se editan ni se borran.** Una
  corrección es una fila nueva de ajuste, con motivo y autor.
- **Hay dos roles:**
  - `soporte`: ve todo y puede verificar y rechazar pólizas.
  - `admin`: además ajusta puntos y monedas, cambia la configuración, corre
    cierres y ve la bitácora.
- **Nunca se muestran tokens** ni el encabezado `Authorization`.
- **Cada acción queda en la bitácora:** quién, cuándo, qué y sobre quién.

### Reglas de puntaje
- **Se quitó "Fuentes de datos" (`BUNDLE_A_TIPO`).** En el backend no se usa en
  ningún lado: los pasos se eligen por bloque de hora, la intensidad por
  puntos, y un workout cuenta con ritmo cardíaco de cualquier marca. En su
  lugar va la **tabla de puntaje** de cada versión.
- **Las versiones de reglas se crean desde el panel con su tabla completa:**
  tramos de pasos, intensidad, bono 60+, techos, niveles y datos.
  - Para eso el backend tiene que guardar esos valores en `VersionRegla`, en
    lugar de tenerlos como constantes en el código.
  - Una versión empieza hoy o después.
  - Una versión no se edita después de creada.
- **Máximo 3 versiones por día.** Si varias empiezan el mismo día, vale la de
  número más alto.

---

## 2. Lo construido, por branch

| Branch | Commit | Qué tiene |
|---|---|---|
| `A44-admin-base` | `073eb6a` | Proyecto (React + TypeScript + Vite + Tailwind v4), tokens y componentes, barra lateral y header, login (solo diseño), inicio con métricas y avisos, roles, capa de datos de muestra y rutas por sección |
| `A47-admin-polizas-usuarios` | `373f436` | Usuarios, ficha de cuenta, pólizas, retroactivo denegado y bitácora (datos) |
| `A46-admin-objetivos-liga` | `f10b96e` | Semanas y metas, y reglas de puntaje |
| `A48-admin-cierres-auditoria` | `f6e8ae8` | Estado del cierre y bitácora (pantalla) |
| `A49-admin-cliente-api` | `cdeeb87` | Cliente de API (token de knox, errores de DRF), interruptor mock/API por sección, login real, rutas protegidas y tests |
| `A45-admin-premios-cupones` | — | Premios, cupones, estadísticas de canje, La Liga, patrocinios, página 404, "Ver como" para demos y carga de pantallas por separado |

Cada branch sale de la anterior: A44 → A47 → A46 → A48 → A49 → A45.

### Inicio (`/`)
- **Métricas:** usuarios activos, % con póliza verificada, cuántos cumplieron
  el objetivo y monedas emitidas contra vencidas en la season.
- **"Pide atención":** avisa si el programador corrió o falló, si hay semanas
  sin cerrar, si falta la versión de reglas vigente y si hay pólizas esperando
  verificación.
- **Accesos rápidos** a las pantallas de uso diario.

### Usuarios (`/usuarios`)
- **Lista** con buscador (correo, `usuario_id` o póliza) y filtros por estado de
  póliza. Cada fila muestra el motivo de rechazo, el nivel, los puntos, las
  monedas y el último sync, que sale en rojo si pasaron 3 días o más. El
  buscador del header también abre esta lista.
- **Ficha** con cuatro pestañas:
  - **Resumen:** la póliza y la cuenta.
  - **Puntos y Monedas:** los ledgers en solo lectura, con "Agregar ajuste"
    (solo admin). El ajuste lleva motivo, no deja un día en negativo ni el
    saldo en negativo, y siempre es una fila nueva.
  - **Sync:** último sync, `app_version`, los últimos 14 días con y sin datos,
    muestras descartadas, dispositivos y un diagnóstico para "no me cuenta mis
    pasos".

### Pólizas (`/polizas`)
- **Cola de verificación**, con las pendientes más viejas primero.
- **Verificar** pide la fecha de nacimiento que confirmó la aseguradora, y antes
  de confirmar muestra si el retroactivo queda aplicado, tolerado o denegado.
  Usa la misma regla del backend: hasta 2 años de diferencia y sin ventaja es
  error, no mentira.
- **Si queda denegado,** pide confirmación, porque anula puntos y monedas.
- **Rechazar** pide el motivo.
- **No deja verificar** una póliza que ya está verificada en otra cuenta.

### Retroactivo denegado (`/retroactivo`)
- Para cada cuenta muestra las dos fechas, el corte, los días, los puntos y las
  monedas anulados, y el detalle por día. Solo lectura.

### Semanas y metas (`/objetivos`)
- **Las 14 semanas de la Season 4,** cada una con su estado (cerrada, sin
  cerrar, en revisión, en curso, definida o sin definir), su meta de workouts,
  las monedas de cada componente y el resultado de las ya cerradas.
- **Solo se editan las semanas que todavía no empiezan.**
  - "Definir" deja una semana creada antes de tiempo.
  - "Editar" puede aplicar el cambio también a las semanas siguientes.
- **La meta de pasos por edad se edita como una tabla.**

### Reglas de puntaje (`/reglas`)
- **Lista de versiones** con su estado (vigente, programada o anterior), y aviso
  si no hay ninguna vigente.
- **La tabla de cada versión:**
  - pasos (con los colores de cada escalón);
  - intensidad y la fórmula de la FCmáx;
  - bono y techos;
  - niveles y cashback;
  - ventana de rezagados, día atípico y workout mínimo.
- **"Nueva versión"** parte de la vigente y muestra qué cambia antes de crear.

### Estado del cierre (`/cierres`)
- **Métricas:** si el programador está activo, la última corrida, las semanas
  sin cerrar y el próximo cierre.
- **Historial de corridas:** cierre, corrección, La Liga y pago del podio, con
  los intentos y los errores.
- **"Ponerse al día"** (`cerrar_semana --ponerse-al-dia`) pide confirmación, y
  mientras corre no deja empezar otro cierre. Solo admin.
- **Próximas corridas.**

### Bitácora (`/bitacora`)
- Todas las acciones del panel, con filtros por grupo y buscador. Solo admin.

### Login (`/login`)
- Entra con la cuenta del equipo y vuelve a la página donde estabas. Sin sesión,
  cualquier página lleva aquí. Con datos de muestra entra cualquier correo; uno
  que empieza con "soporte" entra como soporte.

### Premios (`/premios`)
- **Lista** del catálogo real de la app (28 premios con sus logos), con
  buscador, filtro por categoría y por estado (activos, vencidos, archivados),
  cuántos se canjearon y el cupo.
- **Crear y editar** con la card de la Tienda y su detalle en vivo. Archivar en
  vez de borrar.
- **Importar catálogo** con el mismo JSON de `importar_premios`: primero dice
  qué va a crear y actualizar; si uno viene mal, no guarda nada.

### Cupones (`/cupones`)
- **Validar un cupón:** se escribe el código que muestra la persona en la caja
  y se marca como usado (soporte también puede). No deja usar uno ya usado ni
  uno vencido.
- **Lista** con filtros por estado y origen (tienda, semana patrocinada, La
  Liga). La ficha de cada usuario tiene su pestaña de cupones.

### Estadísticas de canje (`/estadisticas`)
- Por periodo: cupones canjeados, % usados en el comercio, % que se dejaron
  vencer y monedas gastadas; canjes por día; de dónde salen; y cada premio con
  sus canjes, usos, vencidos y lo que le queda de cupo.

### La Liga (`/liga`)
- **Los meses** con su estado (por venir, en curso, por pagar, pagado).
- **Nombre de cada mes** con el banner de la app en vivo: "La Liga · noviembre"
  arriba y "Liga Sportcity" abajo. Sugiere el nombre del patrocinador. Un mes
  cerrado ya no se renombra.
- **Monedas del podio** (valen para los meses que no se cerraron) y la tabla
  del mes, provisional o final, con los desempates.

### Patrocinios (`/patrocinios`)
- **Calendario** de las semanas de la season y los meses de La Liga, vendidos y
  libres, y los premios destacados.
- **Vender** con las mismas reglas del backend (semana de lunes a domingo, mes
  del 1 al último, cupón obligatorio, sin vender dos veces lo mismo) y
  **apagar**.
- **Reporte para el comercio:** cuántos ganaron su cupón y cuántos lo usaron.

---

## 3. Cómo está armado

- **Correrlo:** `npm install` y luego `npm run dev`.
- **Estilo:** `src/styles/tokens.css` es la única fuente de colores, fuentes,
  radios y sombras. La paleta por defecto de Tailwind está apagada.
- **Componentes:** están en `src/components/ui/`.
- **Datos:** `src/datos/` tiene un archivo por tema. Cada función llama a su
  endpoint si su sección está conectada en `.env.local`; si no, usa datos de
  muestra en memoria, que vuelven a su estado inicial al recargar.
- **Rutas:** cada sección define las suyas en `src/pages/<sección>/rutas.tsx`.
- **Ver el panel como soporte:** con datos de muestra, "Ver como" en el header.
- **Tests:** `npm test`.

---

## 4. Pendiente

- [ ] **Juntar A49 y A45 en `dev`** cuando las revisen.
- [ ] **Conexión con la API:** los endpoints de `PENDIENTES_BACKEND.md`. Cada
      uno que exista se conecta agregando su sección en `VITE_DATOS_API`.

---

## 5. Cambios del 11 de noviembre (branch `A53-admin-soporte-temporadas`)

Sale de A45. Todo sigue con datos de muestra; lo que el backend necesita está en
`PENDIENTES_BACKEND.md` (§0, §2, §3 y §9 a §14).

### Puesto al día con el contrato (7 y 8 nov)
- **La Liga va por temporada**, no por mes. Octubre de 2026 fue el último mes y
  la primera temporada cuenta del 1 nov 2026 al 3 ene 2027. Se cierra el martes
  de la temporada nueva y el podio se paga el martes siguiente. El nombre
  ("Liga Nike") es por temporada. Las cuentas están en `src/datos/temporadas.ts`.
- **Patrocinios de La Liga:** cubren la temporada entera.
- **Nombre de miembro** (`ana.lopez`): en la lista de usuarios, la ficha, la
  tabla de La Liga y el buscador (con o sin "@").
- **Ficha:** nombre del registro, foto, correo verificado y sesiones abiertas.
- **Sync:** si la app manda el total de Apple Salud (`pasos_por_hora`) y qué
  días se calculan con él.

### Pantallas nuevas
- **Ficha del usuario:** cerrar sus sesiones, desactivar o reactivar, dar de
  baja (pide escribir el `usuario_id`) y ver el consentimiento.
- **Pólizas:** liberar una verificada, corregir la fecha de nacimiento y
  desbloquear una póliza bloqueada por intentos.
- **Retroactivo:** restituir lo anulado cuando fue un error.
- **Puntos:** revertir un día (dentro de los 14 días).
- **Antifraude (`/antifraude`):** cuentas para revisar, días atípicos, mismos
  datos en varias cuentas, e intentos y bloqueos.
- **Tus Ligas (`/tus-ligas`):** cambiar un nombre o borrar un grupo.
- **Comercios (`/comercios`):** contacto, contrato y cuota mensual.
- **Mi cuenta (`/mi-cuenta`):** qué puede tu rol y doble factor. El login pide
  el código si la cuenta lo tiene.

### Decisiones tomadas aquí (confirmadas el 11 nov)
- **Soporte** puede cerrar sesiones y desbloquear; todo lo demás nuevo es de
  admin.
- **Toda acción nueva pide motivo**, que queda en la bitácora.
- **Liberar una póliza** la deja como rechazada con motivo "liberada".
- **Restituir un retroactivo** no cambia el veredicto guardado.
- **Póliza cancelada o suspendida después de verificada: se pierde todo.** La
  persona pierde sus puntos y monedas, igual que con el retroactivo denegado.
  Es la decisión por ahora; el detalle (si se anula todo lo acumulado o solo
  lo posterior a la cancelación, y si se puede restituir) queda para cuando se
  conecte con el backend. Está anotado en `PENDIENTES_BACKEND.md` (§2).

### Comercios
- **Los comercios no se crean en su pantalla.** La lista sale de los premios:
  cada nombre distinto en el campo "Comercio" de un premio es un comercio, y
  `/comercios` solo edita su ficha (contacto, contrato, cuota, notas). Para que
  aparezca uno nuevo se crea un premio con ese nombre.
- El nombre es texto libre: "Pizza Hut" y "Pizzahut" cuentan como dos
  comercios. Cuando exista el modelo `Comercio` en el backend
  (`PENDIENTES_BACKEND.md` §13) se podrá crear desde su pantalla.

### Pendiente
- [x] Juntar A49, A45 y A53 en `dev` (hecho el 11 nov).
- [ ] Conexión con el backend: es el siguiente paso, siguiendo
      `PENDIENTES_BACKEND.md`.
