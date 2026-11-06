# Panel de administración de +vida

Frontend del panel (React + TypeScript + Vite + Tailwind v4): usuarios y pólizas,
retroactivo denegado, ledger y ajustes, soporte de sync, objetivo semanal y su
cierre, reglas de puntaje, La Liga, premios, cupones, estadísticas de canje,
patrocinios y bitácora.
Habla con la API `/api/v1/admin/` del backend Django (`mas-vida_backend`); nunca
con la base de datos.

```bash
npm install
cp .env.example .env.local   # y ajustarlo
npm run dev                  # http://localhost:5173
npm test                     # tests (Vitest)
npm run build                # typecheck + build
```

- Lo decidido y lo construido: `RESUMEN_PANEL_2026-11-04.md`.
- Lo que el backend tiene que hacer para conectar el panel: `PENDIENTES_BACKEND.md`.

## Datos: de muestra o la API

Cada sección lee de datos de muestra o de la API según `.env.local`:

| Variable | Qué hace |
|---|---|
| `VITE_API_URL` | URL del backend (por defecto `http://localhost:8000`) |
| `VITE_DATOS` | `mock` (por defecto) o `api` para todo |
| `VITE_DATOS_API` | Con `mock`, secciones que igual van a la API: `sesion,polizas` |

Secciones: `sesion`, `resumen`, `usuarios`, `polizas`, `retroactivo`, `objetivos`,
`reglas`, `cierres`, `bitacora`, `premios`, `cupones`, `liga`, `patrocinios`. Así se conecta una pantalla a la vez, a medida
que el backend saca cada endpoint. El header avisa cuando hay datos de muestra.

Con datos de muestra se entra con cualquier correo y contraseña; un correo que
empieza con `soporte` entra como soporte. En el header, "Ver como" cambia de rol
para demos (solo con datos de muestra). Los premios de muestra son el catálogo
real de la app, con sus logos en `public/premios/`.

## Cómo está armado

- `src/datos/api.ts`: el cliente HTTP. Manda `Authorization: Token <clave>`
  (knox), traduce los errores de DRF y los propios del backend a mensajes del
  panel, y con un 401 vuelve al login.
- `src/datos/token.ts`: el token, en `sessionStorage` (dura lo que la pestaña).
  Nunca se muestra, ni se escribe en la bitácora, ni aparece en un error.
- `src/datos/sesion.ts`: entrar, salir, el rol y qué puede hacer cada uno.
- `src/datos/<tema>.ts`: una función por endpoint. Cada una dice qué endpoint
  llama; con datos de muestra hace lo mismo en memoria (al recargar, vuelve todo).
- `src/pages/<tema>/rutas.tsx`: las rutas de cada sección.
- Tests junto a cada archivo (`*.test.ts`). El veredicto del retroactivo usa los
  mismos casos que `Apps/policies/test_mentira_edad.py` del backend.

## Estilo

- Tokens: `src/styles/tokens.css`, la única fuente de colores, fuentes, radios y
  sombras. La paleta por defecto de Tailwind está apagada (`--color-*: initial`):
  si hace falta un color, se agrega ahí.
- Componentes: `src/components/ui/`.
- Prohibido: la mascota, ilustraciones, monedas animadas, fotos de fondo y los
  nombres Bronze/Silver/Gold/Platinum ("Nivel 3").

## Reglas

- Roles: soporte (solo lectura + verificar pólizas + marcar cupones) y admin
  (configuración, ajustes, cierres, premios, La Liga, patrocinios y bitácora). El panel oculta lo que no toca, pero quien decide
  es el servidor.
- Nunca se muestran tokens ni el encabezado Authorization.
- Los ledgers de puntos y monedas no se editan ni se borran: una corrección es una
  fila nueva, con motivo y autor.
