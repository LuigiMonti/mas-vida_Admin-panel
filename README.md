# Panel de administración de +vida

Frontend del panel (React + TypeScript + Vite + Tailwind v4). Consume la API
`/api/v1/admin/` del backend Django (`mas-vida_backend`). Qué tiene que hacer:
`panel-admin.md`.

```bash
npm install
npm run dev        # http://localhost:5173 → abre /estilo
npm run build      # typecheck + build
```

## Estilo

- Tokens: `src/styles/tokens.css`, la única fuente de colores, fuentes, radios y
  sombras. La paleta por defecto de Tailwind está apagada (`--color-*: initial`):
  si hace falta un color, se agrega ahí.
- Componentes: `src/components/ui/`. Guía viva en `/estilo`.
- Prohibido: la mascota, ilustraciones, monedas animadas, fotos de fondo y los
  nombres Bronze/Silver/Gold/Platinum ("Nivel 3").
- Los ledgers de puntos y monedas no se editan ni se borran: una corrección es una
  fila nueva de signo contrario, con motivo y autor.
