'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { obtenerSolicitudEnTiempoReal, obtenerProveedores } from '@/lib/firestore';
import type { Solicitud, ItemSolicitud, CotizacionItem, Proveedor } from '@/types';
import { IVA_OPCIONES } from '@/types';
import { Loader2, Save, Send, Plus, Trash2, Search, FileText } from 'lucide-react';
import { formatMoney } from '@/lib/format';

export default function CotizarSolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [busquedaProveedor, setBusquedaProveedor] = useState<{ [key: string]: string }>({});
  const [showProveedorDropdown, setShowProveedorDropdown] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    params.then(({ id }) => {
      if (!id || !empresa?.id) return;
      unsub = obtenerSolicitudEnTiempoReal(id, (sol) => {
        setSolicitud(sol);
        setCargando(false);
      });
    });
    if (empresa?.id) {
      obtenerProveedores(empresa.id).then(setProveedores);
    }
    return () => unsub?.();
  }, [empresa?.id, params]);

  const patchSolicitud = async (id: string, body: Record<string, any>) => {
    const res = await fetch(`/api/solicitudes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) {
      const msg = data.error || 'Error desconocido';
      if (String(msg).includes('RESOURCE_EXHAUSTED') || String(msg).includes('Quota')) throw new Error('Cuota Firestore agotada — se reinicia 09:00 Colombia. Active plan Blaze para evitar cortes.');
      throw new Error(msg);
    }
    return data;
  };

  const handleStartCotizacion = async () => {
    if (!solicitud || !usuario) return;
    try {
      await patchSolicitud(solicitud.id, {
        action: 'enviar_cotizacion',
        usuarioUid: usuario.uid,
        usuarioNombre: usuario.nombre || usuario.email || 'Analista',
      });
    } catch (e: any) {
      const { default: toast } = await import('react-hot-toast');
      toast.error(e?.message || 'Error al iniciar cotización', { duration: 6000 });
    }
  };

  const handleAddCotizacion = (itemIndex: number) => {
    if (!solicitud) return;
    const newItems = [...solicitud.items];
    const item = { ...newItems[itemIndex] };
    if (!item.cotizaciones) item.cotizaciones = [];
    item.cotizaciones.push({
      proveedor: '',
      precioUnitario: 0,
      porcentajeIva: 19,
      valorIva: 0,
      precioConIva: 0,
      cantidad: item.cantidad,
      subtotal: 0,
      total: 0,
    });
    newItems[itemIndex] = item;
    setSolicitud({ ...solicitud, items: newItems });
  };

  const handleUpdateCotizacion = (itemIndex: number, cotIndex: number, field: string, value: any) => {
    if (!solicitud) return;
    const newItems = [...solicitud.items];
    const item = { ...newItems[itemIndex] };
    const cotizaciones = [...(item.cotizaciones || [])];
    const cot = { ...cotizaciones[cotIndex], [field]: value };

    // Recalcular
    cot.valorIva = Math.round(cot.precioUnitario * (cot.porcentajeIva / 100));
    cot.precioConIva = cot.precioUnitario + cot.valorIva;
    cot.subtotal = cot.precioUnitario * cot.cantidad;
    cot.total = cot.precioConIva * cot.cantidad;

    cotizaciones[cotIndex] = cot;
    item.cotizaciones = cotizaciones;
    newItems[itemIndex] = item;
    setSolicitud({ ...solicitud, items: newItems });
  };

  const handleRemoveCotizacion = (itemIndex: number, cotIndex: number) => {
    if (!solicitud) return;
    const newItems = [...solicitud.items];
    const item = { ...newItems[itemIndex] };
    item.cotizaciones = (item.cotizaciones || []).filter((_, i) => i !== cotIndex);
    newItems[itemIndex] = item;
    setSolicitud({ ...solicitud, items: newItems });
  };

  const handleSeleccionarMejor = (itemIndex: number, cotIndex: number) => {
    if (!solicitud) return;
    const newItems = [...solicitud.items];
    const item = { ...newItems[itemIndex] };
    item.mejorCotizacionIndex = cotIndex;
    newItems[itemIndex] = item;
    setSolicitud({ ...solicitud, items: newItems });
  };

  const handleEnviarCotizacion = async () => {
    if (!solicitud || !usuario) return;
    setGuardando(true);
    try {
      await patchSolicitud(solicitud.id, {
        action: 'cotizar',
        items: solicitud.items,
        usuarioUid: usuario.uid,
        usuarioNombre: usuario.nombre || usuario.email || 'Analista',
      });
      const { default: toast } = await import('react-hot-toast');
      toast.success('Cotización enviada');
      router.push('/admin/solicitudes');
    } catch (e: any) {
      const m = e?.message || '';
      if (m.includes('Cuota')) {
        const { default: toast } = await import('react-hot-toast');
        toast.error(m, { duration: 6000 });
      } else {
        const { default: toast } = await import('react-hot-toast');
        toast.error('Error: ' + m);
      }
    } finally {
      setGuardando(false);
    }
  };

  const getProveedorSugerencias = (busqueda: string) => {
    if (!busqueda || busqueda.length < 2) return [];
    const todos = [...new Set(proveedores.flatMap(p => Object.keys(p.precios || {})))];
    return todos.filter(p => p.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 5);
  };

  if (cargando) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div>;
  }

  if (!solicitud) {
    return <div className="p-8 text-center text-gray-500">Solicitud no encontrada</div>;
  }

  const totalGeneral = solicitud.items.reduce((sum, item) => {
    const mejor = item.cotizaciones?.[item.mejorCotizacionIndex ?? 0];
    return sum + (mejor?.total || 0);
  }, 0);

  const totalIVA = solicitud.items.reduce((sum, item) => {
    const mejor = item.cotizaciones?.[item.mejorCotizacionIndex ?? 0];
    return sum + (mejor?.valorIva || 0) * (mejor?.cantidad || 1);
  }, 0);

  return (
    <div className="p-4 lg:p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Cotizar Solicitud #{solicitud.numero}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {solicitud.nombreUsuario} · {solicitud.centroTrabajo} · {solicitud.items.length} items
          </p>
        </div>
        <div className="flex gap-2">
          {solicitud.estado === 'pendiente' && (
            <button onClick={handleStartCotizacion}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Search className="h-4 w-4" /> Iniciar Cotizacion
            </button>
          )}
          {solicitud.estado === 'en_cotizacion' && (
            <button onClick={handleEnviarCotizacion} disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar para Aprobacion
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {solicitud.items.map((item, itemIndex) => (
          <div key={itemIndex} className="bg-white rounded-xl border border-gray-200 p-5">
            {/* Item Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{item.descripcion}</h3>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  <span>Codigo: {item.codigoProducto}</span>
                  <span>Cantidad: {item.cantidad}</span>
                </div>
              </div>
              {solicitud.estado === 'en_cotizacion' && (
                <button onClick={() => handleAddCotizacion(itemIndex)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Agregar Cotizacion
                </button>
              )}
            </div>

            {/* Cotizaciones */}
            {item.cotizaciones && item.cotizaciones.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-2 text-[10px] font-semibold text-gray-500 uppercase px-1">
                  <span>Proveedor</span>
                  <span className="text-right">Precio/Unit</span>
                  <span className="text-center">IVA %</span>
                  <span className="text-right">Valor IVA</span>
                  <span className="text-right">Precio+IVA</span>
                  <span className="text-right">Total</span>
                  <span></span>
                </div>
                {item.cotizaciones.map((cot, cotIndex) => (
                  <div key={cotIndex}
                    className={`grid grid-cols-7 gap-2 items-center p-2 rounded-lg ${
                      item.mejorCotizacionIndex === cotIndex ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}>
                    {/* Proveedor */}
                    <div className="relative">
                      <input value={cot.proveedor}
                        onChange={e => {
                          handleUpdateCotizacion(itemIndex, cotIndex, 'proveedor', e.target.value);
                          setBusquedaProveedor({ ...busquedaProveedor, [`${itemIndex}-${cotIndex}`]: e.target.value });
                          setShowProveedorDropdown(`${itemIndex}-${cotIndex}`);
                        }}
                        onBlur={() => setTimeout(() => setShowProveedorDropdown(null), 200)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                        placeholder="Proveedor..." />
                      {showProveedorDropdown === `${itemIndex}-${cotIndex}` && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-auto">
                          {getProveedorSugerencias(busquedaProveedor[`${itemIndex}-${cotIndex}`] || '').map(p => (
                            <button key={p} onMouseDown={() => handleUpdateCotizacion(itemIndex, cotIndex, 'proveedor', p)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50">{p}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Precio Unitario */}
                    <input type="number" value={cot.precioUnitario || ''}
                      onChange={e => handleUpdateCotizacion(itemIndex, cotIndex, 'precioUnitario', Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-right focus:ring-2 focus:ring-blue-500"
                      placeholder="0" />

                    {/* IVA */}
                    <select value={cot.porcentajeIva}
                      onChange={e => handleUpdateCotizacion(itemIndex, cotIndex, 'porcentajeIva', Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-center focus:ring-2 focus:ring-blue-500">
                      {IVA_OPCIONES.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>

                    {/* Valor IVA */}
                    <div className="text-xs text-right text-gray-600 font-mono">
                      {formatMoney(cot.valorIva || 0)}
                    </div>

                    {/* Precio + IVA */}
                    <div className="text-xs text-right font-bold text-gray-900 font-mono">
                      {formatMoney(cot.precioConIva || 0)}
                    </div>

                    {/* Total */}
                    <div className="text-sm text-right font-bold text-green-600 font-mono">
                      {formatMoney(cot.total || 0)}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleSeleccionarMejor(itemIndex, cotIndex)}
                        className={`px-2 py-1 text-[10px] font-medium rounded ${
                          item.mejorCotizacionIndex === cotIndex
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}>
                        {item.mejorCotizacionIndex === cotIndex ? 'SELECCIONADO' : 'Mejor'}
                      </button>
                      {solicitud.estado === 'en_cotizacion' && (
                        <button onClick={() => handleRemoveCotizacion(itemIndex, cotIndex)}
                          className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm">
                {solicitud.estado === 'en_cotizacion'
                  ? 'No hay cotizaciones. Click "Agregar Cotizacion" para empezar.'
                  : 'Esperando cotizacion del analista...'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Resumen */}
      {solicitud.items.some(item => item.cotizaciones?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Resumen de Cotizacion</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal (sin IVA):</span>
                <span className="font-medium">{formatMoney(totalGeneral - totalIVA)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total IVA:</span>
                <span className="font-medium text-orange-600">{formatMoney(totalIVA)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>TOTAL:</span>
                <span className="text-green-600">{formatMoney(totalGeneral)}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Items cotizados:</span>
                <span className="font-medium">{solicitud.items.filter(i => i.cotizaciones?.length > 0).length}/{solicitud.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Proveedor seleccionado:</span>
                <span className="font-medium">
                  {solicitud.items.find(i => i.mejorCotizacionIndex !== undefined)?.cotizaciones?.[
                    solicitud.items.find(i => i.mejorCotizacionIndex !== undefined)?.mejorCotizacionIndex ?? 0
                  ]?.proveedor || '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
