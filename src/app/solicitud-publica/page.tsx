'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Loader2, Plus, Trash2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { obtenerEmpresas, crearSolicitud, obtenerProductos } from '@/lib/firestore';
import type { Empresa, Producto } from '@/types';

export default function SolicitudPublica() {
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [centroTrabajo, setCentroTrabajo] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [fechaRequerida, setFechaRequerida] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState([{ _key: 1, codigoProducto: '', descripcion: '', cantidad: 1 }]);
  let nextKey = 2;

  useEffect(() => { obtenerEmpresas().then(d => { setEmpresas(d.filter(e => e.activa)); setCargando(false); }).catch(() => setCargando(false)); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de productos por empresa
  useEffect(() => { if (empresaId) obtenerProductos(empresaId).then(setProductos).catch(() => {}); else setProductos([]); }, [empresaId]);

  const addItem = () => setItems([...items, { _key: nextKey++, codigoProducto: '', descripcion: '', cantidad: 1 }]);
  const removeItem = (key: number) => { if (items.length > 1) setItems(items.filter(item => item._key !== key)); };
  const updateItem = (key: number, field: string, value: any) => {
    setItems(items.map(item => {
      if (item._key !== key) return item;
      const updated = { ...item, [field]: value };
      if (field === 'codigoProducto') {
        const p = productos.find(x => x.codigo === value);
        if (p) updated.descripcion = p.descripcion;
      }
      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) { toast.error('Seleccione empresa'); return; }
    if (!nombre || !email) { toast.error('Nombre y email requeridos'); return; }
    if (items.every(i => !i.codigoProducto)) { toast.error('Agregue un producto'); return; }
    setEnviando(true);
    try {
      const emp = empresas.find(e => e.id === empresaId);
      await crearSolicitud({
        empresaId, usuario: 'publico', nombreUsuario: nombre, emailUsuario: email,
        centroTrabajo: centroTrabajo || 'N/A', prioridad: prioridad as any, fechaRequerida, observaciones,
        items: items.filter(i => i.codigoProducto).map(item => {
          const p = productos.find(x => x.codigo === item.codigoProducto);
          return {
            ...item,
            cliente: '', contrato: '', unidadNegocio: '', sucursal: '', ciudad: '',
            proyecto: emp?.nombre || '', cuentaMayor: p?.cuentaMayor || '',
            nombreCuentaMayor: p?.nombreCuentaMayor || '', precioUnitario: p?.precioUnitario || 0,
            indicadorImpuestos: p?.indicadorImpuestos || '',
            cotizaciones: [],
            estadoItem: 'pendiente',
          };
        }),
        estado: 'pendiente',
      });
      toast.success('Enviado');
      router.push('/solicitud-exitosa');
    } catch { toast.error('Error'); } finally { setEnviando(false); }
  };

  if (cargando) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="h-6 w-6 text-blue-600 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.push('/')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <ShoppingCart className="h-5 w-5 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Nueva Solicitud</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Datos Personales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Nombre *</label><input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Email *</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Telefono</label><input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Empresa *</label><select required value={empresaId} onChange={e => setEmpresaId(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="">Seleccionar...</option>{empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Detalles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Centro Trabajo</label><input type="text" value={centroTrabajo} onChange={e => setCentroTrabajo(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="CALIMA" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">Prioridad</label><select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></div>
              <div><label className="block text-xs text-gray-500 mb-1">Fecha</label><input type="date" value={fechaRequerida} onChange={e => setFechaRequerida(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
            </div>
            <div className="mt-3"><label className="block text-xs text-gray-500 mb-1">Observaciones</label><textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Notas..." /></div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Productos</h2>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-blue-700"><Plus className="h-3 w-3" /> Agregar</button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item._key} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5"><select required value={item.codigoProducto} onChange={e => updateItem(item._key, 'codigoProducto', e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-xs"><option value="">Producto...</option>{productos.map(p => <option key={p.id} value={p.codigo}>{p.codigo}</option>)}</select></div>
                  <div className="col-span-4"><input type="text" value={item.descripcion} readOnly className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-500" /></div>
                  <div className="col-span-2"><input type="number" min="1" required value={item.cantidad} onChange={e => updateItem(item._key, 'cantidad', parseInt(e.target.value) || 1)} className="w-full bg-gray-50 border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-center" /></div>
                  <div className="col-span-1 flex justify-center"><button type="button" onClick={() => removeItem(item._key)} disabled={items.length <= 1} className="p-1 text-red-400 hover:text-red-600 disabled:opacity-20"><Trash2 className="h-3 w-3" /></button></div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => router.push('/')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg">Cancelar</button>
            <button type="submit" disabled={enviando} className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
