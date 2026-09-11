'use client';

import { usePermissions } from '@/hooks/usePermissions';
import type { Permiso, AccionSolicitud } from '@/lib/permissions';
import type { Solicitud } from '@/types';

// ─── COMPONENTE PERMISSION GATE ───────────────────────
// RBAC: Renderiza children solo si el usuario tiene el permiso

interface PermissionGateProps {
  permiso?: Permiso;
  accion?: { estado: string; accion: AccionSolicitud; solicitud?: Solicitud };
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permiso,
  accion,
  fallback = null,
  children,
}: PermissionGateProps) {
  const permissions = usePermissions();

  let tieneAcceso = false;

  if (permiso) {
    tieneAcceso = permissions.tienePermiso(permiso);
  } else if (accion) {
    tieneAcceso = permissions.puedeRealizarAccion(
      accion.estado,
      accion.accion,
      accion.solicitud
    );
  }

  if (!tieneAcceso) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// ─── COMPONENTE ROLE GATE ─────────────────────────────
// RBAC: Renderiza children solo si el usuario tiene uno de los roles

interface RoleGateProps {
  roles: string[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGate({
  roles,
  fallback = null,
  children,
}: RoleGateProps) {
  const { rol } = usePermissions();

  if (!roles.includes(rol)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
