'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui';

// ─── LAZY LOADING UTILITIES ───────────────────────────
// Performance optimization with Next.js dynamic imports

// Default loading component
const DefaultLoading = () => (
  <div className="flex items-center justify-center h-64">
    <Skeleton className="w-full h-[400px]" />
  </div>
);

// ─── LAZY PAGE COMPONENTS ─────────────────────────────
// Dashboard
export const LazyDashboard = dynamic(
  () => import('@/app/admin/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Solicitudes
export const LazySolicitudes = dynamic(
  () => import('@/app/admin/solicitudes/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Productos
export const LazyProductos = dynamic(
  () => import('@/app/admin/productos/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Proveedores
export const LazyProveedores = dynamic(
  () => import('@/app/admin/proveedores/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Usuarios
export const LazyUsuarios = dynamic(
  () => import('@/app/admin/usuarios/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Asignaciones
export const LazyAsignaciones = dynamic(
  () => import('@/app/admin/asignaciones/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Reportes
export const LazyReportes = dynamic(
  () => import('@/app/admin/reportes/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Seguimiento Proveedores
export const LazySeguimientoProveedores = dynamic(
  () => import('@/app/admin/seguimiento-proveedores/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: true,
  }
);

// Cotizar
export const LazyCotizar = dynamic(
  () => import('@/app/admin/solicitudes/[id]/cotizar/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: false,
  }
);

// Enviar Cotizacion
export const LazyEnviarCotizacion = dynamic(
  () => import('@/app/admin/solicitudes/[id]/enviar-cotizacion/page'),
  {
    loading: () => <DefaultLoading />,
    ssr: false,
  }
);

// ─── LAZY COMPONENTS ──────────────────────────────────
// KanbanBoard
export const LazyKanbanBoard = dynamic(
  () => import('@/components/KanbanBoard'),
  {
    loading: () => <DefaultLoading />,
    ssr: false,
  }
);

// ─── HOC FOR LAZY LOADING ─────────────────────────────
export function withLazyLoading<P extends object>(
  Component: React.ComponentType<P>,
  options?: { loading?: React.ReactNode; ssr?: boolean }
) {
  const LazyComponent = dynamic(
    () => Promise.resolve({ default: Component }),
    {
      loading: () => options?.loading || <DefaultLoading />,
      ssr: options?.ssr ?? true,
    }
  );

  return function LazyLoadedComponent(props: P) {
    return <LazyComponent {...props} />;
  };
}
