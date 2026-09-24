'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { obtenerSolicitudEnTiempoReal, obtenerProveedores } from '@/lib/firestore';
import type { Solicitud, ItemSolicitud, CotizacionItem, Proveedor } from '@/types';
import { IVA_OPCIONES } from '@/types';
import { Loader2, Save, Send, Plus, Trash2, Search, FileText, Building2, DollarSign } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import toast from 'react-hot-toast';

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
  const [esCompraDirecta, setEsCompraDirecta] = useState(false);

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
      toast.success('Cotización iniciada');
    } catch (e: any) {
      toast.error(e?.message || 'Error al iniciar cotización', { duration: 6000 });
    }
  };

  const UMBRAL_AUTO_APROBACION = 500000; // $500k - configurable por UN/Cliente en futuro (ver sap-catalogos.ts)

  const handleAutoCotizar = () => {
    if (!solicitud) return;
    const newItems = solicitud.items.map(item => {
      const opciones = baseProveedores.filter(bp => String(bp.codigo) === String(item.codigoProducto));
      if (opciones.length === 0) return item;
      const masBarato = [...opciones].sort((a,b)=> a.precio - b.precio)[0];
      const precioNum = Number(masBarato.precio);
      const iva = precioNum ? 19 : 0;
      const valorIva = Math.round(precioNum * (iva/100));
      const cot: CotizacionItem = {
        proveedor: masBarato.proveedor,
        precioUnitario: precioNum,
        porcentajeIva: iva,
        valorIva,
        precioConIva: precioNum + valorIva,
        cantidad: item.cantidad,
        subtotal: precioNum * item.cantidad,
        total: (precioNum + valorIva) * item.cantidad,
      };
      return { ...item, cotizaciones: [cot], mejorCotizacionIndex: 0 };
    });
    setSolicitud({ ...solicitud, items: newItems } as any);
    const total = newItems.reduce((s,it)=> s + (it.cotizaciones?.[0]?.total || 0), 0);
    if (total > 0 && total < UMBRAL_AUTO_APROBACION) {
      toast.success(`Auto-cotizado ${newItems.filter(i=> i.cotizaciones?.length).length} items • Total $${total.toLocaleString('es-CO')} < $500k → se auto-aprobará al enviar`);
    } else {
      toast.success(`Auto-cotizado ${newItems.filter(i=> i.cotizaciones?.length).length} items con el más barato`);
    }
  };

  const handleAutoAprobarYEnviar = async () => {
    if (!solicitud || !usuario) return;
    // Primero auto-cotiza si no hay cotizaciones
    let itemsParaEnviar = solicitud.items;
    const sinCotizar = solicitud.items.filter(it => !it.cotizaciones?.length);
    if (sinCotizar.length > 0) {
      const autoItems = solicitud.items.map(item => {
        if (item.cotizaciones?.length) return item;
        const opciones = baseProveedores.filter(bp => String(bp.codigo) === String(item.codigoProducto));
        if (opciones.length === 0) return item;
        const masBarato = [...opciones].sort((a,b)=> a.precio - b.precio)[0];
        const precioNum = Number(masBarato.precio);
        const iva = 19;
        const valorIva = Math.round(precioNum * (iva/100));
        const cot: CotizacionItem = {
          proveedor: masBarato.proveedor, precioUnitario: precioNum, porcentajeIva: iva, valorIva, precioConIva: precioNum+valorIva,
          cantidad: item.cantidad, subtotal: precioNum*item.cantidad, total: (precioNum+valorIva)*item.cantidad,
        };
        return { ...item, cotizaciones: [cot], mejorCotizacionIndex: 0 };
      });
      itemsParaEnviar = autoItems;
      setSolicitud({ ...solicitud, items: autoItems } as any);
    }
    const total = itemsParaEnviar.reduce((s,it)=> s + (it.cotizaciones?.[0]?.total || it.precioUnitario*it.cantidad || 0), 0);
    if (total >= UMBRAL_AUTO_APROBACION) {
      toast.error(`Total $${total.toLocaleString('es-CO')} supera $500k — requiere aprobación manual`);
      return;
    }
    setGuardando(true);
    try {
      // Cotiza + Aprueba + Genera pedido en un solo flujo
      await patchSolicitud(solicitud.id, { action: 'cotizar', items: itemsParaEnviar, usuarioUid: usuario.uid, usuarioNombre: usuario.nombre || usuario.email || 'Analista' });
      await patchSolicitud(solicitud.id, { action: 'aprobar', usuarioUid: usuario.uid, usuarioNombre: usuario.nombre || usuario.email || 'Analista', items: itemsParaEnviar });
      const res = await patchSolicitud(solicitud.id, { action: 'generar_pedido', usuarioUid: usuario.uid, usuarioNombre: usuario.nombre || usuario.email || 'Analista' });
      toast.success(`¡Auto-aprobado y pedido ${res.numeroPedido || 'generado'} por $${total.toLocaleString('es-CO')}!`);
      router.push('/admin/solicitudes');
    } catch (e:any) {
      toast.error(e?.message || 'Error en auto-aprobación');
    } finally { setGuardando(false); }
  };

  // ─── BaseProveedores derivada: matriz proveedores x código ───
  // Hoja BaseProveedores: columnas son proveedores, filas son productos. Se aplana a [{codigo, proveedor, precio}]
  const baseProveedores = useMemo(() => {
    const lista: { codigo: string; proveedor: string; precio: number }[] = [];
    proveedores.forEach(p => {
      Object.entries(p.precios || {}).forEach(([prov, precio]) => {
        const num = Number(precio);
        if (prov && !isNaN(num) && num > 0) lista.push({ codigo: p.codigo, proveedor: prov, precio: num });
      });
    });
    return lista;
  }, [proveedores]);

  // Nombres de todos los proveedores (encabezados de columnas D en adelante)
  const nombresProveedores = useMemo(() => {
    const set = new Set<string>();
    proveedores.forEach(p => Object.keys(p.precios || {}).forEach(k => set.add(k)));
    return [...set].sort();
  }, [proveedores]);

  // Precio de un proveedor para un codigo (como aplicarPrecioProveedor)
  const precioDeProveedor = (codigo: string, proveedor: string): number | null => {
    const entrada = baseProveedores.find(b => String(b.codigo) === String(codigo) && b.proveedor === proveedor);
    return entrada ? entrada.precio : null;
  };

  // Proveedores que cotizan ese codigo, ordenados por precio (para mostrar tabla compacta)
  const proveedoresParaCodigo = (codigo: string) => {
    return baseProveedores.filter(b => String(b.codigo) === String(codigo)).sort((a,b)=> a.precio - b.precio);
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
    const cot = { ...cotizaciones[cotIndex], [field]: value } as CotizacionItem;

    // Si cambia proveedor, autocompletar precio desde BaseProveedores (aplicarPrecioProveedor)
    if (field === 'proveedor') {
      const p = precioDeProveedor(item.codigoProducto, value);
      if (p !== null) cot.precioUnitario = p;
    }

    // Recalcular IVA y totales
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
      toast.success('Cotización enviada');
      router.push('/admin/solicitudes');
    } catch (e: any) {
      const m = e?.message || '';
      if (m.includes('Cuota')) {
        toast.error(m, { duration: 6000 });
      } else {
        toast.error('Error: ' + m);
      }
    } finally {
      setGuardando(false);
    }
  };

  const getProveedorSugerencias = (busqueda: string) => {
    if (!busqueda || busqueda.length < 1) return nombresProveedores.slice(0, 8);
    return nombresProveedores.filter(p => p.toLowerCase().includes(busqueda.toLowerCase())).slice(0, 8);
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
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Cotizar Solicitud #{solicitud.numero}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {solicitud.nombreUsuario} · {solicitud.centroTrabajo} · {solicitud.items.length} items · Prioridad {solicitud.prioridad}
          </p>
          <p className="text-xs text-gray-400 mt-1">Cliente/Contrato/Unidad/Proyecto/Sucursal vienen por fila (AsignacionesUsuario).</p>
        </div>
        <div className="flex gap-2">
          {solicitud.estado === 'pendiente' && (
            <button onClick={handleStartCotizacion}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              <Search className="h-4 w-4" /> Iniciar Cotizacion
            </button>
          )}
          {solicitud.estado === 'en_cotizacion' && (
            <>
              <button onClick={handleAutoCotizar}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600">
                <span className="text-sm">⚡</span> Auto-cotizar
              </button>
              <button onClick={handleAutoAprobarYEnviar} disabled={guardando}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm">✓</span>}
                Auto-aprobar & Mandar
              </button>
              <button onClick={handleEnviarCotizacion} disabled={guardando}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 disabled:opacity-50">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toggle Compra Directa */}
      {(solicitud.estado === 'pendiente' || solicitud.estado === 'en_cotizacion') && (
        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${esCompraDirecta ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
          <input type="checkbox" checked={esCompraDirecta} onChange={e=> setEsCompraDirecta(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Ya esta negociado - compra directa</p>
            <p className="text-xs text-gray-600">Actívalo si ya tienes proveedor y precio. Va directo a aprobado. Usa la matriz BaseProveedores (proveedores como columnas) para elegir el más barato.</p>
          </div>
          {esCompraDirecta && <span className="text-xs bg-amber-600 text-white px-3 py-1 rounded-full font-bold">DIRECTA</span>}
        </label>
      )}

      {/* Items */}
      <div className="space-y-4">
        {solicitud.items.map((item, itemIndex) => {
          const provsOrdenados = proveedoresParaCodigo(item.codigoProducto);
          const tieneBase = provsOrdenados.length > 0;
          return (
          <div key={itemIndex} className="bg-white rounded-xl border border-gray-200 p-5">
            {/* Item Header */}
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{item.descripcion} {item.codigoProducto==='OTRO' && <span className="text-amber-600 text-xs">(OTRO)</span>}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full">Código: <b className="text-gray-700">{item.codigoProducto}</b></span>
                  <span>Cantidad: <b>{item.cantidad}</b> {item.cantidadDetalle && <span className="text-gray-400">({item.cantidadDetalle})</span>}</span>
                  <span>Cuenta: {item.cuentaMayor || '-'} {item.nombreCuentaMayor && `- ${item.nombreCuentaMayor}`}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Cliente: {item.cliente || '-'}</span>
                  <span className="text-[11px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">Contrato: {item.contrato || '-'}</span>
                  <span className="text-[11px] bg-gray-50 text-gray-700 border px-2 py-0.5 rounded-full">Sucursal: {item.sucursal || '-'}</span>
                  <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">UN: {item.unidadNegocio || '-'}</span>
                  <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Proyecto: {item.proyecto || '-'}</span>
                </div>
              </div>
              {esCompraDirecta ? (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium shrink-0">Directa</span>
              ) : solicitud.estado === 'en_cotizacion' && (
                <button onClick={() => handleAddCotizacion(itemIndex)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 shrink-0">
                  <Plus className="h-3 w-3" /> Agregar Cotizacion
                </button>
              )}
            </div>

            {/* ─── BaseProveedores para este código ─── */}
            <div className="mb-4 rounded-xl border bg-gray-50 p-3">
              <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2"><DollarSign className="h-3.5 w-3.5"/> BaseProveedores — matriz (proveedores como columnas) para <span className="font-mono bg-white border px-1.5 py-0.5 rounded">{item.codigoProducto}</span></p>
              {tieneBase ? (
                <div className="overflow-x-auto">
                  <div className="flex gap-2 pb-1">
                    {provsOrdenados.map(({proveedor, precio}) => (
                      <div key={proveedor} className="min-w-[130px] bg-white border rounded-lg px-3 py-2 text-center">
                        <p className="text-[11px] font-semibold text-gray-700 truncate">{proveedor}</p>
                        <p className="text-sm font-mono font-bold text-green-700">{formatMoney(precio)}</p>
                        <button type="button" onClick={()=>{
                          // Aplicar este proveedor/precio a la primera cotización vacía o crear una nueva
                          const newItems = [...solicitud.items];
                          const it = { ...newItems[itemIndex] };
                          if (!it.cotizaciones) it.cotizaciones = [];
                          let idx = it.cotizaciones.findIndex(c=> !c.proveedor);
                          if (idx===-1) { it.cotizaciones = [...it.cotizaciones, { proveedor, precioUnitario: precio, porcentajeIva: 19, valorIva: Math.round(precio*0.19), precioConIva: precio+Math.round(precio*0.19), cantidad: it.cantidad, subtotal: precio*it.cantidad, total: (precio+Math.round(precio*0.19))*it.cantidad } as CotizacionItem]; idx = it.cotizaciones.length-1; }
                          else {
                            const c = { ...it.cotizaciones[idx], proveedor, precioUnitario: precio, valorIva: Math.round(precio*0.19), precioConIva: precio+Math.round(precio*0.19), subtotal: precio*it.cantidad, total: (precio+Math.round(precio*0.19))*it.cantidad } as CotizacionItem;
                            it.cotizaciones[idx]=c;
                          }
                          newItems[itemIndex]=it;
                          setSolicitud({...solicitud, items: newItems});
                          toast.success(`${proveedor} → ${formatMoney(precio)} aplicado`);
                        }} className="mt-1 text-[11px] bg-blue-600 text-white px-2 py-1 rounded-full hover:bg-blue-700">Usar</button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Al elegir un proveedor se autocompleta el precio para ese código (aplicarPrecioProveedor). {nombresProveedores.length} proveedores en total.</p>
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  <p>Sin precio mapeado para este código en BaseProveedores. Proveedores disponibles ({nombresProveedores.length}): {nombresProveedores.slice(0,6).join(', ')}{nombresProveedores.length>6?' …':''}</p>
                  <p className="text-[11px] text-gray-400 mt-1">Agrega la cotización manual abajo — quedará guardada para futuros pedidos.</p>
                </div>
              )}
            </div>

            {esCompraDirecta && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-bold text-amber-800 mb-2">Elige proveedor para compra directa (más barato primero)</p>
                {(() => {
                  if (provsOrdenados.length === 0) return <p className="text-xs text-gray-500">Sin proveedores mapeados, agrega cotizacion manual abajo.</p>;
                  return (
                    <div className="space-y-2">
                      {provsOrdenados.map(({proveedor, precio}) => (
                        <label key={proveedor} className="flex items-center gap-2 p-2 rounded-lg border bg-white cursor-pointer hover:border-amber-300">
                          <input type="radio" name={`direct-${itemIndex}`} onChange={() => {
                            const precioNum = Number(precio);
                            const iva = 19;
                            const valorIva = Math.round(precioNum * (iva/100));
                            const newCot = { proveedor, precioUnitario: precioNum, porcentajeIva: iva, valorIva, precioConIva: precioNum+valorIva, cantidad: item.cantidad, subtotal: precioNum*item.cantidad, total: (precioNum+valorIva)*item.cantidad } as CotizacionItem;
                            const newItems = [...solicitud.items];
                            newItems[itemIndex] = { ...newItems[itemIndex], cotizaciones: [newCot], mejorCotizacionIndex: 0 };
                            setSolicitud({ ...solicitud, items: newItems } as any);
                          }} className="h-4 w-4 text-amber-600" />
                          <span className="flex-1 text-sm">{proveedor}</span>
                          <span className="text-sm font-mono font-bold">{formatMoney(Number(precio))}</span>
                        </label>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Cotizaciones existentes */}
            {item.cotizaciones && item.cotizaciones.length > 0 ? (
              <div className="space-y-3">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-7 gap-2 text-[10px] font-semibold text-gray-500 uppercase px-1">
                  <span>Proveedor (BaseProveedores)</span>
                  <span className="text-right">Precio/Unit</span>
                  <span className="text-center">IVA %</span>
                  <span className="text-right">Valor IVA</span>
                  <span className="text-right">Precio+IVA</span>
                  <span className="text-right">Total</span>
                  <span></span>
                </div>
                {item.cotizaciones.map((cot, cotIndex) => (
                  <div key={cotIndex}
                    className={`grid grid-cols-1 md:grid-cols-7 gap-2 items-center p-3 rounded-xl border ${item.mejorCotizacionIndex === cotIndex ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    {/* Proveedor: select con data-precio */}
                    <div className="relative">
                      <label className="block md:hidden text-[11px] font-semibold text-gray-600 mb-1">Proveedor</label>
                      <select
                        value={cot.proveedor}
                        onChange={e => handleUpdateCotizacion(itemIndex, cotIndex, 'proveedor', e.target.value)}
                        className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Proveedor --</option>
                        {nombresProveedores.map(p => {
                          const precio = precioDeProveedor(item.codigoProducto, p);
                          return <option key={p} value={p}>{p}{precio!==null ? ` — ${formatMoney(precio)}` : ' — sin precio'}</option>;
                        })}
                      </select>
                      {/* Buscador alternativo */}
                      <div className="relative mt-1 md:hidden">
                        <input value={busquedaProveedor[`${itemIndex}-${cotIndex}`] || cot.proveedor}
                          onChange={e => {
                            const v = e.target.value;
                            setBusquedaProveedor({ ...busquedaProveedor, [`${itemIndex}-${cotIndex}`]: v });
                            setShowProveedorDropdown(`${itemIndex}-${cotIndex}`);
                          }}
                          onFocus={() => setShowProveedorDropdown(`${itemIndex}-${cotIndex}`)}
                          onBlur={() => setTimeout(() => setShowProveedorDropdown(null), 200)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                          placeholder="Buscar proveedor..." />
                        {showProveedorDropdown === `${itemIndex}-${cotIndex}` && (
                          <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-auto">
                            {getProveedorSugerencias(busquedaProveedor[`${itemIndex}-${cotIndex}`] || '').map(p => {
                              const precio = precioDeProveedor(item.codigoProducto, p);
                              return (
                                <button key={p} onMouseDown={() => { handleUpdateCotizacion(itemIndex, cotIndex, 'proveedor', p); setBusquedaProveedor({...busquedaProveedor, [`${itemIndex}-${cotIndex}`]: p}); setShowProveedorDropdown(null); }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex justify-between">
                                  <span>{p}</span>
                                  <span className="text-gray-400">{precio!==null ? formatMoney(precio) : '—'}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Precio Unitario */}
                    <div>
                      <label className="block md:hidden text-[11px] font-semibold text-gray-600 mb-1">Precio/Unit</label>
                      <input type="number" value={cot.precioUnitario || ''}
                        onChange={e => handleUpdateCotizacion(itemIndex, cotIndex, 'precioUnitario', Number(e.target.value))}
                        className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white text-right focus:ring-2 focus:ring-blue-500"
                        placeholder="0" />
                    </div>

                    {/* IVA */}
                    <div>
                      <label className="block md:hidden text-[11px] font-semibold text-gray-600 mb-1">IVA %</label>
                      <select value={cot.porcentajeIva}
                        onChange={e => handleUpdateCotizacion(itemIndex, cotIndex, 'porcentajeIva', Number(e.target.value))}
                        className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg bg-white text-center focus:ring-2 focus:ring-blue-500">
                        {IVA_OPCIONES.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Valor IVA */}
                    <div className="text-xs text-right text-gray-600 font-mono hidden md:block">
                      {formatMoney(cot.valorIva || 0)}
                    </div>
                    <div className="md:hidden flex justify-between text-xs">
                      <span className="text-gray-500">IVA:</span><span className="font-mono">{formatMoney(cot.valorIva || 0)}</span>
                    </div>

                    {/* Precio + IVA */}
                    <div className="text-xs text-right font-bold text-gray-900 font-mono hidden md:block">
                      {formatMoney(cot.precioConIva || 0)}
                    </div>
                    <div className="md:hidden flex justify-between text-xs">
                      <span className="text-gray-500">Precio+IVA:</span><span className="font-mono font-bold">{formatMoney(cot.precioConIva || 0)}</span>
                    </div>

                    {/* Total */}
                    <div className="text-sm text-right font-bold text-green-600 font-mono hidden md:block">
                      {formatMoney(cot.total || 0)}
                    </div>
                    <div className="md:hidden flex justify-between text-sm">
                      <span className="text-gray-500">Total:</span><span className="font-mono font-bold text-green-600">{formatMoney(cot.total || 0)}</span>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleSeleccionarMejor(itemIndex, cotIndex)}
                        className={`px-2 py-1 text-[10px] font-medium rounded-full border ${item.mejorCotizacionIndex === cotIndex ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                        {item.mejorCotizacionIndex === cotIndex ? '✓ SELECCIONADO' : 'Marcar mejor'}
                      </button>
                      {solicitud.estado === 'en_cotizacion' && (
                        <button onClick={() => handleRemoveCotizacion(itemIndex, cotIndex)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                {solicitud.estado === 'en_cotizacion'
                  ? 'No hay cotizaciones. Usa la matriz BaseProveedores arriba o click "Agregar Cotizacion".'
                  : 'Esperando cotización del analista...'}
              </div>
            )}
          </div>
        )})}
      </div>

      {/* Resumen */}
      {solicitud.items.some(item => item.cotizaciones?.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-4">Resumen de Cotizacion</h3>
          <div className="grid md:grid-cols-2 gap-4">
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
