import type { RolUsuario, Solicitud } from '@/types';

// ─── PERMISOS POR ROL ─────────────────────────────────
// RBAC: Cada rol tiene permisos específicos sobre qué puede hacer

export type Permiso =
  // Empresas
  | 'empresas:ver'
  | 'empresas:crear'
  | 'empresas:editar'
  | 'empresas:eliminar'
  // Solicitudes
  | 'solicitudes:ver_todas'
  | 'solicitudes:ver_propias'
  | 'solicitudes:crear'
  | 'solicitudes:cotizar'
  | 'solicitudes:aprobar'
  | 'solicitudes:rechazar'
  | 'solicitudes:cancelar'
  // Productos
  | 'productos:ver'
  | 'productos:crear'
  | 'productos:editar'
  | 'productos:eliminar'
  // Proveedores
  | 'proveedores:ver'
  | 'proveedores:crear'
  | 'proveedores:editar'
  | 'proveedores:eliminar'
  // Usuarios
  | 'usuarios:ver'
  | 'usuarios:crear'
  | 'usuarios:editar'
  | 'usuarios:eliminar'
  // Asignaciones
  | 'asignaciones:ver'
  | 'asignaciones:crear'
  | 'asignaciones:editar'
  | 'asignaciones:eliminar'
  // Reportes
  | 'reportes:ver';

// RBAC Matrix: Qué puede hacer cada rol
const PERMISOS_POR_ROL: Record<RolUsuario, Permiso[]> = {
  // SUPER_ADMIN: Solo gestiona empresas y ve usuarios a nivel global
  super_admin: [
    'empresas:ver',
    'empresas:crear',
    'empresas:editar',
    'empresas:eliminar',
    'usuarios:ver',
    'usuarios:crear',
    'usuarios:editar',
    'usuarios:eliminar',
  ],
  // ADMIN: CRUD completo dentro de su empresa
  admin: [
    'solicitudes:ver_todas',
    'solicitudes:crear',
    'solicitudes:cotizar',
    'solicitudes:aprobar',
    'solicitudes:rechazar',
    'solicitudes:cancelar',
    'productos:ver',
    'productos:crear',
    'productos:editar',
    'productos:eliminar',
    'proveedores:ver',
    'proveedores:crear',
    'proveedores:editar',
    'proveedores:eliminar',
    'usuarios:ver',
    'usuarios:crear',
    'usuarios:editar',
    'usuarios:eliminar',
    'asignaciones:ver',
    'asignaciones:crear',
    'asignaciones:editar',
    'asignaciones:eliminar',
    'reportes:ver',
  ],
  // ABASTECIMIENTO: Solo cotizaciones y proveedores
  abastecimiento: [
    'solicitudes:ver_todas',
    'solicitudes:cotizar',
    'solicitudes:aprobar',
    'solicitudes:rechazar',
    'proveedores:ver',
    'proveedores:crear',
    'proveedores:editar',
    'reportes:ver',
  ],
  // SOLICITANTE: Solo crea y ve sus solicitudes
  solicitante: [
    'solicitudes:ver_propias',
    'solicitudes:crear',
    'solicitudes:cancelar',
  ],
};

// ─── FUNCIONES DE VERIFICACION ───────────────────────

export function tienePermiso(rol: RolUsuario, permiso: Permiso): boolean {
  const permisos = PERMISOS_POR_ROL[rol] || [];
  return permisos.includes(permiso);
}

export function tieneAlgunPermiso(rol: RolUsuario, permisos: Permiso[]): boolean {
  return permisos.some(p => tienePermiso(rol, p));
}

// ─── ACCIONES POR ESTADO (RBAC) ──────────────────────
// Quién puede hacer qué en cada estado de la solicitud

export type AccionSolicitud =
  | 'iniciar_cotizacion'
  | 'enviar_cotizacion'
  | 'aprobar'
  | 'rechazar'
  | 'generar_pedido'
  | 'completar'
  | 'cancelar';

export function puedeRealizarAccion(
  rol: RolUsuario,
  estado: string,
  accion: AccionSolicitud,
  usuarioUid?: string,
  solicitud?: Solicitud
): boolean {
  // RBAC: Verificar permisos por rol
  switch (accion) {
    case 'iniciar_cotizacion':
      return tienePermiso(rol, 'solicitudes:cotizar') &&
        ['pendiente'].includes(estado);

    case 'enviar_cotizacion':
      return tienePermiso(rol, 'solicitudes:cotizar') &&
        ['en_cotizacion'].includes(estado);

    case 'aprobar':
      return tienePermiso(rol, 'solicitudes:aprobar') &&
        ['cotizada'].includes(estado);

    case 'rechazar':
      return tienePermiso(rol, 'solicitudes:rechazar') &&
        ['cotizada'].includes(estado);

    case 'generar_pedido':
      return tienePermiso(rol, 'solicitudes:cotizar') &&
        ['aprobada'].includes(estado);

    case 'completar':
      return tienePermiso(rol, 'solicitudes:cotizar') &&
        ['en_pedido'].includes(estado);

    case 'cancelar':
      return tienePermiso(rol, 'solicitudes:cancelar') &&
        !['completada', 'cancelada'].includes(estado);

    default:
      return false;
  }
}

// ─── VERIFICACION DE AISLAMIENTO ─────────────────────
// RBAC: ADMIN y OPERADOR solo ven datos de su empresa

export function puedeVerDatosEmpresa(
  rol: RolUsuario,
  empresaIdDelUsuario: string,
  empresaIdDelRecurso: string
): boolean {
  // SUPER_ADMIN puede ver todo
  if (rol === 'super_admin') return true;
  // Los demás solo ven su empresa
  return empresaIdDelUsuario === empresaIdDelRecurso;
}

// ─── FUNCIONES DE SEGURIDAD ──────────────────────────

export function validarYLimpiarDatos<T extends Record<string, any>>(
  datos: T,
  camposPermitidos: string[]
): Partial<T> {
  const limpio: any = {};
  for (const key of camposPermitidos) {
    if (datos[key] !== undefined) {
      limpio[key] = datos[key];
    }
  }
  return limpio;
}

// RBAC: Campos que cada rol puede modificar
export const CAMPOS_EDITABLES_POR_ROL: Record<RolUsuario, string[]> = {
  super_admin: ['nombre', 'email', 'rol', 'empresas', 'activo'],
  admin: ['nombre', 'email', 'rol', 'activo'],
  abastecimiento: ['nombre', 'email'],
  solicitante: ['nombre'],
};
