'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Plus,
  Trash2,
  Search,
  Check,
  X,
  FileText,
  Download,
  Mail,
  Loader2,
  Store,
  Package,
  DollarSign,
} from 'lucide-react';
import { obtenerProveedores, obtenerSolicitud } from '@/lib/firestore';
import type { Solicitud, Proveedor } from '@/types';
import toast from 'react-hot-toast';

interface ItemCotizacion {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  proveedorSeleccionado: string;
  archivoCotizacion: File | null;
  notas: string;
}

export default function EnviarCotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [items, setItems] = useState<ItemCotizacion[]>([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>('');
  const [emailProveedor, setEmailProveedor] = useState<string>('');
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const id = (await params).id;
        const [sol, provs] = await Promise.all([
          obtenerSolicitud(id),
          empresa?.id ? obtenerProveedores(empresa.id) : Promise.resolve([]),
        ]);
        setSolicitud(sol);
        setProveedores(provs);

        if (sol?.items) {
          setItems(sol.items.map(item => ({
            codigo: item.codigoProducto,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario || 0,
            proveedorSeleccionado: '',
            archivoCotizacion: null,
            notas: '',
          })));
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, [params, empresa?.id]);

  const proveedoresUnicos = [...new Set(proveedores.flatMap(p => Object.keys(p.precios || {})))].filter(Boolean);

  const handleProveedorSelect = (itemIndex: number, proveedor: string) => {
    const newItems = [...items];
    newItems[itemIndex].proveedorSeleccionado = proveedor;
    setItems(newItems);
    setShowProveedorModal(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleFileChange = (index: number, file: File | null) => {
    const newItems = [...items];
    newItems[index].archivoCotizacion = file;
    setItems(newItems);
  };

  const handleEnviarCotizacion = async () => {
    if (!solicitud || !usuario) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/solicitudes/${solicitud.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enviar_cotizacion',
          usuarioUid: usuario.uid,
          usuarioNombre: usuario.nombre || usuario.email || 'Analista',
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Error al enviar cotizacion');
      toast.success('Cotizacion enviada correctamente');
      router.push('/admin/solicitudes');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al enviar la cotizacion');
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="p-8 text-center text-gray-500">
        Solicitud no encontrada
      </div>
    );
  }

  const itemsConProveedor = items.filter(i => i.proveedorSeleccionado).length;
  const totalItems = items.length;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Enviar Cotizacion a Proveedores
          </h1>
          <p className="text-gray-500 mt-1">
            Solicitud #{solicitud.numero} - {solicitud.items?.length || 0} items
          </p>
        </div>
        <button
          onClick={handleEnviarCotizacion}
          disabled={enviando || itemsConProveedor === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar a Proveedores
        </button>
      </motion.div>

      {/* Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Progreso</span>
          <span className="text-sm font-bold text-blue-600">
            {itemsConProveedor}/{totalItems} items con proveedor
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(itemsConProveedor / totalItems) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          />
        </div>
      </motion.div>

      {/* Items */}
      <div className="space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.descripcion}</h3>
                  <p className="text-xs text-gray-500">
                    Codigo: {item.codigo} | Cantidad: {item.cantidad}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveItem(index)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Proveedor */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Proveedor
                </label>
                <button
                  onClick={() => {
                    setSelectedItemIndex(index);
                    setShowProveedorModal(true);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm border rounded-xl transition-colors ${
                    item.proveedorSeleccionado
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className="truncate">
                    {item.proveedorSeleccionado || 'Seleccionar proveedor'}
                  </span>
                  <Search className="h-4 w-4 shrink-0" />
                </button>
              </div>

              {/* Archivo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Archivo de cotizacion
                </label>
                <label className="flex items-center justify-center px-3 py-2 text-sm border border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                    onChange={(e) => handleFileChange(index, e.target.files?.[0] || null)}
                  />
                  {item.archivoCotizacion ? (
                    <span className="flex items-center gap-2 text-green-600">
                      <Check className="h-4 w-4" />
                      {item.archivoCotizacion.name}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-gray-500">
                      <Download className="h-4 w-4" />
                      Subir archivo
                    </span>
                  )}
                </label>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  value={item.notas}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].notas = e.target.value;
                    setItems(newItems);
                  }}
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white"
      >
        <h3 className="font-semibold mb-4">Resumen de Envio</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Total Items</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Con Proveedor</p>
            <p className="text-2xl font-bold text-green-400">{itemsConProveedor}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Sin Proveedor</p>
            <p className="text-2xl font-bold text-amber-400">{totalItems - itemsConProveedor}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Proveedores</p>
            <p className="text-2xl font-bold text-blue-400">
              {[...new Set(items.map(i => i.proveedorSeleccionado).filter(Boolean))].length}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Proveedor Modal */}
      <AnimatePresence>
        {showProveedorModal && selectedItemIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowProveedorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-900">Seleccionar Proveedor</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {items[selectedItemIndex]?.descripcion}
                </p>
              </div>
              <div className="p-5 overflow-y-auto max-h-[60vh]">
                <div className="space-y-2">
                  {proveedoresUnicos.map(proveedor => (
                    <button
                      key={proveedor}
                      onClick={() => handleProveedorSelect(selectedItemIndex, proveedor)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        items[selectedItemIndex]?.proveedorSeleccionado === proveedor
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <Store className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-900">{proveedor}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5 border-t border-gray-100">
                <button
                  onClick={() => setShowProveedorModal(false)}
                  className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
