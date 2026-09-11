'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        pendiente: 'bg-amber-100 text-amber-800 border border-amber-200',
        en_cotizacion: 'bg-blue-100 text-blue-800 border border-blue-200',
        cotizada: 'bg-purple-100 text-purple-800 border border-purple-200',
        aprobada: 'bg-green-100 text-green-800 border border-green-200',
        en_pedido: 'bg-orange-100 text-orange-800 border border-orange-200',
        completada: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        cancelada: 'bg-red-100 text-red-800 border border-red-200',
      },
    },
    defaultVariants: {
      variant: 'pendiente',
    },
  }
);

const statusIcons: Record<string, string> = {
  pendiente: '⏳',
  en_cotizacion: '💬',
  cotizada: '📋',
  aprobada: '✅',
  en_pedido: '🛒',
  completada: '🎉',
  cancelada: '❌',
};

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  en_cotizacion: 'En Cotización',
  cotizada: 'Cotizada',
  aprobada: 'Aprobada',
  en_pedido: 'En Pedido',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ variant, showIcon = true, className }: StatusBadgeProps) {
  const status = variant || 'pendiente';
  return (
    <span className={cn(statusBadgeVariants({ variant: status }), className)}>
      {showIcon && <span>{statusIcons[status]}</span>}
      {statusLabels[status]}
    </span>
  );
}

export { statusBadgeVariants };
