'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  obtenerTodasSolicitudesEnTiempoReal,
  eliminarSolicitud,
  obtenerProveedores,
  invalidarCacheSolicitudes,
} from '@/lib/firestore';
import type { Solicitud, ItemSolicitud, Proveedor } from '@/types';
import { ESTADOS_SOLICITUD, ACCIONES_POR_ESTADO } from '@/types';
import { Button, Card, CardHeader, CardTitle, Input, Badge, StatusBadge, ModalWrapper, SkeletonTable, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui';
import { Eye, Trash2, Search, CheckCircle, XCircle, Send, Plus, Minus, Loader2, Check, Settings2, Paperclip, Lightbulb, AlertTriangle, TrendingUp, Clock3, FileText, Copy, Download, Mail } from 'lucide-react';
import KanbanBoard from '@/components/KanbanBoard';
import { ProcesoTimeline } from '@/components/ProcesoTimeline';

import { formatMoney } from '@/lib/format';

function parseMoneyInput(value: string): number {
  const numericValue = value.replace(/[^0-9]/g, '');
  return parseInt(numericValue) || 0;
}

function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [displayValue, setDisplayValue] = useState(value ? new Intl.NumberFormat('es-CO').format(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(value ? new Intl.NumberFormat('es-CO').format(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseMoneyInput(e.target.value);
    setDisplayValue(new Intl.NumberFormat('es-CO').format(raw));
    onChange(raw);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      className="w-full px-3 py-2 border rounded text-sm"
    />
  );
}

function ProviderAutocomplete({ value, onChange, providers }: { value: string; onChange: (v: string) => void; providers: Proveedor[] }) {
  const [inputValue, setInputValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredProviders, setFilteredProviders] = useState<Proveedor[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputValue.length > 0) {
      const filtered = providers.filter(p =>
        p.razonSocial?.toLowerCase().includes(inputValue.toLowerCase()) ||
        p.nit?.includes(inputValue) ||
        p.descripcion?.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredProviders(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setShowDropdown(false);
    }
  }, [inputValue, providers]);

  const handleSelect = (proveedor: Proveedor) => {
    setInputValue(proveedor.razonSocial || proveedor.descripcion || '');
    onChange(proveedor.razonSocial || proveedor.descripcion || '');
    setShowDropdown(false);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar proveedor..."
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (filteredProviders.length > 0) setShowDropdown(true);
        }}
        className="w-full px-3 py-2 border rounded text-sm"
      />
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {filteredProviders.map((proveedor) => (
            <div
              key={proveedor.id}
              className="px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
              onClick={() => handleSelect(proveedor)}
            >
              <p className="font-medium text-sm">{proveedor.razonSocial || proveedor.descripcion}</p>
              <p className="text-xs text-muted-foreground">NIT: {proveedor.nit || '-'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SolicitudesPage() {
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const permissions = usePermissions();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [vista, setVista] = useState<'kanban' | 'tabla'>('tabla');
  const [solicitudSel, setSolicitudSel] = useState<Solicitud | null>(null);
  const [showRechazar, setShowRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [showCotizar, setShowCotizar] = useState(false);
  const [estadoManual, setEstadoManual] = useState<string>('');
  const [showCompletar, setShowCompletar] = useState(false);
  const [nuevoArchivo, setNuevoArchivo] = useState<{ nombre:string; descripcion:string; base64:string; tipo:string; tamano:number } | null>(null);
  const [descArchivo, setDescArchivo] = useState('');
  const [cotizacionesTemp, setCotizacionesTemp] = useState<Record<number, { proveedor: string; precioUnitario: number; porcentajeIva: number; cantidad: number }[]>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    const unsub = obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sol) => {
      setSolicitudes(sol);
      setCargando(false);
    });
    return () => unsub();
  }, [empresa?.id]);

  useEffect(() => {
    if (empresa?.id) {
      obtenerProveedores(empresa.id).then(setProveedores);
    }
  }, [empresa?.id]);

  const mostrarExito = (mensaje: string) => {
    setSuccessMessage(mensaje);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (seleccionados.size === filtradas.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(filtradas.map(s => s.id)));
  };
  const handleBulkIniciar = async () => {
    if (!usuario || seleccionados.size === 0) return;
    const pendientes = filtradas.filter(s => seleccionados.has(s.id) && s.estado === 'pendiente');
    if (pendientes.length === 0) { mostrarExito('Ninguna seleccionada está en Pendiente'); return; }
    setProcesando(true);
    let ok = 0;
    for (const s of pendientes) {
      try { await patchSolicitud(s.id, { action: 'enviar_cotizacion', usuarioUid: usuario.uid, usuarioNombre: usuario.nombre || usuario.email || 'Usuario' }); ok++; } catch {}
    }
    if (empresa?.id) invalidarCacheSolicitudes(empresa.id);
    setSeleccionados(new Set());
    setProcesando(false);
    mostrarExito(`${ok} solicitudes iniciadas en cotización`);
  };
  const handleBulkEnviarRevision = async () => {
    // Placeholder: disabled unless applicable — for cotizada->aprobada handled per-solicitante; analista no bulk aprueba.
    mostrarExito('Seleccione solicitudes cotizadas para aprobar (solicitante)');
  };

  const filtradas = solicitudes.filter(s => {
    if ((s as any).archivado) return false; // historial no ensucia operativo
    const matchBusqueda = !busqueda ||
      s.numero?.toString().includes(busqueda) ||
      s.nombreUsuario?.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.centroTrabajo?.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado = filtroEstado === 'todos' || s.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const patchSolicitud = async (id: string, body: Record<string, any>) => {
    const res = await fetch(`/api/solicitudes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) {
      const msg = data.error || 'Error desconocido';
      if (String(msg).includes('RESOURCE_EXHAUSTED') || String(msg).includes('Quota exceeded')) {
        throw new Error('Cuota de Firestore agotada (gratis). Se reinicia a las 09:00 Colombia. Cierre pestañas de reportes y reintente. Para evitar corte, active plan Blaze en Firebase Console.');
      }
      throw new Error(msg);
    }
    if (empresa?.id) invalidarCacheSolicitudes(empresa.id);
    return data;
  };

  const applyOptimistic = (id: string, patch: Partial<Solicitud>) => {
    setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, ...patch, fechaActualizacion: new Date() } as any : s));
    if (solicitudSel?.id === id) setSolicitudSel(prev => prev ? { ...prev, ...patch, fechaActualizacion: new Date() } as any : prev);
  };

  const notificarHilo = async (solicitud: Solicitud, estado: string, extraHtml?: string) => {
    try {
      const html = extraHtml || `<p>La solicitud <b>#${solicitud.numero}</b> cambió a <b>${estado}</b> por ${usuario?.nombre || 'Analista'}.</p><p>Centro: ${solicitud.centroTrabajo} • Prioridad: ${solicitud.prioridad}</p><p><a href="${typeof window !== 'undefined' ? window.location.origin : ''}/admin/solicitudes/${solicitud.id}">Ver en plataforma</a></p>`;
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'respuesta_solicitud',
          solicitud: { numero: solicitud.numero, id: solicitud.id, nombreUsuario: solicitud.nombreUsuario, emailUsuario: solicitud.emailUsuario, items: solicitud.items },
          empresa: null,
          respuesta: html,
          nuevoEstado: estado,
          emailDestino: solicitud.emailUsuario,
          threadId: (solicitud as any).threadId || '',
          subject: `[SOL-#${solicitud.numero}] ${estado} — ${solicitud.centroTrabajo}`,
        }),
      });
    } catch {}
  };

  const handleAccion = async (solicitud: Solicitud, nuevoEstado: string) => {
    if (!usuario || procesando) return;
    const userPayload = { usuarioUid: usuario.uid, usuarioNombre: usuario.nombre || usuario.email || 'Usuario' };
    // optimista fluido: actualiza UI al instante
    const autoArchivar = ['completada','cancelada'].includes(nuevoEstado);
    applyOptimistic(solicitud.id, { estado: nuevoEstado as any, ...(autoArchivar? { archivado:true } : {}) } as any);
    setProcesando(true);
    try {
      if (nuevoEstado === 'aprobada') {
        await patchSolicitud(solicitud.id, { action: 'aprobar', ...userPayload });
        mostrarExito('Solicitud aprobada exitosamente');
        notificarHilo(solicitud, 'aprobada', `<p>✅ Su solicitud <b>#${solicitud.numero}</b> fue <b>aprobada</b>. El analista generará la OC y le avisará cuando esté en pedido.</p>`);
      } else if (nuevoEstado === 'en_cotizacion') {
        if (solicitud.estado === 'pendiente') {
          await patchSolicitud(solicitud.id, { action: 'enviar_cotizacion', ...userPayload });
          mostrarExito('Solicitud enviada a cotizacion');
          notificarHilo(solicitud, 'en_cotización', `<p>🔍 Su solicitud <b>#${solicitud.numero}</b> ya se está <b>cotizando</b>. Estamos informándole de los nuevos cambios de su solicitud — el analista está contactando proveedores y le avisará cuando tenga las cotizaciones.</p>`);
        } else {
          await patchSolicitud(solicitud.id, { action: 'rechazar', motivo: motivoRechazo || 'Revertido manualmente a cotización', ...userPayload });
          mostrarExito('Vuelto a En cotización');
          notificarHilo(solicitud, 'devuelta a cotización', `<p>🔄 Su solicitud <b>#${solicitud.numero}</b> fue devuelta a cotización. Motivo: ${motivoRechazo || 'Revisión'}</p>`);
          setShowRechazar(false);
          setMotivoRechazo('');
        }
      } else if (nuevoEstado === 'cancelada') {
        await patchSolicitud(solicitud.id, { action: 'actualizar_estado', nuevoEstado: 'cancelada', ...userPayload });
        mostrarExito('Solicitud cancelada');
        notificarHilo(solicitud, 'cancelada', `<p>❌ Su solicitud <b>#${solicitud.numero}</b> fue cancelada.</p>`);
      } else if (nuevoEstado === 'cotizada') {
        await handleGuardarCotizacion(solicitud);
        return; // handleGuardar ya hace optimistic
      } else if (nuevoEstado === 'en_pedido') {
        const data: any = await patchSolicitud(solicitud.id, { action: 'generar_pedido', ...userPayload });
        const oc = data.numeroPedido || 'generada';
        applyOptimistic(solicitud.id, { numeroPedido: oc } as any);
        mostrarExito(`Orden de compra ${oc} generada automáticamente`);
        notificarHilo(solicitud, 'en pedido', `<p>🛒 Su solicitud <b>#${solicitud.numero}</b> ya tiene <b>OC ${oc}</b>. Estamos esperando entrega del proveedor.</p>`);
      } else if (nuevoEstado === 'completada') {
        await patchSolicitud(solicitud.id, { action: 'completar', ...userPayload });
        mostrarExito('Solicitud completada y archivada');
        notificarHilo(solicitud, 'completada', `<p>🎉 Su solicitud <b>#${solicitud.numero}</b> fue marcada como <b>entregada</b>. Por favor confirme recepción en la plataforma.</p>`);
        setShowCompletar(false);
      } else {
        await patchSolicitud(solicitud.id, { action: 'actualizar_estado', nuevoEstado, ...userPayload });
        mostrarExito('Estado actualizado a ' + nuevoEstado);
        notificarHilo(solicitud, nuevoEstado);
      }
      setSolicitudSel(null);
    } catch (error: any) {
      console.error('Error en accion:', error);
      const m = error?.message || '';
      // revertir optimista recargando
      if (empresa?.id) { invalidarCacheSolicitudes(empresa.id); setTimeout(()=> window.location.reload(), 800); }
      if (m.includes('Cuota de Firestore')) alert('⚠️ ' + m);
      else alert('Error: ' + m);
    } finally {
      setProcesando(false);
    }
  };

  const handleCambioManualEstado = async () => {
    if (!solicitudSel || !estadoManual || estadoManual === solicitudSel.estado) return;
    applyOptimistic(solicitudSel.id, { estado: estadoManual as any, ...( ['completada','cancelada'].includes(estadoManual) ? { archivado:true } : { archivado:false }) } as any);
    setProcesando(true);
    try {
      await patchSolicitud(solicitudSel.id, {
        action: 'actualizar_estado',
        nuevoEstado: estadoManual,
        usuarioUid: usuario?.uid || '',
        usuarioNombre: usuario?.nombre || usuario?.email || 'Usuario',
      });
      mostrarExito(`Estado cambiado a ${estadoManual}`);
      setSolicitudSel(null);
      setEstadoManual('');
    } catch (e) {
      console.error(e);
    } finally {
      setProcesando(false);
    }
  };

  const handleAgregarArchivo = async () => {
    if (!solicitudSel || !nuevoArchivo) return;
    if (!descArchivo.trim()) { alert('Agrega una descripción del PDF'); return; }
    setProcesando(true);
    try {
      await patchSolicitud(solicitudSel.id, {
        action: 'agregar_archivo',
        archivo: { ...nuevoArchivo, descripcion: descArchivo },
        usuarioUid: usuario?.uid || '',
        usuarioNombre: usuario?.nombre || usuario?.email || 'Usuario',
      });
      mostrarExito(`PDF ${nuevoArchivo.nombre} adjuntado`);
      // optimista local
      const nuevo = { id: Date.now().toString(), nombre: nuevoArchivo.nombre, descripcion: descArchivo, base64: nuevoArchivo.base64, tipo: nuevoArchivo.tipo, tamano: nuevoArchivo.tamano, fecha: new Date(), autor: usuario?.nombre || '' };
      setSolicitudSel(prev => prev ? { ...prev, archivos: [...((prev as any).archivos || []), nuevo] } as any : prev);
      setNuevoArchivo(null); setDescArchivo('');
    } catch(e){ console.error(e); alert('Error adjuntando'); } finally{ setProcesando(false); }
  };

  // ── Asistente del analista ──
  const asistente = useMemo(() => {
    if (!solicitudSel) return null;
    const s = solicitudSel as any;
    const horasEnEstado = Math.round((Date.now() - new Date(s.fechaActualizacion || s.fechaCreacion).getTime())/36e5);
    const valor = s.items?.reduce((acc:number,it:any)=>{
      const cot = it.cotizaciones?.[it.mejorCotizacionIndex ?? 0];
      return acc + (cot?.total || it.precioUnitario * it.cantidad || 0);
    },0) || 0;
    const urg = s.prioridad === 'urgente';
    const cotizaciones = s.items?.flatMap((it:any)=> it.cotizaciones || []) || [];
    const tieneCot = cotizaciones.length > 0;
    const mejor = tieneCot ? Math.min(...cotizaciones.map((c:any)=> c.total || c.precioConIva*c.cantidad)) : null;
    const peor = tieneCot ? Math.max(...cotizaciones.map((c:any)=> c.total || c.precioConIva*c.cantidad)) : null;
    const ahorro = mejor && peor && peor>mejor ? Math.round((1 - mejor/peor)*100) : 0;
    const diasVence = s.fechaRequerida ? Math.ceil((new Date(s.fechaRequerida).getTime()-Date.now())/86400000) : null;
    const alerts: string[] = [];
    const recs: string[] = [];
    let nivel: 'ok'|'warn'|'crit' = 'ok';
    if (urg && s.estado==='pendiente') { alerts.push(`🔥 URGENTE sin cotizar hace ${horasEnEstado}h — priorice hoy`); nivel='crit'; recs.push('Inicie cotización en <2h. Use proveedores sugeridos del historial.'); }
    if (s.estado==='pendiente' && horasEnEstado>12) { alerts.push(`⏱️ ${horasEnEstado}h en Pendiente — SLA en riesgo`); nivel='warn'; }
    if (s.estado==='en_cotizacion' && horasEnEstado>24) { alerts.push(`⏱️ ${horasEnEstado}h en cotización — contacte proveedor`); nivel='warn'; recs.push('Si proveedor no responde en 24h, alterne a segundo proveedor.'); }
    if (s.estado==='cotizada' && horasEnEstado>24) { alerts.push(`⏳ ${horasEnEstado}h esperando aprobación — notifique solicitante`); }
    if (cotizaciones.length===1) recs.push('Solo 1 cotización — busque 2 más para negociar mejor precio.');
    if (ahorro>12) recs.push(`💰 Ahorro ${ahorro}% eligiendo la más barata (${formatMoney(mejor!)} vs ${formatMoney(peor!)}). Justifique elección.`);
    if (valor>2000000) { alerts.push(`💵 Alto valor ${formatMoney(valor)} — valide presupuesto`); }
    if (!tieneCot && s.estado!=='pendiente') recs.push('Adjunte al menos 1 PDF de cotización con descripción para respaldar decisión.');
    if (diasVence!==null && diasVence<=2 && diasVence>=0) { alerts.push(`📅 Vence en ${diasVence} día(s) (${s.fechaRequerida})`); nivel='crit'; }
    if (diasVence!==null && diasVence<0) { alerts.push(`❌ Vencida hace ${Math.abs(diasVence)} días`); nivel='crit'; }
    if (!alerts.length && !recs.length) recs.push('Flujo al día — continúe al siguiente paso y mantenga PDFs con descripción.');
    const ctx = `Centro ${s.centroTrabajo} · ${s.items?.length||0} items · ${valor?formatMoney(valor):'valor por cotizar'} · ${horasEnEstado}h en ${s.estado}`;
    return { horasEnEstado, valor, alerts, recs, ctx, nivel, cotizaciones: cotizaciones.length, ahorro };
  }, [solicitudSel]);

  const handleGuardarCotizacion = async (solicitud: Solicitud) => {
    if (!usuario || !solicitud.items) return;

    const itemsConCotizacion: ItemSolicitud[] = solicitud.items.map((item, index) => {
      const cotizaciones = cotizacionesTemp[index] || [];
      const itemsCotizados = cotizaciones.map(c => {
        const valorIva = Math.round(c.precioUnitario * (c.porcentajeIva / 100));
        const precioConIva = c.precioUnitario + valorIva;
        const subtotal = c.precioUnitario * c.cantidad;
        const total = precioConIva * c.cantidad;
        return {
          proveedor: c.proveedor,
          precioUnitario: c.precioUnitario,
          porcentajeIva: c.porcentajeIva,
          valorIva,
          precioConIva,
          cantidad: c.cantidad,
          subtotal,
          total,
        };
      });
      return {
        ...item,
        cotizaciones: itemsCotizados,
        mejorCotizacionIndex: item.mejorCotizacionIndex ?? (itemsCotizados.length > 0 ? 0 : undefined),
      };
    });

    await patchSolicitud(solicitud.id, {
      action: 'cotizar',
      items: itemsConCotizacion,
      usuarioUid: usuario.uid,
      usuarioNombre: usuario.nombre || usuario.email || 'Usuario',
    });
    mostrarExito('Cotizaciones guardadas exitosamente');
    notificarHilo(solicitud, 'cotizada', `<p>💰 Su solicitud <b>#${solicitud.numero}</b> ya tiene cotizaciones. Por favor revise y elija la mejor para aprobar.</p>`);
    setCotizacionesTemp({});
    setShowCotizar(false);
  };

  const handleDragEnd = async (id: string, nuevoEstado: string) => {
    const solicitud = solicitudes.find(s => s.id === id);
    if (!solicitud || solicitud.estado === nuevoEstado) return;
    applyOptimistic(id, { estado: nuevoEstado as any, ...( ['completada','cancelada'].includes(nuevoEstado) ? { archivado:true } : { archivado:false }) } as any);
    try {
      await patchSolicitud(id, {
        action: 'actualizar_estado',
        nuevoEstado,
        usuarioUid: usuario?.uid || '',
        usuarioNombre: usuario?.nombre || usuario?.email || 'Usuario',
      });
      mostrarExito(`Estado cambiado a ${nuevoEstado}`);
    } catch (error: any) {
      console.error('Error actualizando estado:', error);
      if (String(error?.message||'').includes('Cuota')) alert('⚠️ ' + error.message);
    }
  };

  const getAccionesPermitidas = (solicitud: Solicitud) => {
    if (!usuario) return [];
    const acciones = ACCIONES_POR_ESTADO[solicitud.estado] || [];
    return acciones.filter(a => {
      if (a.roles.includes('super_admin') && usuario.rol === 'super_admin') return true;
      if (a.roles.includes('admin') && (usuario.rol === 'admin' || usuario.rol === 'super_admin')) return true;
      if (a.roles.includes('abastecimiento') && (usuario.rol === 'abastecimiento' || usuario.rol === 'admin')) return true;
      if (a.roles.includes('solicitante') && usuario.rol === 'solicitante') return true;
      if (a.roles.includes('solicitante') && solicitud.usuario !== usuario.uid) return false;
      return false;
    });
  };

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
          <Check className="h-5 w-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitudes</h1>
          <p className="text-sm text-muted-foreground">{filtradas.length} solicitudes · <span className="text-green-600">Instantáneo • sin recargar</span></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (empresa?.id) { invalidarCacheSolicitudes(empresa.id); setSolicitudes([]); setCargando(true); setTimeout(()=> window.location.reload(), 300); }}}>↻ Refrescar</Button>
          <Button
            variant={vista === 'tabla' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setVista('tabla')}
          >
            Tabla
          </Button>
          <Button
            variant={vista === 'kanban' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setVista('kanban')}
          >
            Kanban
          </Button>
        </div>
      </div>

      {/* Bulk bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-gray-200 p-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={filtradas.length>0 && seleccionados.size===filtradas.length} onChange={toggleSelectAll} className="rounded border-gray-300" />
          Seleccionar todo
        </label>
        <span className="text-xs text-muted-foreground">{seleccionados.size} seleccionadas</span>
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="secondary" disabled={procesando || seleccionados.size===0 || !filtradas.some(s=> seleccionados.has(s.id) && s.estado==='pendiente')} onClick={handleBulkIniciar}>
            {procesando ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : null} Iniciar cotización ({filtradas.filter(s=> seleccionados.has(s.id) && s.estado==='pendiente').length})
          </Button>
          <Button size="sm" variant="outline" disabled={true} title="Solo el solicitante aprueba cotizadas" onClick={handleBulkEnviarRevision}>
            Enviar a revisión
          </Button>
          {seleccionados.size>0 && <Button size="sm" variant="ghost" onClick={()=> setSeleccionados(new Set())}>Limpiar</Button>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero, usuario, centro..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <Button
            variant={filtroEstado === 'todos' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setFiltroEstado('todos')}
          >
            Todas ({solicitudes.length})
          </Button>
          {ESTADOS_SOLICITUD.map(e => (
            <Button
              key={e.value}
              variant={filtroEstado === e.value ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setFiltroEstado(e.value)}
            >
              {e.icon} {e.label} ({solicitudes.filter(s => s.estado === e.value).length})
            </Button>
          ))}
        </div>
      </div>

      {/* Vista Tabla */}
      {vista === 'tabla' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2 py-3"><input type="checkbox" checked={filtradas.length>0 && seleccionados.size===filtradas.length} onChange={toggleSelectAll} /></th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Solicitud</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Solicitante</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Centro</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Items</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(s => {
                  const acciones = getAccionesPermitidas(s);
                  return (
                    <tr key={s.id} className={`border-b hover:bg-muted/50 transition-colors ${seleccionados.has(s.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-2 py-2 text-center"><input type="checkbox" checked={seleccionados.has(s.id)} onChange={()=> toggleSeleccion(s.id)} /></td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-primary">#{s.numero}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{s.nombreUsuario}</p>
                        <p className="text-xs text-muted-foreground">{s.emailUsuario}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.centroTrabajo}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary">{s.items?.length || 0}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge variant={s.estado as any} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {s.fechaCreacion?.toLocaleDateString?.() || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSolicitudSel(s)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {acciones.map((a, i) => (
                            <Button
                              key={i}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (a.siguiente === 'en_cotizacion' && s.estado !== 'pendiente') {
                                  setSolicitudSel(s);
                                  setShowRechazar(true);
                                } else if (a.siguiente === 'cotizada') {
                                  setSolicitudSel(s);
                                  setShowCotizar(true);
                                } else if (a.siguiente === 'en_pedido') {
                                  handleAccion(s, 'en_pedido');
                                } else if (a.siguiente === 'completada') {
                                  setSolicitudSel(s);
                                  setShowCompletar(true);
                                } else {
                                  handleAccion(s, a.siguiente);
                                }
                              }}
                              title={a.label}
                              disabled={procesando}
                            >
                              {a.icon === '✅' ? <CheckCircle className="h-4 w-4 text-green-600" /> :
                               a.icon === '🔄' ? <XCircle className="h-4 w-4 text-amber-600" /> :
                               <span className="text-xs">{a.icon}</span>}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtradas.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No hay solicitudes</p>
            </div>
          )}
        </Card>
      )}

      {/* Vista Kanban */}
      {vista === 'kanban' && (
        <KanbanBoard
          solicitudes={filtradas}
          onCardClick={(s) => setSolicitudSel(s)}
          onEstadoChange={handleDragEnd}
        />
      )}

      {/* Modal Detalle Solicitud */}
      <ModalWrapper
        open={!!solicitudSel}
        onClose={() => { setSolicitudSel(null); setEstadoManual(''); }}
        title={solicitudSel ? `Solicitud #${solicitudSel.numero}` : ''}
        size="lg"
      >
        {solicitudSel && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Solicitante</p>
                <p className="font-medium">{solicitudSel.nombreUsuario}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Centro de Trabajo</p>
                <p className="font-medium">{solicitudSel.centroTrabajo}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estado actual</p>
                <StatusBadge variant={solicitudSel.estado as any} />
                {solicitudSel.numeroPedido && <p className="text-xs font-mono mt-1 text-muted-foreground">OC: {solicitudSel.numeroPedido}</p>}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-medium">{solicitudSel.fechaCreacion?.toLocaleDateString?.()}</p>
              </div>
            </div>

            {/* Editor libre de estado */}
            <div className="rounded-lg border bg-amber-50/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="h-4 w-4 text-amber-600" /> Editar proceso manualmente
              </div>
              <p className="text-xs text-muted-foreground">Puede mover la solicitud a cualquier etapa, incluso devolver de Cotizada a En cotización.</p>
              <div className="flex gap-2">
                <Select value={estadoManual || solicitudSel.estado} onValueChange={(v) => setEstadoManual(v || '')}>
                  <SelectTrigger className="flex-1 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_SOLICITUD.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.icon} {e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!estadoManual || estadoManual === solicitudSel.estado || procesando} onClick={handleCambioManualEstado}>
                  {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cambiar'}
                </Button>
              </div>
            </div>

            {/* Badge Compra Directa */}
            {(solicitudSel as any).esCompraDirecta && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-bold text-amber-900 flex items-center gap-2">🛒 Compra Directa — pedido recurrente ya negociado</p>
                <p className="text-xs text-amber-800 mt-1">No pasa por cotización. Proveedor y precio ya vienen mapeados en el producto. Recomendación del sistema: <b>más barato</b> (💰) y <b>mayor calidad</b> (⭐) mostrados al solicitante — ya eligió el mejor. Tú solo genera el pedido y se copia al proveedor por correo.</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={()=>{
                    const provs = [...new Set((solicitudSel.items||[]).map((it:any)=> it.cotizaciones?.[it.mejorCotizacionIndex ?? 0]?.proveedor).filter(Boolean))] as string[];
                    const to = provs.join(', ') || 'proveedor';
                    const subject = `[OC DIRECTA #${solicitudSel.numero}] ${solicitudSel.centroTrabajo} — Pedido listo para despacho`;
                    const body = `Hola ${to},\n\nSe confirma pedido recurrente SOL-#${solicitudSel.numero} (${solicitudSel.centroTrabajo}).\n`+
                      solicitudSel.items.map((it:any,i:number)=> `${i+1}. ${it.descripcion} x${it.cantidad} — ${it.cotizaciones?.[it.mejorCotizacionIndex ?? 0]?.proveedor||''} $${Number(it.cotizaciones?.[it.mejorCotizacionIndex ?? 0]?.precioUnitario||it.precioUnitario).toLocaleString('es-CO')}`).join('\n') +
                      `\n\nTotal: ver plataforma ${typeof window!=='undefined'? window.location.origin:''}/admin/solicitudes/${solicitudSel.id}\nGracias.`;
                    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(provs.join(',')||'')}&cc=${encodeURIComponent(solicitudSel.emailUsuario||'')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    window.open(gmailUrl, '_blank');
                  }}><Mail className="h-4 w-4 mr-1"/> Notificar proveedor (copiado)</Button>
                  <span className="text-[11px] text-amber-700 self-center">Se abrirá Gmail con proveedor en Para y solicitante en CC.</span>
                </div>
              </div>
            )}
            {/* SAP — Armado listo para copiar/pegar */}
            {(solicitudSel.estado==='aprobada' || solicitudSel.estado==='cotizada' || solicitudSel.estado==='en_pedido') && (
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-bold text-blue-900 flex items-center gap-2">📦 SAP Business One — Armado listo {(solicitudSel as any).esCompraDirecta ? '(Directa)' : ''}</p>
                <p className="text-xs text-blue-700 mt-1">Cuenta, precios, centro, cliente/contrato/unidad/sucursal/ciudad/proyecto ya validados{(solicitudSel as any).esCompraDirecta ? ' — pedido recurrente, sin cotización' : ''}. Solo copie y pegue en SAP → Orden de Compra.</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={async()=>{
                    const { copySapTsv } = await import('@/lib/sap-export');
                    await copySapTsv(solicitudSel);
                    mostrarExito('TSV copiado — pegue directo en SAP DTW');
                  }}><Copy className="h-4 w-4 mr-1"/> Copiar para SAP (TSV)</Button>
                  <Button size="sm" variant="outline" className="bg-white" onClick={async()=>{
                    const { downloadSapExcel } = await import('@/lib/sap-export');
                    downloadSapExcel(solicitudSel);
                  }}><Download className="h-4 w-4 mr-1"/> Descargar Excel DTW</Button>
                </div>
                <p className="text-[11px] text-blue-600 mt-2">Incluye: Cuenta de mayor, Nombre cuenta, Descripción, Cantidad + Cantidad(detalle), Precio por unidad, Indicador impuestos, CLIENTE, CONTRATOS, SUCURSAL, CIUDAD (05001), UNIDADES DE NEGOCIO y Proyecto — tal cual en SAP B1 "Pedido" &gt; Contenido ({(solicitudSel as any).esCompraDirecta ? '14 columnas con Cantidad duplicada' : 'validado'}).</p>
              </div>
            )}

            {/* Línea de proceso paso a paso */}
            <div className="border rounded-xl p-3 bg-gray-50">
              <p className="text-sm font-bold flex items-center gap-2">🔄 Línea de proceso — seguimiento automático</p>
              <p className="text-xs text-muted-foreground mb-3">Cada paso responde automáticamente por correo en el mismo hilo [SOL-#{solicitudSel.numero}]. El usuario siente que su pedido ya está en marcha.</p>
              <ProcesoTimeline solicitud={solicitudSel} />
            </div>

            {/* Items */}
            {solicitudSel.items && solicitudSel.items.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Items ({solicitudSel.items.length})</p>
                <div className="border rounded-lg divide-y">
                  {solicitudSel.items.map((item, i) => {
                    const mejorIndex = item.mejorCotizacionIndex ?? 0;
                    const cotizacion = item.cotizaciones?.[mejorIndex];
                    const valorMostrar = cotizacion?.total || item.precioUnitario * item.cantidad || 0;
                    return (
                      <div key={i} className="px-4 py-3 text-sm">
                        <div className="flex justify-between">
                          <span>{item.descripcion}</span>
                          <span className="font-medium text-green-600">{formatMoney(valorMostrar)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>Cantidad: {item.cantidad} | Codigo: {item.codigoProducto}</span>
                          {cotizacion && (
                            <span className="text-green-600">
                              {cotizacion.proveedor ? `${cotizacion.proveedor} - ` : ''}{formatMoney(cotizacion.total)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Asistente del analista */}
            {asistente && (
              <div className={`rounded-xl border p-3 ${asistente.nivel==='crit'?'bg-red-50 border-red-200': asistente.nivel==='warn'?'bg-amber-50 border-amber-200':'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center gap-2 font-semibold text-sm"><Lightbulb className="h-4 w-4"/> Asistente del Analista — contexto amplio</div>
                <p className="text-xs text-muted-foreground mt-1">{asistente.ctx} · {asistente.cotizaciones} cotizaciones {asistente.ahorro? `· ahorro ${asistente.ahorro}%`:''}</p>
                {asistente.alerts.length>0 && (
                  <div className="mt-2 space-y-1">
                    {asistente.alerts.map((a:any,i:any)=><div key={i} className="text-xs flex gap-1.5 bg-white/70 border rounded px-2 py-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0"/>{a}</div>)}
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-semibold flex items-center gap-1"><TrendingUp className="h-3 w-3"/> Recomendaciones:</p>
                  {asistente.recs.map((r:any,i:any)=><div key={i} className="text-xs bg-white border rounded px-2 py-1">• {r}</div>)}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2"><Clock3 className="h-3 w-3"/> Bases: tiempo en estado, valor, prioridad, vencimiento y cotizaciones. Use PDFs adjuntos como evidencia para aprobar.</div>
              </div>
            )}

            {/* Archivos adjuntos PDFs */}
            <div className="border rounded-xl p-3 bg-white">
              <p className="text-sm font-medium flex items-center gap-2"><Paperclip className="h-4 w-4"/> 📎 Archivos adjuntos {(solicitudSel as any).archivos?.length ? `(${(solicitudSel as any).archivos.length})` : ''}</p>
              <p className="text-xs text-muted-foreground mb-2">Adjunte PDFs en cualquier etapa con descripción — quedan para seguimiento y aprobación.</p>
              {(solicitudSel as any).archivos?.length > 0 && (
                <div className="border rounded-lg divide-y mb-3">
                  {(solicitudSel as any).archivos.map((a:any)=>(
                    <div key={a.id} className="px-3 py-2.5 flex gap-2 items-start">
                      <FileText className="h-4 w-4 text-red-500 mt-0.5"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.nombre}</p>
                        <p className="text-xs text-muted-foreground">{a.descripcion || 'Sin descripción'}</p>
                        <p className="text-[11px] text-gray-400">{a.tipo || 'pdf'} • {(a.tamano/1024).toFixed(0)} KB • {a.autor || ''} • {a.fecha ? new Date(a.fecha).toLocaleDateString() : ''}</p>
                      </div>
                      <a href={a.base64} download={a.nombre} className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700">Descargar</a>
                      <a href={a.base64} target="_blank" className="text-xs border px-2.5 py-1 rounded-lg">Ver</a>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-start">
                <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                  <Paperclip className="h-4 w-4 text-gray-400"/>
                  <span className="truncate text-xs">{nuevoArchivo ? nuevoArchivo.nombre : 'Elegir PDF / imagen'}</span>
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    if(f.size>4*1024*1024){ alert('Máx 4MB'); return; }
                    const r=new FileReader(); r.onload=()=> setNuevoArchivo({ nombre:f.name, descripcion:'', base64:r.result as string, tipo:f.type, tamano:f.size }); r.readAsDataURL(f); (e.target as HTMLInputElement).value='';
                  }}/>
                </label>
              </div>
              {nuevoArchivo && (
                <div className="mt-2 flex gap-2">
                  <input value={descArchivo} onChange={e=>setDescArchivo(e.target.value)} placeholder="Descripción obligatoria: ej. Cotización SUMMAR 15 días" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                  <Button size="sm" onClick={handleAgregarArchivo} disabled={procesando || !descArchivo.trim()}>{procesando ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Adjuntar'}</Button>
                  <Button size="sm" variant="ghost" onClick={()=>{setNuevoArchivo(null); setDescArchivo('');}}>Cancelar</Button>
                </div>
              )}
            </div>
            {solicitudSel.observaciones && (
              <div className="bg-gray-50 border rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Observaciones</p>
                <p className="text-sm">{solicitudSel.observaciones}</p>
              </div>
            )}
            {(solicitudSel.estado==='completada' || solicitudSel.estado==='cancelada' || (solicitudSel as any).facturaEstado==='pagada') && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="border-amber-200 bg-amber-50" onClick={async()=>{
                  if(!confirm('Archivar al historial? Desaparecerá del operativo pero queda para indicadores.')) return;
                  await patchSolicitud(solicitudSel.id, { action: (solicitudSel as any).facturaEstado==='pagada' ? 'archivar_factura' : 'archivar', facturaEstado:'pagada', usuarioUid: usuario?.uid||'', usuarioNombre: usuario?.nombre||'Usuario' });
                  mostrarExito('Archivada en Historial 🗂️'); setSolicitudSel(null);
                }}>🗂️ Archivar al historial</Button>
                <span className="text-xs text-muted-foreground py-2">6 meses después → operativo limpio, indicadores intactos</span>
              </div>
            )}
            {/* Acciones rápidas del flujo */}
            {solicitudSel && (
              <div className="flex gap-2 pt-4 border-t flex-wrap">
                {getAccionesPermitidas(solicitudSel).map((a, i) => (
                  <Button
                    key={i}
                    variant={a.siguiente === 'cancelada' ? 'destructive' : a.siguiente === 'en_pedido' ? 'default' : 'default'}
                    onClick={() => {
                      if (a.siguiente === 'en_cotizacion' && solicitudSel.estado !== 'pendiente') {
                        setShowRechazar(true);
                      } else if (a.siguiente === 'cotizada') {
                        setShowCotizar(true);
                      } else if (a.siguiente === 'en_pedido') {
                        handleAccion(solicitudSel, 'en_pedido');
                      } else if (a.siguiente === 'completada') {
                        setShowCompletar(true);
                      } else {
                        handleAccion(solicitudSel, a.siguiente);
                      }
                    }}
                    disabled={procesando}
                  >
                    {a.icon} {a.label} {a.siguiente === 'en_pedido' ? '(auto)' : ''}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </ModalWrapper>

      {/* Modal Rechazar */}
      <ModalWrapper
        open={showRechazar}
        onClose={() => {
          setShowRechazar(false);
          setMotivoRechazo('');
        }}
        title="Rechazar Solicitud"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRechazar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (solicitudSel) {
                  handleAccion(solicitudSel, 'en_cotizacion');
                }
              }}
              disabled={procesando}
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rechazar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ingrese el motivo del rechazo:
          </p>
          <textarea
            className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={3}
            value={motivoRechazo}
            onChange={e => setMotivoRechazo(e.target.value)}
            placeholder="Motivo del rechazo..."
          />
        </div>
      </ModalWrapper>

      {/* Modal Cotizar */}
      <ModalWrapper
        open={showCotizar}
        onClose={() => {
          setShowCotizar(false);
          setCotizacionesTemp({});
        }}
        title="Cotizar Solicitud"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCotizar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (solicitudSel) {
                  handleAccion(solicitudSel, 'cotizada');
                }
              }}
              disabled={procesando}
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Cotizacion'}
            </Button>
          </>
        }
      >
        {solicitudSel && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingrese las cotizaciones para cada item:
            </p>
            {solicitudSel.items?.map((item, index) => (
              <div key={index} className="border rounded-lg p-4">
                <p className="font-medium mb-2">{item.descripcion}</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Cantidad: {item.cantidad} | Codigo: {item.codigoProducto}
                </p>
                <div className="space-y-2">
                  {(cotizacionesTemp[index] || []).map((cot, cotIndex) => (
                    <div key={cotIndex} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground">Proveedor</label>
                        <ProviderAutocomplete
                          value={cot.proveedor}
                          onChange={(v) => {
                            const newTemp = { ...cotizacionesTemp };
                            if (!newTemp[index]) newTemp[index] = [];
                            newTemp[index][cotIndex] = { ...cot, proveedor: v };
                            setCotizacionesTemp(newTemp);
                          }}
                          providers={proveedores}
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-muted-foreground">Precio Unitario</label>
                        <MoneyInput
                          value={cot.precioUnitario}
                          onChange={(v) => {
                            const newTemp = { ...cotizacionesTemp };
                            if (!newTemp[index]) newTemp[index] = [];
                            newTemp[index][cotIndex] = { ...cot, precioUnitario: v };
                            setCotizacionesTemp(newTemp);
                          }}
                          placeholder="$0"
                        />
                      </div>
                      <div className="w-20">
                        <label className="text-xs text-muted-foreground">IVA %</label>
                        <input
                          type="number"
                          value={cot.porcentajeIva || 19}
                          onChange={(e) => {
                            const newTemp = { ...cotizacionesTemp };
                            if (!newTemp[index]) newTemp[index] = [];
                            newTemp[index][cotIndex] = { ...cot, porcentajeIva: Number(e.target.value) };
                            setCotizacionesTemp(newTemp);
                          }}
                          className="w-full px-3 py-2 border rounded text-sm"
                        />
                      </div>
                      <div className="pt-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newTemp = { ...cotizacionesTemp };
                            if (newTemp[index]) {
                              newTemp[index] = newTemp[index].filter((_, i) => i !== cotIndex);
                              setCotizacionesTemp(newTemp);
                            }
                          }}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newTemp = { ...cotizacionesTemp };
                      if (!newTemp[index]) newTemp[index] = [];
                      newTemp[index].push({ proveedor: '', precioUnitario: 0, porcentajeIva: 19, cantidad: item.cantidad || 1 });
                      setCotizacionesTemp(newTemp);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Agregar Cotizacion
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalWrapper>



      {/* Modal Completar */}
      <ModalWrapper
        open={showCompletar}
        onClose={() => setShowCompletar(false)}
        title="Completar Solicitud"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCompletar(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (solicitudSel) {
                  handleAccion(solicitudSel, 'completada');
                }
              }}
              disabled={procesando}
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Completar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Esta seguro de marcar esta solicitud como completada?
          </p>
          <p className="text-sm">
            Solicitud #{solicitudSel?.numero} - {solicitudSel?.nombreUsuario}
          </p>
        </div>
      </ModalWrapper>
    </div>
  );
}
