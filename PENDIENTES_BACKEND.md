# Pendientes del backend para el panel de admin

Lo que el backend de +Vida (`mas-vida_backend`, rama `dev`) necesita para que el
panel deje los datos de muestra y funcione de verdad. Se actualiza cada vez que
una pantalla del panel pide algo que el backend todavía no tiene.

**Cómo funciona:** el panel nunca toca la base de datos. Todo va
panel → API de Django (`/api/v1/admin/…`) → Django valida y guarda → base de
datos.

**El panel ya está listo para conectarse** (A49). Cada función de
`src/datos/` ya llama a su endpoint cuando la sección está conectada en
`.env.local` (`VITE_DATOS_API=sesion,polizas…`). La forma que espera cada
respuesta es el tipo TypeScript de esa función. Para conectar una sección,
basta con que el endpoint exista con esa forma.

**Errores que el panel ya entiende:** los de DRF (`{campo: ["…"]}`,
`non_field_errors`, `detail`) y los propios (`{error, mensaje}`, el 429 con
`reintentar_en`). Un 401 lo manda al login.

---

## 0. Base de la API del panel

- [ ] **Login del panel**: `POST /api/v1/admin/login` con
      `{username, password}` → `200 {token, expiry, admin: {correo, nombre, rol}}`,
      donde `rol` es `"soporte"` o `"admin"`. Solo cuentas `is_staff`
      (otra cuenta: `400 non_field_errors`), con el mismo límite de intentos
      que `/api/v1/login` (429). Token de knox, igual que la app. Para salir,
      el panel usa el `POST /api/v1/logout` que ya existe.
- [ ] **Roles**: `soporte` (solo lectura + verificar y rechazar pólizas +
      marcar cupones + cerrar las sesiones de una cuenta y quitar un bloqueo
      por intentos) y `admin` (todo, incluida configuración, ajustes y lo que
      no se deshace de una cuenta). Puede ser con grupos de Django. El panel
      ya los aplica en `src/datos/sesion.ts`; el backend tiene que validarlos
      en cada endpoint. **Por confirmar con el equipo:** que soporte pueda
      cerrar sesiones y desbloquear (se lo dejó porque no cambian datos ni
      dinero y son lo que pide quien llama).
- [ ] **Doble factor (TOTP)** para las cuentas del panel. Forma:
      `src/datos/seguridad.ts`.
  - Login: si la cuenta lo tiene activo y no vino `codigo`, responde
    `401 {"error": "requiere_2fa"}`; el panel pide el código y repite la
    llamada con `{username, password, codigo}`. Código malo:
    `400 {"codigo": ["…"]}`, y cuenta para el límite de intentos.
  - `GET /api/v1/admin/2fa` → `{activo}`.
  - `POST …/2fa/empezar` → `{secreto, uri}` (el `otpauth://…`); no queda activo.
  - `POST …/2fa/confirmar` con `{codigo}` → `{activo: true}`.
  - `POST …/2fa/quitar` con `{password}` → `{activo: false}`.
  - El secreto se entrega una sola vez y nunca va a la bitácora. Hace falta
    una forma de que un admin se lo quite a otro que perdió el teléfono (hoy
    el panel no la tiene: sería desde el admin de Django).
- [ ] **Bitácora de acciones** (modelo nuevo, append-only): quién, cuándo,
      acción, a quién afectó y detalle. La escribe el backend en cada
      endpoint que cambia algo. Nunca guarda tokens, el encabezado
      `Authorization` ni datos de salud. Forma: `src/datos/bitacora.ts`.
- [ ] **CORS** para el dominio del panel en producción. En local ya funciona:
      `CORS_ALLOWED_ORIGIN_REGEXES` acepta `localhost` en cualquier puerto.

## 1. Inicio

- [ ] `GET /api/v1/admin/resumen`. Forma: `src/datos/resumen.ts`.
  - Usuarios activos (sincronizaron en los últimos 7 días): depende de
    guardar el sync (ver §3).
  - % con póliza verificada y pólizas pendientes (con la más vieja).
  - Cuántos cumplieron el objetivo en la última semana cerrada.
  - Monedas emitidas y vencidas en la season.
  - Estado del cierre (ver §6) y versión de reglas vigente.

## 2. Usuarios y pólizas (A47)

- [ ] `GET /api/v1/admin/usuarios?q=&estado=`: búsqueda por correo, nombre,
      **nombre de miembro** (con o sin "@"), `usuario_id` o número de póliza;
      filtro por estado de póliza. Cada fila trae `nombre`,
      `nombre_de_miembro` y `dado_de_baja`.
- [ ] `GET /api/v1/admin/usuarios/conteo`: cuántas cuentas hay en cada estado
      de póliza (`{todos, sin_poliza, pendiente, verificada, rechazada}`), para
      los filtros.
- [ ] `GET /api/v1/admin/usuarios/<usuario_id>`: ficha con póliza, puntos del
      año de póliza, nivel y saldo de monedas. Además (11 nov):
  - de la cuenta: `nombre` y `apellido` del registro, `nombre_de_miembro`,
    `tiene_foto`, `correo_verificado` (si pasó el código de correo: hoy
    `CodigoCorreo.verificado_en` se gasta al registrarse, habría que
    guardarlo en `Usuario`) y `dado_de_baja_en`;
  - de la póliza: `correcciones` (las `CorreccionDeNacimiento`, con `motivo` y
    `autor`, que hoy el modelo no tiene) y `retroactivo_restituido_en`;
  - `sesiones_activas`: cuántos tokens de knox vigentes tiene;
  - `consentimiento`: lo mismo que `GET /api/v1/consentimiento` más
    `historial` (todas las filas de `Consentimiento`, la más nueva primero).
- [ ] `PATCH …/usuarios/<usuario_id>` con `{is_active, motivo}`: desactivar o
      reactivar. Desactivar cierra sus sesiones. Solo `admin`.
- [ ] `POST …/usuarios/<usuario_id>/cerrar-sesiones` → `{cerradas}`: lo mismo
      que su `logout/todos`. `soporte` y `admin`.
- [ ] `POST …/usuarios/<usuario_id>/baja` con `{motivo}`: la misma baja de
      `POST /api/v1/cuenta/baja` (reusar el servicio), sin pedir la contraseña
      de la persona. Solo `admin`. En la bitácora no va nada personal.
- [ ] `POST …/usuarios/<usuario_id>/revertir-dia` con `{fecha, motivo}` →
      `{puntos}`: una fila `ajuste_manual` que deja el día en 0. Solo dentro
      de los 14 días y si el día tiene puntos. Solo `admin`. Falta decidir si
      el recálculo de un sync posterior de ese día respeta la reversión (hoy
      `asentar` volvería a acreditar la diferencia).
- [ ] **Después de una baja o de una cuenta desactivada**, todos los endpoints
      que cambian algo de esa cuenta responden `400`/`409` (el panel ya
      esconde las acciones).
- [ ] `GET …/usuarios/<usuario_id>/puntos` y `…/monedas`: los ledgers, solo
      lectura.
- [ ] **Motivo y autor en los ajustes.** `Ledger` y `MonedaLedger` no tienen
      dónde guardarlos. Agregar `motivo` y `autor` (vacíos en las filas
      automáticas). Las filas `ajuste_manual` que ya escribe el sistema
      (recálculo en `daily_scoring.py`, `monedas.anular_ganadas_antes_de`)
      llevarían `autor="sistema"`.
- [ ] `POST …/usuarios/<usuario_id>/ajustes` con
      `{ledger: "puntos"|"monedas", cantidad, fecha, motivo}`. Siempre una
      fila nueva, nunca edita. Valida: cantidad entera distinta de 0, fecha
      no futura, motivo obligatorio, un día no queda con puntos negativos y el
      saldo de monedas no queda negativo. Solo `admin`.
- [ ] `GET /api/v1/admin/polizas?estado=&q=`: cola de verificación, las
      pendientes más viejas primero, avisando si la póliza ya está
      verificada en otra cuenta.
- [ ] `POST …/polizas/<usuario_id>/verificar` con `{birth_date_confirmada}`:
      guarda la fecha y llama a `polizas.verificar`. Devuelve el veredicto y
      lo anulado (días, puntos, monedas). Hoy `denegar_retroactivo` devuelve
      los días y `anular_ganadas_antes_de` las monedas; falta el total de
      puntos.
- [ ] `POST …/polizas/<usuario_id>/veredicto-previo`: el veredicto
      (aplicado / tolerado / denegado) **sin guardar nada**, para mostrarlo
      antes de confirmar. Hoy el panel copia la regla de `es_mentira` y
      `le_da_ventaja`; con este endpoint deja de duplicarla.
- [ ] **Rechazar con motivo.** `polizas.rechazar` no guarda motivo (solo se
      llena solo con `poliza_en_otra_cuenta`). Que reciba el motivo:
      `datos_no_coinciden`, `poliza_no_vigente`, `poliza_en_otra_cuenta`,
      `otro`. Endpoint: `POST …/polizas/<usuario_id>/rechazar`.
- [ ] `GET /api/v1/admin/retroactivo`: cuentas con retroactivo denegado, con
      las dos fechas, el corte, lo anulado por día y `restituido_en`.
- [ ] `POST …/retroactivo/<usuario_id>/restituir` con `{motivo}` →
      `{dias, puntos, monedas}`: cuando al revisarlo fue un error y no una
      mentira. Una fila `ajuste_manual` positiva por cada día anulado y otra
      con las monedas; lo anulado no se borra. Una sola vez. Solo `admin`.
      **Falta decidir** si al restituir esos días vuelven a contar para la
      meta semanal y el desempate de las ligas (hoy los excluye
      `corte_retroactivo`); el veredicto guardado no cambia.
- [ ] `POST …/polizas/<usuario_id>/liberar` con `{motivo}`: una verificada
      queda `rechazada` con `motivo_rechazo="liberada"` y libre para otra
      cuenta. No toca los ledgers. Solo `admin`. **Falta decidir** qué pasa
      con sus puntos del año de póliza y su lugar en La Liga en curso (el
      panel dice: deja de canjear y sale de La Liga).
- [ ] `POST …/polizas/<usuario_id>/corregir-nacimiento` con
      `{fecha_nueva, motivo}` → la `CorreccionDeNacimiento` creada. Es lo que
      hoy se hace editando la póliza en el admin de Django. Vale desde hoy;
      el veredicto no cambia. Solo `admin`. Sumar hacia atrás no es un
      endpoint: es un ajuste del ledger, caso por caso.

## 3. Soporte de sync (A47)

Hoy el sync **valida pero no guarda** estos datos: llegan en el payload y se
pierden.

- [ ] **Guardar cada sync**: `sincronizado_en`, `app_version` y
      `zona_horaria`, por usuario (modelo nuevo o el último en `Usuario`).
- [ ] **Guardar lo descartado**: el conteo de `descartadas` del serializer
      (`sesiones_sin_ritmo_cardiaco`, datos imposibles). Hoy solo va al log.
- [ ] `GET …/usuarios/<usuario_id>/sync`:
  - último sync, `app_version` y zona horaria;
  - los últimos 14 días con y sin datos (de `ResumenDiario`);
  - las muestras descartadas;
  - los dispositivos: nombre, modelo, `fuente_bundle` y última muestra (de
    `Muestra`), y si mandaron ritmo cardíaco (de `MuestraBPM`/`Sesion`).
- [ ] **Versión actual de la app**: el diagnóstico la compara con
      `app_version`. Hoy el panel la tiene fija (`1.1.0`).
- [ ] **Pasos de Apple Salud (A49)**, en la misma respuesta de `…/sync`:
  - `manda_pasos_por_hora`: si el último envío de hoy trajo `pasos_por_hora`
    (hoy solo se anota en el log cuando falta);
  - en cada día de la ventana, `cubierto`: si se calcula con el total de
    Salud (`PasosHora`) o con las muestras.

## 4. Objetivo semanal (A46)

- [ ] `GET /api/v1/admin/objetivos/season`: las semanas de la season con su
      estado (cerrada, sin cerrar, en revisión, en curso, definida, sin
      definir) y el resultado de las cerradas. Las sin definir traen
      `heredado`: los valores que tendrían si se crean solas (copia de la
      anterior, como `objetivo_de_la_semana`).
- [ ] `PUT …/objetivos/<fecha_inicio>`: crea o edita `ObjetivoSemanal`
      (`meta_workouts`, `monedas_pasos`, `monedas_workouts`, `meta_pasos`).
      **Solo semanas que todavía no empiezan.** Con `en_adelante=true`, aplica
      lo mismo a las semanas siguientes ya creadas. Responde
      `{semanas_actualizadas}`.
- [ ] `GET` y `PUT …/objetivos/metas-por-edad`: la tabla `MetaPasosPorEdad`
      entera, con validaciones (desde 18 años, sin edades repetidas, al
      menos una fila).

## 5. Reglas de puntaje (A46)

- [ ] **Las reglas pasan del código a `VersionRegla`.** Hoy el modelo guarda
      solo `version` y `vigente_desde`, y los valores son constantes en
      `services/points.py`, `daily_scoring.py`, `hearth_rate.py` y
      `niveles.py`. Agregar a `VersionRegla`:
      `tramos_pasos`, `escalones_intensidad` (JSON), `fcmax_base`,
      `bono_edad_minima`, `bono_puntos_pasos`, `bono_puntos_intensidad`,
      `tope_diario`, `tope_anual`, `niveles` (JSON),
      `ventana_rezagados_dias`, `pasos_dia_atipico`,
      `workout_minutos_minimos` y `creada_por`. Forma: `src/datos/reglas.ts`.
- [ ] **Migración** que llene v1, v2 y v3 con los valores que hoy están en el
      código, para que el día del despliegue no cambie ningún punto.
- [ ] **El cálculo lee la versión, no las constantes**: los servicios usan
      `version_regla_vigente(fecha)`. Así un día recalculado dentro de los 14
      días usa las reglas que valían ese día.
- [ ] **Desempate**: `version_regla_vigente` hoy ordena solo por
      `vigente_desde`; si varias empiezan el mismo día, gana la de `version`
      más alta.
- [ ] `GET /api/v1/admin/reglas` y `POST /api/v1/admin/reglas`. Valida:
      fecha hoy o después, **máximo 3 versiones por día**, tramos que suben,
      techo diario alcanzable. Una versión **no se edita** después de creada.
      Solo `admin`.
- [ ] **Borrar código muerto**: `BUNDLE_A_TIPO`, `FABRICANTE_A_TIPO`,
      `MODELO_APPLE_A_TIPO` y `tipo_dispositivo` en `services/device.py` no
      se llaman desde ningún lado (la fuente se elige por pasos y puntos, y
      un workout cuenta con ritmo cardíaco de cualquier marca).

## 6. Cierres y bitácora (A48)

- [ ] **Registro de cada corrida del programador** (cierre semanal,
      corrección, La Liga, podio): cuándo empezó, cuándo terminó, si falló y
      el error. Hoy solo queda en el log del servicio, y es el punto ciego del
      piloto.
- [ ] **Latido del programador**: que el proceso guarde cada minuto o dos
      "sigo vivo". Si pasan más de 10 min sin latido, el panel avisa que el
      servicio está caído (hoy no hay healthcheck).
- [ ] `GET /api/v1/admin/cierres`: las corridas (más nuevas primero), el
      último latido, las próximas corridas y si hay un cierre en curso
      (el candado tomado). Forma: `src/datos/cierres.ts`.
- [ ] `POST /api/v1/admin/cierres/semana` = `cerrar_semana --ponerse-al-dia`,
      respetando el candado de PostgreSQL ("Hay otro cierre en curso"). Como
      un cierre tarda, conviene que responda enseguida y el panel consulte
      el estado, en vez de esperar la respuesta. Solo `admin`.
- [ ] `GET /api/v1/admin/bitacora?accion=&q=`.

## 7. Premios (A45)

Forma: `src/datos/premios.ts`. Sección `premios` en `VITE_DATOS_API`.

- [ ] `GET /api/v1/admin/premios?q=&categoria=&estado=` (`activos`, `vencidos`,
      `apagados`): cada premio con `canjeados`, `usados` y `destacado` (si
      tiene un patrocinio destacado vigente).
- [ ] `GET` y `PUT /api/v1/admin/premios/<id>`, y `POST /api/v1/admin/premios`.
      Valida: nombre, comercio y descripción obligatorios; costo entero ≥ 0;
      `fondo` como `#RRGGBB`. Solo `admin`.
- [ ] `PATCH /api/v1/admin/premios/<id>` con `{activo}`: archivar o prender.
      Nunca se borra (los cupones apuntan al premio).
- [ ] **`cupo` en `Premio`** (campo nuevo, entero o null = sin límite): cuántos
      cupones puede dar el comercio. El canje en la app tiene que respetarlo.
- [ ] `POST /api/v1/admin/premios/importar` con `{json, aplicar}`: lo mismo que
      `importar_premios`. Con `aplicar=false` solo responde
      `{crear, actualizar, errores}`; si un premio viene mal, no guarda nada.

## 8. Cupones y estadísticas de canje (A45)

Forma: `src/datos/cupones.ts`. Sección `cupones`.

- [ ] `GET /api/v1/admin/cupones/<codigo>`: un cupón por código (el panel lo
      manda como `MV-XXXX-XXXX`). Trae el `fondo` del logo del premio.
- [ ] `GET /api/v1/admin/cupones?q=&usuario_id=&estado=&origen=&premio_id=`.
      Un cupón activo cuya fecha ya pasó se devuelve como `expirado`.
- [ ] `POST /api/v1/admin/cupones/<codigo>/usar`: solo si está activo y sin
      vencer. Si no, `400 {error: "cupon_usado"}` o `{error: "cupon_vencido"}`.
      Lo pueden hacer `soporte` y `admin`.
- [ ] **`usado_por` en `Canje`** (campo nuevo): quién lo marcó como usado.
- [ ] `GET /api/v1/admin/cupones/estadisticas?periodo=` (`7`, `30`, `season`,
      `todo`): totales, por origen, por día y por premio. Cada premio trae
      también `canjeados_total` (todos los tiempos), que es lo que se resta
      del cupo.

## 9. La Liga (A45; por temporada desde el 11 nov)

Forma: `src/datos/liga.ts`. Sección `liga`. **Cambió con el contrato del 8 nov:**
La Liga dura una temporada, así que las rutas van por **ciclo** y ya no por
mes. El ciclo se identifica por su primer día (`LigaMensual.mes`):
`2026-10-01` (octubre, el último mes), `2026-11-01` (la primera temporada,
hasta el 3 ene 2027), `2027-01-04`…

- [ ] **`LigaMensual.nombre`** (campo nuevo, máx. 40, vacío = "La Liga"): el
      nombre del ciclo ("Liga Nike"), que la app muestra debajo de "La Liga".
      Lo tiene que mandar también `GET /api/v1/ligas`. **Por confirmar con
      Daniel:** qué dice la app arriba del nombre ahora que es por temporada
      (el panel muestra "La Liga · temporada 4").
- [ ] `GET /api/v1/admin/liga/ciclos`: cada ciclo con `inicio`, `fin`, `ciclo`
      (`"mes"` o `"temporada"`, como en la app), `estado`, `cierre` y `pago`
      (los días de `dia_de_cierre` y `dia_de_pago`), `cerrada_en`,
      `pagada_en`, `podio` (el fijado al cerrar o el de ahora) y su patrocinio.
- [ ] `PATCH /api/v1/admin/liga/ciclos/<inicio>` con `{nombre}`: solo ciclos
      que no se cerraron. Solo `admin`.
- [ ] `GET /api/v1/admin/liga/ciclos/<inicio>/tabla`: final si cerró,
      provisional si está en curso (de `DesgloseLigaMensual`). Cada fila:
      `posicion`, `usuario_id`, `nombre`, `nombre_de_miembro`, `puntos`,
      `pasos`, `workouts` y `monedas`.
- [ ] `GET` y `PUT /api/v1/admin/liga/podio`: `PremioPodioLiga` (1.º, 2.º, 3.º).

## 10. Patrocinios (A45)

Forma: `src/datos/patrocinios.ts`. Sección `patrocinios`.

- [ ] `GET /api/v1/admin/patrocinios/calendario`: `semanas` (las de la
      season), `ligas` (los ciclos de La Liga: `inicio`, `fin`, `ciclo`) y
      `destacados`, cada uno con su patrocinio o libre. Un patrocinio de La
      Liga va de punta a punta de su ciclo (`Patrocinio.clean` ya lo valida).
- [ ] `POST /api/v1/admin/patrocinios`: con las mismas validaciones de
      `Patrocinio.clean()` (el panel ya las copia y las prueba). Solo `admin`.
- [ ] `PATCH /api/v1/admin/patrocinios/<id>` con `{activo: false}`: apagar.
- [ ] `GET /api/v1/admin/patrocinios/<id>/reporte`: para el comercio, cuántos
      ganaron su cupón y cuántos lo usaron (`{ganados, usados, vencidos,
      activos}`). Hoy `Canje.patrocinio` ya liga el cupón con su patrocinio.

## 11. Antifraude (A53)

Forma: `src/datos/antifraude.ts`. Sección `antifraude`.

- [ ] `GET /api/v1/admin/bloqueos?usuario_id=&policy_number=`: los intentos
      fallidos que cuentan hoy para algún límite (`IntentoFallido`), agrupados
      por tipo y clave: `id` (opaco), `tipo`, `intentos`, `maximo`,
      `primer_intento`, `ultimo_intento` y `bloqueado_hasta`. Como la clave es
      un hash, el backend la compara con las cuentas y pólizas que conoce para
      llenar `usuario_id` y `policy_number`; si no calza con ninguna, van en
      `null`. Las claves por IP mandan `ip`. Nunca se devuelve el hash.
- [ ] `POST /api/v1/admin/bloqueos/<id>/desbloquear`: borra esos intentos.
      `soporte` y `admin`. Es lo que pide el contrato en "Límite de intentos"
      (quien conoce un número de póliza puede bloquear a su titular un día).
- [ ] **Días atípicos**: hoy un día con más de 60.000 pasos solo queda en el
      log. Guardarlo (por ejemplo, una marca en `ResumenDiario`) y
      `GET /api/v1/admin/antifraude/dias-atipicos` →
      `{usuario_id, nombre, fecha, pasos, puntos_dia, en_ventana}`.
- [ ] `GET /api/v1/admin/antifraude/datos-compartidos`: cuentas con muestras
      del mismo `external_id` (el UUID de HealthKit). Hoy el índice único es
      por `(usuario_id, external_id)`: hace falta poder buscar el mismo
      `external_id` en otra cuenta. Forma: `{id, dispositivo,
      muestras_en_comun, desde, hasta, cuentas: [{usuario_id, nombre,
      estado_poliza}]}`.
- [ ] `GET /api/v1/admin/antifraude/para-revisar`: una fila por cuenta con sus
      motivos (`dia_atipico`, `retroactivo_denegado`, `intentos`,
      `datos_compartidos`), las de más motivos primero.
- [ ] En `GET /api/v1/admin/resumen`: `antifraude: {para_revisar, bloqueados}`.

## 12. Tus Ligas (A53)

Forma: `src/datos/tusLigas.ts`. Sección `tus_ligas`.

- [ ] `GET /api/v1/admin/tus-ligas?q=`: los grupos (`LigaAmigos`) con `id`,
      `nombre`, `codigo`, `creado_por` (`null` si esa cuenta se dio de baja),
      `creado_en` y `miembros`. Busca por nombre, código o `usuario_id` de un
      miembro.
- [ ] `GET …/tus-ligas/<id>/miembros`: `usuario_id`, `nombre`,
      `nombre_de_miembro`, `fecha_union`, `puntos_mes` y `es_creador`.
- [ ] `PATCH …/tus-ligas/<id>` con `{nombre, motivo}`: para un nombre que no
      puede quedarse (de 1 a 60 caracteres). Solo `admin`.
- [ ] `DELETE …/tus-ligas/<id>` con `{motivo}`: saca a todos y el código deja
      de valer. Solo `admin`.

## 13. Comercios (A53)

Forma: `src/datos/comercios.ts`. Sección `comercios`.

- [ ] **Modelo nuevo `Comercio`**: hoy el comercio es solo un texto en
      `Premio.comercio_aliado`. La ficha lleva `contacto_nombre`,
      `contacto_telefono`, `contacto_correo`, `contrato_desde`,
      `contrato_hasta`, `cuota_mensual_gtq` (decimal, viaja como texto con dos
      decimales) y `notas`. Es interna: ningún endpoint de la app la devuelve.
- [ ] `GET /api/v1/admin/comercios?q=`: cada comercio con su ficha, `logo` y
      `fondo` (de su premio), `premios`, `premios_activos`,
      `patrocinios_vigentes` y `estado_contrato` (`sin_contrato`,
      `por_empezar`, `vigente`, `por_vencer` a 30 días o menos, `vencido`).
- [ ] `PUT /api/v1/admin/comercios/<id>`: guarda la ficha. Solo `admin`. En la
      bitácora va qué cambió, no los datos de contacto.

## 14. Bitácora: acciones nuevas (A53)

Además de las de antes: `estado_cuenta`, `cerrar_sesiones`, `baja_cuenta`,
`liberar_poliza`, `corregir_nacimiento`, `restituir_retroactivo`,
`revertir_dia`, `desbloquear`, `moderar_liga`, `editar_comercio` y
`seguridad_panel`. Todas las que piden motivo lo guardan en el detalle.
