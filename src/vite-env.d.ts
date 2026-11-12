/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del backend de Django, sin la barra final. Por defecto http://localhost:8000. */
  readonly VITE_API_URL?: string;
  /** "mock" (por defecto) o "api". */
  readonly VITE_DATOS?: string;
  /** Secciones contra la API aunque VITE_DATOS sea mock: "sesion,polizas". */
  readonly VITE_DATOS_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
