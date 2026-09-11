'use client';
import { Check, Clock } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Solicitud } from '@/types';
import { FLUJO_SOLICITUD } from '@/types';

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isValid(v) ? v : null;
  if (typeof v?.toDate === 'function') {
    try { const d = v.toDate(); return isValid(d) ? d : null; } catch { return null; }
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isValid(d) ? d : null;
  }
  if (typeof v === 'object' && v.seconds) {
    // Firestore Timestamp plain object
    try { const d = new Date(v.seconds * 1000); return isValid(d) ? d : null; } catch { return null; }
  }
  return null;
}

const ESTADO_ORDEN = ['pendiente','en_cotizacion','cotizada','aprobada','en_pedido','completada','cancelada'];

export function ProcesoTimeline({ solicitud }: { solicitud: Solicitud }) {
  const actualIdx = ESTADO_ORDEN.indexOf(solicitud.estado);
  const esCancelada = solicitud.estado === 'cancelada';
  const fechas: Record<string, Date | null> = {
    pendiente: toDateSafe(solicitud.fechaCreacion),
    en_cotizacion: toDateSafe((solicitud as any).fechaCotizacion) || (actualIdx>=1 ? toDateSafe(solicitud.fechaActualizacion) : null),
    cotizada: toDateSafe((solicitud as any).fechaCotizacion),
    aprobada: toDateSafe((solicitud as any).fechaAprobacion),
    en_pedido: toDateSafe((solicitud as any).fechaPedido),
    completada: solicitud.estado==='completada' ? toDateSafe(solicitud.fechaActualizacion) : null,
  };

  return (
    <div className="relative">
      {/* línea vertical */}
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />
      <div className="space-y-0">
        {FLUJO_SOLICITUD.filter(f=> f.estado!=='cancelada').map((paso, idx)=>{
          const pasoIdx = ESTADO_ORDEN.indexOf(paso.estado);
          const done = !esCancelada && actualIdx > pasoIdx;
          const current = !esCancelada && actualIdx === pasoIdx;
          const pending = !esCancelada && actualIdx < pasoIdx;
          const fecha = fechas[paso.estado];
          return (
            <div key={paso.estado} className="relative flex gap-4 pb-6 last:pb-0">
              <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 border-2 z-10 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : current ? 'bg-blue-600 border-blue-600 text-white animate-pulse shadow-lg shadow-blue-200' : pending ? 'bg-white border-gray-300 text-gray-400' : 'bg-white border-gray-200'}`}>
                {done ? <Check className="h-4 w-4"/> : current ? <Clock className="h-4 w-4"/> : <span className="text-xs">{paso.icon}</span>}
              </div>
              <div className={`flex-1 min-w-0 rounded-xl p-3 border ${current ? 'bg-blue-50 border-blue-200' : done ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-bold ${current ? 'text-blue-900' : done ? 'text-emerald-800' : 'text-gray-500'}`}>{paso.label}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${done ? 'bg-emerald-500 text-white' : current ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{done ? 'Hecho' : current ? 'En curso' : 'Pendiente'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{paso.descripcion}</p>
                {fecha && isValid(fecha) && <p className="text-xs text-gray-400 mt-1">📅 {format(fecha, "d MMM yyyy, HH:mm",{locale: es})} {paso.estado==='en_cotizacion' ? `· por ${(solicitud as any).cotizadoPorNombre || 'Analista'}` : ''}</p>}
                {current && <p className="text-xs text-blue-700 mt-2 bg-white border border-blue-100 rounded-lg px-2.5 py-1.5">El analista está trabajando aquí — el usuario ya ve su pedido en curso y recibe actualización automática por correo en el mismo hilo [SOL-#{solicitud.numero}].</p>}
                {done && paso.estado==='en_cotizacion' && (solicitud as any).archivos?.length>0 && <p className="text-xs text-emerald-700 mt-1">📎 { (solicitud as any).archivos.length} archivo(s) adjuntos como evidencia</p>}
              </div>
            </div>
          );
        })}
        {esCancelada && (
          <div className="relative flex gap-4">
            <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-red-500 text-white grid place-items-center"><span className="text-xs">❌</span></div>
            <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-bold text-red-800">Cancelada</p>
              <p className="text-xs text-red-600">{(solicitud as any).motivoRechazo || 'Sin motivo'}</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 bg-gray-900 text-white rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-xs opacity-70">Estado actual</p>
          <p className="text-sm font-black">{FLUJO_SOLICITUD.find(f=>f.estado===solicitud.estado)?.label || solicitud.estado} {solicitud.numeroPedido ? `· ${solicitud.numeroPedido}` : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-xs opacity-70">Progreso</p>
          <p className="text-sm font-mono font-bold">{esCancelada ? '—' : `${Math.round(((actualIdx+1)/6)*100)}%`}</p>
        </div>
      </div>
    </div>
  );
}
