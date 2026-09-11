'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Eye, Plus, CheckCircle, PackageCheck } from 'lucide-react';
import { obtenerTodasSolicitudesEnTiempoReal } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import { ESTADOS_SOLICITUD } from '@/types';
import { format } from 'date-fns';
import AdminLayout from '@/components/AdminLayout';
import { formatMoney } from '@/lib/format';
import toast from 'react-hot-toast';
import { ProcesoTimeline } from '@/components/ProcesoTimeline';

const COLORS: Record<string, string> = {
  pendiente: '#f59e0b',
  en_cotizacion: '#3b82f6',
  cotizada: '#8b5cf6',
  aprobada: '#10b981',
  en_pedido: '#06b6d4',
  completada: '#10b981',
  cancelada: '#ef4444',
};

const PRI_COLORS: Record<string, string> = {
  baja: '#6b7280',
  media: '#f59e0b',
  alta: '#f97316',
  urgente: '#ef4444',
};

export default function MisSolicitudesPage() {
  const { user, loading } = useAuth();
  const { empresa } = useCompany();
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState<Solicitud | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!user || !empresa?.id) return;
    const unsub = obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sols: Solicitud[]) => {
      const mias = sols.filter((s: Solicitud) => s.emailUsuario === user.email || s.usuario === user.uid);
      setSolicitudes(mias.sort((a: Solicitud, b: Solicitud) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()));
      setCargando(false);
    });
    return () => unsub();
  }, [user, empresa?.id]);

  const handleConfirmarRecepcion = async () => {
    if (!modal || !user) return;
    setConfirmando(true);
    try {
      await fetch(`/api/solicitudes/${modal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completar', usuarioUid: user.uid, usuarioNombre: (user as any).displayName || user.email }),
      });
      try {
        await fetch('https://script.google.com/macros/s/AKfycbyMS9s2ImwWYctd7vhfA5lBpuiPx5XMIYk0wrASkEyAWtMwREOGbGB4MuABfTJC7sMM-Q/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'entrega_confirmada', solicitud: { numero: modal.numero, id: modal.id }, threadId: (modal as any).threadId || '', html: `<p>✅ El solicitante <b>${modal.nombreUsuario}</b> confirmó recepción de <b>SOL-#${modal.numero}</b> — ${modal.centroTrabajo}. Pedido entregado.</p>`, to: 'camilo13369@gmail.com', estado: 'entrega_confirmada' }),
          mode: 'no-cors',
        } as any);
      } catch {}
      toast.success('¡Recepción confirmada! Avisamos al analista y se archivará.');
      setModal(null);
    } catch { toast.error('Error confirmando recepción'); } finally { setConfirmando(false); }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-6 w-6 text-blue-600 animate-spin" /></div>;
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-[1000px] mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis Solicitudes</h1>
            <p className="text-sm text-gray-500">{solicitudes.length} solicitudes creadas</p>
          </div>
          <button onClick={() => router.push('/nueva-solicitud')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Nueva Solicitud
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div>
        ) : solicitudes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 mb-4">No has creado ninguna solicitud aun</p>
            <button onClick={() => router.push('/nueva-solicitud')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              Crear mi primera solicitud
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitudes.map(s => (
              <div key={s.id} onClick={() => setModal(s)}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: COLORS[s.estado] }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">#{s.numero}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: PRI_COLORS[s.prioridad] + '20', color: PRI_COLORS[s.prioridad] }}>
                        {s.prioridad}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {s.items?.map(i => i.descripcion).filter(Boolean).join(', ') || 'Sin productos'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {s.items?.length || 0} productos · {format(new Date(s.fechaCreacion), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[s.estado] + '15', color: COLORS[s.estado] }}>
                    {ESTADOS_SOLICITUD.find(e => e.value === s.estado)?.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Solicitud #{modal.numero}</h2>
                  <p className="text-xs text-gray-500">{format(new Date(modal.fechaCreacion), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[10px] text-gray-400">Estado</p>
                    <p className="font-medium" style={{ color: COLORS[modal.estado] }}>
                      {ESTADOS_SOLICITUD.find(e => e.value === modal.estado)?.label}
                    </p></div>
                  <div><p className="text-[10px] text-gray-400">Prioridad</p>
                    <p className="font-medium" style={{ color: PRI_COLORS[modal.prioridad] }}>
                      {modal.prioridad?.charAt(0).toUpperCase() + modal.prioridad?.slice(1)}
                    </p></div>
                  <div><p className="text-[10px] text-gray-400">Centro</p><p>{modal.centroTrabajo || '-'}</p></div>
                  <div><p className="text-[10px] text-gray-400">Empresa</p><p>{modal.empresaId}</p></div>
                </div>
                <div className="border rounded-xl p-3 bg-gray-50">
                  <p className="text-xs font-bold">🔄 Seguimiento de tu pedido</p>
                  <p className="text-xs text-gray-500 mb-2">Tu pedido ya está en proceso — el analista responde automáticamente en el mismo hilo de correo.</p>
                  <ProcesoTimeline solicitud={modal} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Productos</h4>
                  {modal.items?.map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg p-2.5 mb-1.5 text-sm flex justify-between">
                      <span>{item.descripcion} <span className="text-gray-400">x{item.cantidad}</span></span>
                      {item.cotizaciones && item.cotizaciones.length > 0 ? (
                        <span className="font-bold text-green-600">
                          {formatMoney(item.cotizaciones[item.mejorCotizacionIndex ?? 0]?.total || 0)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Sin cotizar</span>
                      )}
                    </div>
                  ))}
                </div>
                {(modal.estado === 'en_pedido' || modal.estado === 'completada') && !(modal as any).archivado && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-sm font-bold text-emerald-800 flex items-center gap-2"><PackageCheck className="h-4 w-4"/> ¿Ya recibiste el pedido?</p>
                    <p className="text-xs text-emerald-700 mt-1">Confirma la recepción para cerrar el hilo y archivar. El analista recibirá aviso en el mismo correo.</p>
                    <button onClick={handleConfirmarRecepcion} disabled={confirmando} className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2">
                      {confirmando ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4"/>} Confirmar recepción — ¡Listo!
                    </button>
                  </div>
                )}
                {modal.notas && modal.notas.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Notas:</p>
                    {modal.notas.map((nota, i) => (
                      <p key={i} className="text-blue-800">{nota.texto}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
