'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, CheckCircle, XCircle, PackageCheck, Sparkles,
  Search, Inbox, Clock, ThumbsUp, ThumbsDown, AlertCircle,
} from 'lucide-react';
import { obtenerTodasSolicitudesEnTiempoReal } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import { ESTADOS_SOLICITUD, PRIORIDADES } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import AdminLayout from '@/components/AdminLayout';
import { formatMoney } from '@/lib/format';
import toast from 'react-hot-toast';
import { ProcesoTimeline } from '@/components/ProcesoTimeline';
import { StatusBadge } from '@/components/ui/status-badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Grupos usados para los filtros rapidos de arriba. "accion" agrupa los
// estados donde el solicitante tiene algo que hacer (hoy: aprobar/rechazar
// la cotizacion, o confirmar que ya recibio el pedido).
const GRUPOS = [
  { key: 'accion', label: 'Requieren tu accion', estados: ['cotizada'] },
  { key: 'proceso', label: 'En proceso', estados: ['pendiente', 'en_cotizacion', 'aprobada', 'en_pedido'] },
  { key: 'completada', label: 'Completadas', estados: ['completada'] },
  { key: 'cancelada', label: 'Canceladas', estados: ['cancelada'] },
] as const;

function estadoInfo(estado: string) {
  return ESTADOS_SOLICITUD.find(e => e.value === estado);
}

function prioridadInfo(prioridad: string) {
  return PRIORIDADES.find(p => p.value === prioridad) || PRIORIDADES[1];
}

// Confirma que el pedido requiere que el usuario haga algo AHORA.
function requiereAccion(s: Solicitud): boolean {
  return s.estado === 'cotizada' || (s.estado === 'en_pedido' && !s.archivado);
}

export default function MisSolicitudesPage() {
  const { user, usuario, loading } = useAuth();
  const { empresa } = useCompany();
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalId, setModalId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  useEffect(() => {
    if (!user || !empresa?.id) return;
    const unsub = obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sols: Solicitud[]) => {
      const mias = sols.filter((s: Solicitud) => s.emailUsuario === user.email || s.usuario === user.uid);
      setSolicitudes(mias.sort((a: Solicitud, b: Solicitud) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime()));
      setCargando(false);
    });
    return () => unsub();
  }, [user, empresa?.id]);

  const modal = useMemo(() => solicitudes.find(s => s.id === modalId) || null, [solicitudes, modalId]);

  const conteos = useMemo(() => {
    const base: Record<string, number> = { todas: solicitudes.length };
    GRUPOS.forEach(g => { base[g.key] = solicitudes.filter(s => (g.estados as readonly string[]).includes(s.estado)).length; });
    return base;
  }, [solicitudes]);

  const solicitudesFiltradas = useMemo(() => {
    let lista = solicitudes;
    if (filtro !== 'todas') {
      const grupo = GRUPOS.find(g => g.key === filtro);
      if (grupo) lista = lista.filter(s => (grupo.estados as readonly string[]).includes(s.estado));
    }
    if (busqueda.trim()) {
      const term = busqueda.trim().toLowerCase();
      lista = lista.filter(s =>
        String(s.numero || '').includes(term) ||
        s.centroTrabajo?.toLowerCase().includes(term) ||
        s.items?.some(i => i.descripcion?.toLowerCase().includes(term))
      );
    }
    return lista;
  }, [solicitudes, filtro, busqueda]);

  const notificarAnalista = async (html: string, estado: string) => {
    if (!modal) return;
    try {
      await fetch('https://script.google.com/macros/s/AKfycbyMS9s2ImwWYctd7vhfA5lBpuiPx5XMIYk0wrASkEyAWtMwREOGbGB4MuABfTJC7sMM-Q/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: `${estado}_solicitante`, solicitud: { numero: modal.numero, id: modal.id }, threadId: (modal as unknown as { threadId?: string }).threadId || '', html, to: 'camilo13369@gmail.com', estado }),
        mode: 'no-cors',
      });
    } catch {}
  };

  const handleAprobar = async () => {
    if (!modal || !user || !usuario) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/solicitudes/${modal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aprobar', usuarioUid: user.uid, usuarioNombre: usuario.nombre || user.email }),
      });
      if (!res.ok) throw new Error('fallo aprobar');
      await notificarAnalista(`<p>✅ <b>${usuario.nombre}</b> aprobó la cotización de <b>SOL-#${modal.numero}</b> — ${modal.centroTrabajo}. Ya puede generar el pedido.</p>`, 'aprobada');
      toast.success('¡Cotización aprobada! Avisamos al analista para que genere el pedido.');
    } catch {
      toast.error('No se pudo aprobar. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  const handleRechazar = async () => {
    if (!modal || !user || !usuario || !motivoRechazo.trim()) return;
    setProcesando(true);
    try {
      const res = await fetch(`/api/solicitudes/${modal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rechazar', motivo: motivoRechazo.trim(), usuarioUid: user.uid, usuarioNombre: usuario.nombre || user.email }),
      });
      if (!res.ok) throw new Error('fallo rechazar');
      await notificarAnalista(`<p>⚠️ <b>${usuario.nombre}</b> rechazó la cotización de <b>SOL-#${modal.numero}</b> — ${modal.centroTrabajo}. Motivo: ${motivoRechazo.trim()}</p>`, 'rechazada');
      toast.success('Cotización rechazada — el analista volverá a cotizar.');
      setMostrarRechazo(false);
      setMotivoRechazo('');
    } catch {
      toast.error('No se pudo rechazar. Intenta de nuevo.');
    } finally {
      setProcesando(false);
    }
  };

  const handleConfirmarRecepcion = async () => {
    if (!modal || !user) return;
    setProcesando(true);
    try {
      await fetch(`/api/solicitudes/${modal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'completar', usuarioUid: user.uid, usuarioNombre: user.displayName || user.email }),
      });
      await notificarAnalista(`<p>📦 El solicitante <b>${modal.nombreUsuario}</b> confirmó recepción de <b>SOL-#${modal.numero}</b> — ${modal.centroTrabajo}. Pedido entregado.</p>`, 'entrega_confirmada');
      toast.success('¡Recepción confirmada! Avisamos al analista y se archivará.');
      setModalId(null);
    } catch {
      toast.error('Error confirmando recepción');
    } finally {
      setProcesando(false);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-6 w-6 text-blue-600 animate-spin" /></div>;
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-[1100px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mis Solicitudes</h1>
            <p className="text-sm text-gray-500">{solicitudes.length} solicitudes creadas</p>
          </div>
          <button onClick={() => router.push('/nueva-solicitud')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 shadow-sm">
            <Plus className="h-4 w-4" /> Nueva Solicitud
          </button>
        </div>

        {!cargando && solicitudes.length > 0 && (
          <>
            {/* Filtros rapidos por estado — para ver de un vistazo que necesita atencion */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFiltro('todas')}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                  filtro === 'todas' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                Todas <span className="opacity-70">({conteos.todas})</span>
              </button>
              {GRUPOS.map(g => {
                const activo = filtro === g.key;
                const esAccion = g.key === 'accion';
                if (g.key !== 'accion' && conteos[g.key] === 0) return null;
                return (
                  <button
                    key={g.key}
                    onClick={() => setFiltro(g.key)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      activo
                        ? esAccion ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-900 text-white border-gray-900'
                        : esAccion && conteos[g.key] > 0
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}>
                    {esAccion && conteos[g.key] > 0 && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
                    {g.label} <span className="opacity-70">({conteos[g.key]})</span>
                  </button>
                );
              })}
              <div className="relative ml-auto min-w-[180px] flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar # o producto..." className="pl-8 h-8 text-xs" />
              </div>
            </div>

            {/* Banner cuando hay solicitudes esperando aprobacion — visible aunque el filtro este en "Todas" */}
            {filtro !== 'accion' && conteos.accion > 0 && (
              <button onClick={() => setFiltro('accion')} className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left hover:bg-amber-100/60 transition-colors">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 flex-1">
                  Tienes <b>{conteos.accion}</b> {conteos.accion === 1 ? 'solicitud cotizada esperando' : 'solicitudes cotizadas esperando'} tu aprobación.
                </p>
                <span className="text-xs font-semibold text-amber-700 underline shrink-0">Revisar ahora</span>
              </button>
            )}
          </>
        )}

        {cargando ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div>
        ) : solicitudes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 mb-4">No has creado ninguna solicitud aun</p>
            <button onClick={() => router.push('/nueva-solicitud')}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              Crear mi primera solicitud
            </button>
          </div>
        ) : solicitudesFiltradas.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
            No hay solicitudes en este filtro.
          </div>
        ) : (
          <div className="space-y-2.5">
            {solicitudesFiltradas.map(s => {
              const info = estadoInfo(s.estado);
              const pri = prioridadInfo(s.prioridad);
              const accion = requiereAccion(s);
              return (
                <div key={s.id} onClick={() => setModalId(s.id)}
                  className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-all cursor-pointer ${
                    accion ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: info?.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-gray-900">#{s.numero}</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: pri.color + '20', color: pri.color }}>
                          {pri.label}
                        </span>
                        {accion && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Sparkles className="h-2.5 w-2.5" /> Requiere tu acción
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {s.items?.map(i => i.descripcion).filter(Boolean).join(', ') || 'Sin productos'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {s.items?.length || 0} productos · {format(new Date(s.fechaCreacion), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge variant={s.estado} />
                      {accion && (
                        <span className="text-[10px] font-semibold text-amber-700 underline">Revisar →</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Detalle de la solicitud */}
        <Dialog open={!!modal} onOpenChange={(open) => { if (!open) { setModalId(null); setMostrarRechazo(false); setMotivoRechazo(''); } }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            {modal && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Solicitud #{modal.numero}</h2>
                    <p className="text-xs text-gray-500">{format(new Date(modal.fechaCreacion), "d 'de' MMMM, yyyy · HH:mm", { locale: es })}</p>
                  </div>
                  <StatusBadge variant={modal.estado} />
                </div>

                {/* Proximo paso — siempre visible arriba de todo para que quede claro que sigue */}
                {modal.estado === 'cotizada' ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-amber-900 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Tu cotización está lista</p>
                    <p className="text-xs text-amber-700 mt-1">Revisa los precios de cada producto abajo y decide si apruebas para continuar con la compra, o la rechazas para que el analista vuelva a cotizar.</p>
                    {!mostrarRechazo ? (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={handleAprobar} disabled={procesando} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                          {procesando ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <ThumbsUp className="h-4 w-4 mr-1.5" />} Aprobar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setMostrarRechazo(true)} disabled={procesando} className="flex-1 bg-white">
                          <ThumbsDown className="h-4 w-4 mr-1.5" /> Rechazar
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <textarea value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)} rows={2} autoFocus
                          placeholder="¿Por qué rechazas esta cotización? (obligatorio)"
                          className="w-full text-sm border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleRechazar} disabled={procesando || !motivoRechazo.trim()} className="flex-1 bg-red-600 hover:bg-red-700">
                            {procesando ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />} Confirmar rechazo
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setMostrarRechazo(false); setMotivoRechazo(''); }} disabled={procesando} className="bg-white">
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : modal.estado === 'en_pedido' && !modal.archivado ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-emerald-800 flex items-center gap-2"><PackageCheck className="h-4 w-4" /> ¿Ya recibiste el pedido?</p>
                    <p className="text-xs text-emerald-700 mt-1">Confirma la recepción para cerrar el hilo y archivar. El analista recibirá aviso en el mismo correo.</p>
                    <Button size="sm" onClick={handleConfirmarRecepcion} disabled={procesando} className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700">
                      {procesando ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />} Confirmar recepción — ¡Listo!
                    </Button>
                  </div>
                ) : modal.estado === 'cancelada' ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-800 flex items-center gap-2"><XCircle className="h-4 w-4" /> Solicitud cancelada</p>
                    {modal.motivoRechazo && <p className="text-xs text-red-700 mt-1">Motivo: {modal.motivoRechazo}</p>}
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-600 shrink-0" />
                    <p className="text-xs text-blue-800">
                      {modal.estado === 'pendiente' && 'Tu analista de compras aún no ha iniciado la cotización. No necesitas hacer nada por ahora.'}
                      {modal.estado === 'en_cotizacion' && 'Tu analista está buscando precios y proveedores. Te avisaremos por correo cuando la cotización esté lista.'}
                      {modal.estado === 'aprobada' && 'Aprobaste la cotización — el equipo de compras generará la orden de compra.'}
                      {modal.estado === 'completada' && 'Pedido entregado y cerrado. ¡Gracias!'}
                    </p>
                  </div>
                )}

                <div className="border rounded-xl p-3 bg-gray-50">
                  <p className="text-xs font-bold">🔄 Seguimiento de tu pedido</p>
                  <p className="text-xs text-gray-500 mb-2">Cada paso se actualiza automáticamente y se avisa por correo en el mismo hilo.</p>
                  <ProcesoTimeline solicitud={modal} />
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-700 mb-2">Productos ({modal.items?.length || 0})</h4>
                  <div className="space-y-1.5">
                    {modal.items?.map((item, i) => {
                      const cot = item.cotizaciones?.[item.mejorCotizacionIndex ?? 0];
                      return (
                        <div key={i} className="bg-gray-50 rounded-lg p-2.5 text-sm flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <p className="truncate">{item.descripcion} <span className="text-gray-400">x{item.cantidad}</span></p>
                            {cot?.proveedor && <p className="text-[11px] text-gray-500 truncate">{cot.proveedor}</p>}
                          </div>
                          {cot ? (
                            <span className="font-bold text-green-600 shrink-0">{formatMoney(cot.total || 0)}</span>
                          ) : (
                            <span className="text-xs text-gray-400 shrink-0">Sin cotizar</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {modal.notas && modal.notas.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 text-sm">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Historial:</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {modal.notas.map((nota, i) => (
                        <p key={i} className="text-blue-800 text-xs">{nota.texto}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
