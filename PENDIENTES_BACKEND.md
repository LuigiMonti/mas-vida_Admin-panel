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
- [ ] **Roles**: `soporte` (solo lectura + verificar y rechazar pólizas) y
      `admin` (todo, incluida configuración y ajustes). Puede ser con grupos
      de Django. El panel ya los aplica en `src/datos/sesion.ts`; el backend
      tiene que validarlos en cada endpoint.
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

- [ ] `GET /api/v1/admin/usuarios?q=&estado=`: búsqueda por correo,
      `usuario_id` o número de póliza; filtro por estado de póliza.
- [ ] `GET /api/v1/admin/usuarios/conteo`: cuántas cuentas hay en cada estado
      de póliza (`{todos, sin_poliza, pendiente, verificada, rechazada}`), para
      los filtros.
- [ ] `GET /api/v1/admin/usuarios/<usuario_id>`: ficha con póliza, puntos del
      año de póliza, nivel y saldo de monedas.
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
      las dos fechas, el corte y lo anulado por día.

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

---

## Post-piloto (no ahora)

- `LigaMensual.nombre`: nombre por mes ("Liga Nike") debajo de "La Liga ·
  noviembre".
- Estadísticas de canje: cuánto se ha canjeado cada cupón.
