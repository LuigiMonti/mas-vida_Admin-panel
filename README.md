# Panel de administración de +vida

Frontend del panel (React + TypeScript + Vite + Tailwind v4). Alcance actual: lo imprescindible para el piloto (usuarios y pólizas, retroactivo denegado, objetivo semanal y su cierre, ledger de solo lectura, soporte de sync, reglas y bitácora). Consume la API
`/api/v1/admin/` del backend Django (`mas-vida_backend`). Qué tiene que hacer:
`panel-admin.md`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build
```

## Estilo

- Tokens: `src/styles/tokens.css`, la única fuente de colores, fuentes, radios y
  sombras. La paleta por defecto de Tailwind está apagada (`--color-*: initial`):
  si hace falta un color, se agrega ahí.
- Componentes: `src/components/ui/`.
- Datos: `src/datos/`. Hoy son mocks en memoria con la forma de los modelos de Django; después cada función llama a `/api/v1/admin/` con la misma firma.
- Rutas: cada tema define las suyas en `src/pages/<tema>/rutas.tsx`.
- Prohibido: la mascota, ilustraciones, monedas animadas, fotos de fondo y los
  nombres Bronze/Silver/Gold/Platinum ("Nivel 3").
- Roles: soporte (solo lectura + verificar pólizas) y admin (configuración). Ver `src/datos/sesion.ts`.
- Nunca se muestran tokens ni el encabezado Authorization.
- Los ledgers de puntos y monedas no se editan ni se borran: una corrección es una
  fila nueva de signo contrario, con motivo y autor.
