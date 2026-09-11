'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { motion } from 'motion/react';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  Store,
  Package,
  Calendar,
  TrendingUp,
  Filter,
  Search,
  Eye,
  Loader2,
} from 'lucide-react';

interface CotizacionProveedor {
  id: string;
  solicitudId: string;
  solicitudNumero: number;
  proveedor: string;
  items: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
  }[];
  estado: 'pendiente' | 'respondida' | 'vencida' | 'rechazada';
  fechaEnvio: Date;
  fechaRespuesta?: Date;
  tiempoRespuestaHoras?: number;
  archivosCotizacion: string[];
  notasProveedor?: string;
  precioTotal?: number;
}

// Mock data for demonstration
const MOCK_COTIZACIONES: CotizacionProveedor[] = [
  {
    id: '1',
    solicitudId: 'sol1',
    solicitudNumero: 1001,
    proveedor: 'Distribuidora ABC',
    items: [
      { codigo: 'P001', descripcion: 'Material de oficina', cantidad: 100, precioUnitario: 0 },
      { codigo: 'P002', descripcion: 'Tintas', cantidad: 50, precioUnitario: 0 },
    ],
    estado: 'respondida',
    fechaEnvio: new Date(Date.now() - 86400000 * 2), // 2 days ago
    fechaRespuesta: new Date(Date.now() - 86400000), // 1 day ago
    tiempoRespuestaHoras: 24,
    archivosCotizacion: ['cotizacion_abc.pdf'],
    precioTotal: 2500000,
  },
  {
    id: '2',
    solicitudId: 'sol2',
    solicitudNumero: 1002,
    proveedor: 'Suministros XYZ',
    items: [
      { codigo: 'P003', descripcion: 'Computador portatil', cantidad: 5, precioUnitario: 0 },
    ],
    estado: 'pendiente',
    fechaEnvio: new Date(Date.now() - 86400000), // 1 day ago
    archivosCotizacion: [],
  },
  {
    id: '3',
    solicitudId: 'sol3',
    solicitudNumero: 1003,
    proveedor: 'Tech Solutions',
    items: [
      { codigo: 'P004', descripcion: 'Software licencia', cantidad: 10, precioUnitario: 0 },
    ],
    estado: 'vencida',
    fechaEnvio: new Date(Date.now() - 86400000 * 7), // 7 days ago
    archivosCotizacion: [],
  },
];

export default function SeguimientoProveedoresPage() {
  const { empresa } = useCompany();
  const [cotizaciones, setCotizaciones] = useState<CotizacionProveedor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    // Simulate loading from Firestore
    setTimeout(() => {
      setCotizaciones(MOCK_COTIZACIONES);
      setCargando(false);
    }, 1000);
  }, [empresa?.id]);

  const filtradas = cotizaciones.filter(c => {
    const matchBusqueda = !busqueda ||
      c.proveedor.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.solicitudNumero.toString().includes(busqueda);
    const matchEstado = filtroEstado === 'todos' || c.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const stats = {
    total: cotizaciones.length,
    pendientes: cotizaciones.filter(c => c.estado === 'pendiente').length,
    respondidas: cotizaciones.filter(c => c.estado === 'respondida').length,
    vencidas: cotizaciones.filter(c => c.estado === 'vencida').length,
    tiempoPromedio: cotizaciones
      .filter(c => c.tiempoRespuestaHoras)
      .reduce((acc, c) => acc + (c.tiempoRespuestaHoras || 0), 0) /
      Math.max(cotizaciones.filter(c => c.tiempoRespuestaHoras).length, 1),
  };

  const getEstadoBadge = (estado: string) => {
    const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pendiente: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        icon: <Clock className="h-3 w-3" />,
      },
      respondida: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        icon: <CheckCircle className="h-3 w-3" />,
      },
      vencida: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        icon: <XCircle className="h-3 w-3" />,
      },
      rechazada: {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        icon: <AlertCircle className="h-3 w-3" />,
      },
    };
    return badges[estado] || badges.pendiente;
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-gray-900">
          Seguimiento a Proveedores
        </h1>
        <p className="text-gray-500 mt-1">
          Monitorea el estado de las cotizaciones enviadas
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Store className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Pendientes</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{stats.pendientes}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Respondidas</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.respondidas}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-500">Tiempo Promedio</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{Math.round(stats.tiempoPromedio)}h</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por proveedor o solicitud..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'todos', label: 'Todos' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'respondida', label: 'Respondidas' },
            { value: 'vencida', label: 'Vencidas' },
          ].map(filtro => (
            <button
              key={filtro.value}
              onClick={() => setFiltroEstado(filtro.value)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                filtroEstado === filtro.value
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {filtro.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600">Proveedor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600">Solicitud</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-600">Items</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600">Estado</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600">Fecha Envio</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600">Tiempo Respuesta</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtradas.map(cotizacion => {
                const badge = getEstadoBadge(cotizacion.estado);
                return (
                  <tr key={cotizacion.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                          {cotizacion.proveedor.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{cotizacion.proveedor}</p>
                          <p className="text-xs text-gray-500">
                            {cotizacion.items.length} items
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        #{cotizacion.solicitudNumero}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[200px]">
                        {cotizacion.items.slice(0, 2).map((item, i) => (
                          <p key={i} className="text-xs text-gray-600 truncate">
                            {item.descripcion}
                          </p>
                        ))}
                        {cotizacion.items.length > 2 && (
                          <p className="text-xs text-gray-400">
                            +{cotizacion.items.length - 2} mas
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.icon}
                        {cotizacion.estado.charAt(0).toUpperCase() + cotizacion.estado.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                        <Calendar className="h-3 w-3" />
                        {cotizacion.fechaEnvio.toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {cotizacion.tiempoRespuestaHoras ? (
                        <span className={`text-sm font-bold ${
                          cotizacion.tiempoRespuestaHoras <= 24 ? 'text-green-600' :
                          cotizacion.tiempoRespuestaHoras <= 48 ? 'text-amber-600' :
                          'text-red-600'
                        }`}>
                          {cotizacion.tiempoRespuestaHoras}h
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Pendiente</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtradas.length === 0 && (
          <div className="p-8 text-center">
            <Store className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay cotizaciones para mostrar</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
