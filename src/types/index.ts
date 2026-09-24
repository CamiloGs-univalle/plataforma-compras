// Tipos para la plataforma multi-empresas

export interface Empresa {
  id: string;
  nombre: string;
  nit: string;
  color: string;
  colorSecundario?: string;
  logo?: string;
  activa: boolean;
  fechaCreacion: Date;
}

// ─── ROLES ───────────────────────────────────────────────
// super_admin: Dueño total. Ve todo, gestiona todo, todas las empresas.
// admin: Analista de compras. CRUD completo de productos, proveedores, usuarios, solicitudes.
// abastecimiento: Gestiona cotizaciones, proveedores, seguimiento de pedidos.
// solicitante: Crea solicitudes y da seguimiento a las suyas.
export type RolUsuario = 'solicitante' | 'abastecimiento' | 'admin' | 'super_admin';

export interface UsuarioEmpresa {
  id?: string;
  uid: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  empresas: string[];
  empresaActual?: string;
  activo: boolean;
  fechaCreacion: Date;
}

export const ROLES_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    color: '#7c3aed',
    descripcion: 'Control total del sistema',
  },
  admin: {
    label: 'Admin',
    color: '#2563eb',
    descripcion: 'Analista de compras',
  },
  abastecimiento: {
    label: 'Abastecimiento',
    color: '#059669',
    descripcion: 'Gestion de cotizaciones',
  },
  solicitante: {
    label: 'Solicitante',
    color: '#d97706',
    descripcion: 'Creacion de solicitudes',
  },
} as const;

// ─── ASIGNACIONES ────────────────────────────────────────
export interface Asignacion {
  id: string;
  empresaId: string;
  uid: string;
  cedula?: string;
  nombre?: string;
  centroTrabajo: string;
  cliente: string;
  contrato: string;
  unidadNegocio: string;
  proyecto: string;
  sucursal: string;
}

// ─── PRODUCTOS ───────────────────────────────────────────
export interface Producto {
  id: string;
  empresaId: string;
  codigo: string;
  descripcion: string;
  cuentaMayor: string;
  nombreCuentaMayor: string;
  precioUnitario: number;
  indicadorImpuestos: string;
  activo: boolean;
  grupo?: string;
  unidad?: string;
  stockMinimo?: number;
  stockMaximo?: number;
}

// ─── PROVEEDORES ─────────────────────────────────────────
export interface Proveedor {
  id: string;
  empresaId: string;
  codigo: string;
  descripcion: string;
  grupoArticulo: string;
  precios: { [proveedor: string]: number };
  nit?: string;
  razonSocial?: string;
  contacto?: string;
  email?: string;
  telefono?: string;
  ciudad?: string;
  estado?: 'Activo' | 'Inactivo';
}

// ─── SOLICITUDES ─────────────────────────────────────────
export interface CotizacionItem {
  proveedor: string;
  precioUnitario: number;
  porcentajeIva: number;
  valorIva: number;
  precioConIva: number;
  cantidad: number;
  subtotal: number;
  total: number;
  archivoCotizacion?: string;
  archivoCotizacionNombre?: string;
  observaciones?: string;
}

export interface ItemSolicitud {
  codigoProducto: string;
  descripcion: string;
  cantidad: number;
  // Segunda columna "Cantidad" de la grilla SAP (ver ESCTRUCTURA DEL SAP) — en la captura
  // contiene SANIMAX-AMAGA / jhonatan suarez. Es el detalle libre de la línea (centro
  // de trabajo específico o beneficiario). Por defecto se hereda el centroTrabajo de la solicitud.
  cantidadDetalle?: string;
  cliente: string;
  contrato: string;
  unidadNegocio: string;
  sucursal: string;
  ciudad: string;
  proyecto: string;
  cuentaMayor: string;
  nombreCuentaMayor: string;
  precioUnitario: number;
  indicadorImpuestos: string;
  // Cotizaciones del analista (multiples por item)
  cotizaciones: CotizacionItem[];
  // Mejor cotizacion seleccionada
  mejorCotizacionIndex?: number;
  // Estado de aprobacion del item
  estadoItem: 'pendiente' | 'cotizado' | 'aprobado' | 'rechazado';
  observacionesAprobacion?: string;
}

export interface NotaSolicitud {
  id: string;
  texto: string;
  autor: string;
  fecha: Date;
  tipo?: 'general' | 'cotizacion' | 'aprobacion' | 'rechazo';
}

export interface ArchivoSolicitud {
  id: string;
  nombre: string;
  descripcion: string;
  base64: string; // data:application/pdf;base64,...
  tipo?: string; // mime
  tamano?: number;
  fecha: Date;
  autor?: string;
}

export interface Solicitud {
  id: string;
  empresaId: string;
  numero?: number;
  usuario: string;
  nombreUsuario: string;
  emailUsuario: string;
  centroTrabajo: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  fechaRequerida?: string;
  observaciones?: string;
  items: ItemSolicitud[];
  // Marca si es un pedido recurrente/concurrente ya negociado (compra directa sin cotización)
  esCompraDirecta?: boolean;
  // Nuevo flujo de trabajo
  estado: 'pendiente' | 'en_cotizacion' | 'cotizada' | 'aprobada' | 'en_pedido' | 'completada' | 'cancelada';
  // Quien cotizo
  cotizadoPor?: string;
  cotizadoPorNombre?: string;
  fechaCotizacion?: Date;
  // Aprobacion
  aprobadoPor?: string;
  aprobadoPorNombre?: string;
  fechaAprobacion?: Date;
  motivoRechazo?: string;
  // Pedido
  numeroPedido?: string;
  fechaPedido?: Date;
  // Notas y archivos
  notas?: NotaSolicitud[];
  archivos?: ArchivoSolicitud[];
  // Historial / archivo
  archivado?: boolean;
  fechaArchivado?: Date;
  facturaEstado?: 'pendiente' | 'en_revision' | 'aprobada' | 'pagada' | 'rechazada';
  fechaFacturaArchivado?: Date;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

// ─── FLUJO DE TRABAJO ────────────────────────────────────
export interface PasoFlujo {
  estado: string;
  label: string;
  icon: string;
  color: string;
  rolesPermitidos: string[];
  descripcion: string;
}

export const FLUJO_SOLICITUD: PasoFlujo[] = [
  { estado: 'pendiente', label: 'Solicitud Creada', icon: '📝', color: '#f59e0b', rolesPermitidos: ['solicitante', 'admin', 'super_admin'], descripcion: 'El solicitante crea la solicitud' },
  { estado: 'en_cotizacion', label: 'En Cotizacion', icon: '🔍', color: '#3b82f6', rolesPermitidos: ['abastecimiento', 'admin', 'super_admin'], descripcion: 'Analista busca precios y proveedores' },
  { estado: 'cotizada', label: 'Cotizada', icon: '💰', color: '#8b5cf6', rolesPermitidos: ['abastecimiento', 'admin', 'super_admin'], descripcion: 'Analista envia cotizacion para aprobacion' },
  { estado: 'aprobada', label: 'Aprobada', icon: '✅', color: '#10b981', rolesPermitidos: ['solicitante', 'admin', 'super_admin'], descripcion: 'Solicitante o jefe aprueba la cotizacion' },
  { estado: 'en_pedido', label: 'En Pedido', icon: '🛒', color: '#06b6d4', rolesPermitidos: ['abastecimiento', 'admin', 'super_admin'], descripcion: 'Se genera la orden de compra' },
  { estado: 'completada', label: 'Completada', icon: '🎉', color: '#10b981', rolesPermitidos: ['abastecimiento', 'admin', 'super_admin'], descripcion: 'Pedido entregado y cerrado' },
  { estado: 'cancelada', label: 'Cancelada', icon: '❌', color: '#ef4444', rolesPermitidos: ['solicitante', 'admin', 'super_admin'], descripcion: 'Solicitud cancelada en cualquier paso' },
];

export const IVA_OPCIONES = [
  { value: 0, label: 'Sin IVA (0%)' },
  { value: 5, label: 'IVA 5%' },
  { value: 8, label: 'IVA 8%' },
  { value: 16, label: 'IVA 16%' },
  { value: 19, label: 'IVA 19%' },
  { value: 21, label: 'IVA 21%' },
  { value: 25, label: 'IVA 25%' },
] as const;

// ─── CONSTANTES UI ───────────────────────────────────────
export const ESTADOS_SOLICITUD = [
  { value: 'pendiente', label: 'Pendiente', color: '#f59e0b', icon: '⏳' },
  { value: 'en_cotizacion', label: 'En Cotizacion', color: '#3b82f6', icon: '🔍' },
  { value: 'cotizada', label: 'Cotizada', color: '#8b5cf6', icon: '💰' },
  { value: 'aprobada', label: 'Aprobada', color: '#10b981', icon: '✅' },
  { value: 'en_pedido', label: 'En Pedido', color: '#06b6d4', icon: '🛒' },
  { value: 'completada', label: 'Completada', color: '#10b981', icon: '🎉' },
  { value: 'cancelada', label: 'Cancelada', color: '#ef4444', icon: '❌' },
] as const;

export const ACCIONES_POR_ESTADO: Record<string, { siguiente: string; label: string; icon: string; roles: string[] }[]> = {
  pendiente: [
    { siguiente: 'en_cotizacion', label: 'Iniciar Cotizacion', icon: '🔍', roles: ['abastecimiento', 'admin', 'super_admin'] },
    { siguiente: 'cancelada', label: 'Cancelar', icon: '❌', roles: ['solicitante', 'admin', 'super_admin'] },
  ],
  en_cotizacion: [
    { siguiente: 'cotizada', label: 'Enviar Cotizacion', icon: '💰', roles: ['abastecimiento', 'admin', 'super_admin'] },
    { siguiente: 'cancelada', label: 'Cancelar', icon: '❌', roles: ['solicitante', 'admin', 'super_admin'] },
  ],
  cotizada: [
    { siguiente: 'aprobada', label: 'Aprobar', icon: '✅', roles: ['solicitante', 'admin', 'super_admin'] },
    { siguiente: 'en_cotizacion', label: 'Rechazar (volver a cotizar)', icon: '🔄', roles: ['solicitante', 'admin', 'super_admin'] },
    { siguiente: 'cancelada', label: 'Cancelar', icon: '❌', roles: ['solicitante', 'admin', 'super_admin'] },
  ],
  aprobada: [
    { siguiente: 'en_pedido', label: 'Generar Pedido', icon: '🛒', roles: ['abastecimiento', 'admin', 'super_admin'] },
    { siguiente: 'cancelada', label: 'Cancelar', icon: '❌', roles: ['solicitante', 'admin', 'super_admin'] },
  ],
  en_pedido: [
    { siguiente: 'completada', label: 'Marcar Completada', icon: '🎉', roles: ['abastecimiento', 'admin', 'super_admin'] },
  ],
};

export const PRIORIDADES = [
  { value: 'baja', label: 'Baja', color: '#6b7280' },
  { value: 'media', label: 'Media', color: '#f59e0b' },
  { value: 'alta', label: 'Alta', color: '#f97316' },
  { value: 'urgente', label: 'Urgente', color: '#ef4444' },
] as const;

// ─── NAVEGACION POR ROL ─────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

// RBAC: SUPER_ADMIN solo gestiona empresas. NO accede a modulos internos.
// RBAC: ADMIN gestiona todo dentro de su empresa.
// RBAC: ABASTECIMIENTO solo cotizaciones y proveedores.
// RBAC: SOLICITANTE solo crea y consulta sus solicitudes.
export const NAV_POR_ROL: Record<RolUsuario, NavItem[]> = {
  super_admin: [
    { label: 'Empresas', href: '/admin/empresas', icon: '🏢' },
    { label: 'Usuarios Global', href: '/admin/usuarios', icon: '👥' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Solicitudes', href: '/admin/solicitudes', icon: '📋' },
    { label: 'Seguimiento Pedidos', href: '/admin/seguimiento-pedidos', icon: '🚚' },
    { label: 'Facturacion', href: '/admin/facturacion', icon: '📄' },
    { label: 'Productos', href: '/admin/productos', icon: '📦' },
    { label: 'Proveedores', href: '/admin/proveedores', icon: '🏪' },
    { label: 'Asignaciones', href: '/admin/asignaciones', icon: '🔗' },
    { label: 'Usuarios', href: '/admin/usuarios', icon: '👥' },
    { label: 'Reportes', href: '/admin/reportes', icon: '📈' },
    { label: 'Historial', href: '/admin/historial', icon: '🗂️' },
    { label: 'Logs Correos', href: '/admin/logs', icon: '📧' },
  ],
  abastecimiento: [
    { label: 'Dashboard', href: '/admin', icon: '📊' },
    { label: 'Cotizaciones', href: '/admin/solicitudes', icon: '💰' },
    { label: 'Seguimiento Pedidos', href: '/admin/seguimiento-pedidos', icon: '🚚' },
    { label: 'Facturacion', href: '/admin/facturacion', icon: '📄' },
    { label: 'Seguimiento Proveedores', href: '/admin/seguimiento-proveedores', icon: '📈' },
    { label: 'Proveedores', href: '/admin/proveedores', icon: '🏪' },
  ],
  solicitante: [
    { label: 'Nueva Solicitud', href: '/nueva-solicitud', icon: '➕' },
    { label: 'Mis Solicitudes', href: '/mis-solicitudes', icon: '📋' },
  ],
};
