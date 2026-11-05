import type { RouteObject } from 'react-router';
import { FichaUsuario } from './FichaUsuario';
import { ListaUsuarios } from './ListaUsuarios';

export const rutasUsuarios: RouteObject[] = [
  { path: 'usuarios', element: <ListaUsuarios /> },
  { path: 'usuarios/:usuarioId', element: <FichaUsuario /> },
];
