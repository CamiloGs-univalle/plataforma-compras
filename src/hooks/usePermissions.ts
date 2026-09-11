'use client';

import { useAuth } from '@/contexts/AuthContext';
import { tienePermiso, puedeRealizarAccion, type Permiso, type AccionSolicitud } from '@/lib/permissions';
import type { Solicitud } from '@/types';

// ─── HOOK DE PERMISOS ─────────────────────────────────
// RBAC: Hook para verificar permisos en componentes UI

export function usePermissions() {
  const { usuario } = useAuth();
  const rol = usuario?.rol as any;

  return {
    // Verificar un permiso específico
    tienePermiso: (permiso: Permiso): boolean => {
      if (!rol) return false;
      return tienePermiso(rol, permiso);
    },

    // Verificar si puede realizar una acción en una solicitud
    puedeRealizarAccion: (
      estado: string,
      accion: AccionSolicitud,
      solicitud?: Solicitud
    ): boolean => {
      if (!rol) return false;
      return puedeRealizarAccion(rol, estado, accion, usuario?.uid, solicitud);
    },

    // Verificar si puede ver datos de una empresa específica
    puedeVerDatosEmpresa: (empresaIdRecurso: string): boolean => {
      if (!usuario?.empresaActual) return false;
      if (rol === 'super_admin') return true;
      return usuario.empresaActual === empresaIdRecurso;
    },

    // Getters útiles
    rol,
    esSuperAdmin: rol === 'super_admin',
    esAdmin: rol === 'admin',
    esAbastecimiento: rol === 'abastecimiento',
    esSolicitante: rol === 'solicitante',
  };
}
