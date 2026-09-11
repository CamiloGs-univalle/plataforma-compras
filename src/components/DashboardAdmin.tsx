'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  obtenerTodasSolicitudesEnTiempoReal,
  actualizarEstadoSolicitud,
  eliminarSolicitud,
  agregarNotaSolicitud,
  obtenerEmpresas,
} from '@/lib/firestore';
import type { Solicitud, Empresa } from '@/types';
import { ESTADOS_SOLICITUD, PRIORIDADES } from '@/types';
import { format, isToday, isYesterday, isThisWeek, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  Loader2, Clock, CheckCircle2, AlertTriangle, XCircle,
  Search, Filter, Eye, Trash2, MessageSquare, ChevronDown,
  GripVertical, RefreshCw, TrendingUp, Package, Users, DollarSign,
} from 'lucide-react';
import { formatMoney } from '@/lib/format';

const ESTADO_COLORS: Record<string, string> = {
  pendiente: '#f59e0b',
  en_cotizacion: '#3b82f6',
  cotizada: '#8b5cf6',
  aprobada: '#10b981',
  en_pedido: '#06b6d4',
  completada: '#10b981',
  cancelada: '#ef4444',
};

const PRIORIDAD_COLORS: Record<string, string> = {
  baja: '#6b7280',
  media: '#f59e0b',
  alta: '#f97316',
  urgente: '#ef4444',
};

export default function DashboardAdmin() {
  const { usuario } = useAuth();
  const { empresa } = useCompany();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>('todas');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todas');
  const [vista, setVista] = useState<'kanban' | 'tabla'>('kanban');
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<Solicitud | null>(null);
  const [nuevaNota, setNuevaNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    if (!empresa?.id) return;
    const unsub = obtenerTodasSolicitudesEnTiempoReal(empresa.id, (sols) => {
      setSolicitudes(sols);
      setCargando(false);
    });
    obtenerEmpresas().then(setEmpresas).catch(() => {});
    return () => unsub();
  }, [empresa?.id]);

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter(s => {
      const matchBusqueda = !busqueda ||
        s.nombreUsuario?.toLowerCase().includes(busqueda.toLowerCase()) ||
        s.numero?.toString().includes(busqueda) ||
        s.items?.some(i => i.descripcion?.toLowerCase().includes(busqueda.toLowerCase())) ||
        s.centroTrabajo?.toLowerCase().includes(busqueda.toLowerCase());
      const matchEstado = filtroEstado === 'todos' || s.estado === filtroEstado;
      const matchPrioridad = filtroPrioridad === 'todas' || s.prioridad === filtroPrioridad;
      const matchEmpresa = filtroEmpresa === 'todas' || s.empresaId === filtroEmpresa;
      return matchBusqueda && matchEstado && matchPrioridad && matchEmpresa;
    });
  }, [solicitudes, busqueda, filtroEstado, filtroPrioridad, filtroEmpresa]);

  const stats = useMemo(() => {
    const total = solicitudes.length;
    const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;
    const enCotizacion = solicitudes.filter(s => s.estado === 'en_cotizacion').length;
    const cotizadas = solicitudes.filter(s => s.estado === 'cotizada').length;
    const aprobadas = solicitudes.filter(s => s.estado === 'aprobada').length;
    const completadas = solicitudes.filter(s => s.estado === 'completada').length;
    const canceladas = solicitudes.filter(s => s.estado === 'cancelada').length;
    return { total, pendientes, enCotizacion, cotizadas, aprobadas, completadas, canceladas };
  }, [solicitudes]);

  const datosGraficaBarras = useMemo(() => {
    const estados = ESTADOS_SOLICITUD.map(e => ({
      nombre: e.label,
      cantidad: solicitudes.filter(s => s.estado === e.value).length,
      color: e.color,
    }));
    return estados;
  }, [solicitudes]);

  const datosGraficaCircular = useMemo(() => {
    const prioridades = PRIORIDADES.map(p => ({
      nombre: p.label,
      value: solicitudes.filter(s => s.prioridad === p.value).length,
      color: p.color,
    })).filter(p => p.value > 0);
    return prioridades;
  }, [solicitudes]);

  const datosGraficaLinea = useMemo(() => {
    const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - (6 - i));
      const diaStr = format(fecha, 'dd/MM');
      const cantidad = solicitudes.filter(s => {
        const f = new Date(s.fechaCreacion);
        return format(f, 'dd/MM') === diaStr;
      }).length;
      return { dia: diaStr, solicitudes: cantidad };
    });
    return ultimos7Dias;
  }, [solicitudes]);

  const handleDragStart = useCallback((solicitudId: string) => {
    setDraggedItem(solicitudId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(async (nuevoEstado: string) => {
    if (!draggedItem) return;
    await actualizarEstadoSolicitud(draggedItem, nuevoEstado);
    setDraggedItem(null);
  }, [draggedItem]);

  const handleAgregarNota = async () => {
    if (!solicitudSeleccionada || !nuevaNota.trim() || !usuario) return;
    setGuardandoNota(true);
    try {
      await agregarNotaSolicitud(solicitudSeleccionada.id, {
        texto: nuevaNota.trim(),
        autor: usuario.nombre || usuario.email || 'Usuario',
        tipo: 'general',
      });
      setNuevaNota('');
      setSolicitudSeleccionada(null);
    } finally {
      setGuardandoNota(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta solicitud permanentemente?')) return;
    await eliminarSolicitud(id);
  };

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Panel de Control</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })} — {stats.total} solicitudes
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVista(vista === 'kanban' ? 'tabla' : 'kanban')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {vista === 'kanban' ? '📊 Tabla' : '📋 Kanban'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Package className="h-5 w-5" />} label="Total" value={stats.total} color="bg-blue-600" />
          <StatCard icon={<Clock className="h-5 w-5" />} label="Pendientes" value={stats.pendientes} color="bg-amber-500" />
          <StatCard icon={<Search className="h-5 w-5" />} label="En Cotizacion" value={stats.enCotizacion} color="bg-blue-500" />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Aprobadas" value={stats.aprobadas} color="bg-emerald-500" />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="Cotizadas" value={stats.cotizadas} icon={<DollarSign className="h-4 w-4 text-purple-400" />} />
          <MiniStat label="Completadas" value={stats.completadas} icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} />
          <MiniStat label="Canceladas" value={stats.canceladas} icon={<XCircle className="h-4 w-4 text-red-400" />} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Solicitudes por Estado</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={datosGraficaBarras}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]}>
                  {datosGraficaBarras.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Por Prioridad</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={datosGraficaCircular}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {datosGraficaCircular.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Últimos 7 Días</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={datosGraficaLinea}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="solicitudes" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por usuario, #solicitud, producto, centro..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="todos">Todos los estados</option>
              {ESTADOS_SOLICITUD.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            <select value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="todas">Todas las prioridades</option>
              {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white">
              <option value="todas">Todas las empresas</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <span className="text-sm text-gray-500">{solicitudesFiltradas.length} resultados</span>
          </div>
        </div>

        {/* Kanban Board */}
        {vista === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {ESTADOS_SOLICITUD.map(estado => {
              const sols = solicitudesFiltradas.filter(s => s.estado === estado.value);
              return (
                <div
                  key={estado.value}
                  className="bg-gray-100 rounded-xl p-3 min-h-[300px]"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(estado.value)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: estado.color }} />
                      <h3 className="text-sm font-semibold text-gray-700">{estado.label}</h3>
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">{sols.length}</span>
                  </div>
                  <div className="space-y-2">
                    {sols.map(s => (
                      <div
                        key={s.id}
                        draggable
                        onDragStart={() => handleDragStart(s.id)}
                        onClick={() => setSolicitudSeleccionada(s)}
                        className={`bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all ${
                          draggedItem === s.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-gray-900">#{s.numero}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: PRIORIDAD_COLORS[s.prioridad] + '20', color: PRIORIDAD_COLORS[s.prioridad] }}>
                            {s.prioridad}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                          {s.items?.[0]?.descripcion || 'Sin descripción'}
                          {(s.items?.length || 0) > 1 && ` +${s.items!.length - 1} más`}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{s.nombreUsuario}</span>
                          <span>{format(new Date(s.fechaCreacion), 'dd/MM/yy')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table View */}
        {vista === 'tabla' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Solicitante</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Centro</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Prioridad</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400">
                        No hay solicitudes que coincidan con los filtros
                      </td>
                    </tr>
                  ) : (
                    solicitudesFiltradas.map(s => (
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900">#{s.numero}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{s.nombreUsuario}</p>
                            <p className="text-xs text-gray-400">{s.emailUsuario}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                          {s.items?.[0]?.descripcion || '-'}
                          {(s.items?.length || 0) > 1 && <span className="text-xs text-gray-400 ml-1">+{s.items!.length - 1}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.centroTrabajo || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-1 rounded-full"
                            style={{ backgroundColor: PRIORIDAD_COLORS[s.prioridad] + '20', color: PRIORIDAD_COLORS[s.prioridad] }}>
                            {s.prioridad}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={s.estado}
                            onChange={async (e) => {
                              await actualizarEstadoSolicitud(s.id, e.target.value);
                            }}
                            className="text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer"
                            style={{ backgroundColor: ESTADO_COLORS[s.estado] + '20', color: ESTADO_COLORS[s.estado] }}
                          >
                            {ESTADOS_SOLICITUD.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {format(new Date(s.fechaCreacion), 'dd/MM/yy HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSolicitudSeleccionada(s)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleEliminar(s.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {solicitudSeleccionada && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSolicitudSeleccionada(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Solicitud #{solicitudSeleccionada.numero}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {solicitudSeleccionada.nombreUsuario} — {format(new Date(solicitudSeleccionada.fechaCreacion), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={solicitudSeleccionada.estado}
                    onChange={async (e) => {
                      await actualizarEstadoSolicitud(solicitudSeleccionada.id, e.target.value);
                      setSolicitudSeleccionada({ ...solicitudSeleccionada, estado: e.target.value as any });
                    }}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200"
                  >
                    {ESTADOS_SOLICITUD.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                  <button onClick={() => setSolicitudSeleccionada(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Centro de Trabajo" value={solicitudSeleccionada.centroTrabajo} />
                <InfoItem label="Prioridad" value={
                  <span className="font-medium" style={{ color: PRIORIDAD_COLORS[solicitudSeleccionada.prioridad] }}>
                    {solicitudSeleccionada.prioridad?.charAt(0).toUpperCase() + solicitudSeleccionada.prioridad?.slice(1)}
                  </span>
                } />
                <InfoItem label="Fecha Requerida" value={solicitudSeleccionada.fechaRequerida || 'No especificada'} />
                <InfoItem label="Empresa" value={
                  empresas.find(e => e.id === solicitudSeleccionada.empresaId)?.nombre || solicitudSeleccionada.empresaId
                } />
              </div>

              {/* Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Productos ({solicitudSeleccionada.items?.length || 0})</h3>
                <div className="space-y-2">
                  {solicitudSeleccionada.items?.map((item, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.descripcion}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Código: {item.codigoProducto} — Cant: {item.cantidad}
                          </p>
                        </div>
                        <div className="text-right">
                          {item.cotizaciones && item.cotizaciones.length > 0 ? (
                            <>
                              <p className="text-sm font-bold text-green-600">
                                {formatMoney(item.cotizaciones[item.mejorCotizacionIndex ?? 0]?.total || 0)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {item.cotizaciones[item.mejorCotizacionIndex ?? 0]?.proveedor || ''}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">Sin cotizar</p>
                          )}
                        </div>
                      </div>
                      {/* Cotizaciones */}
                      {item.cotizaciones && item.cotizaciones.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {item.cotizaciones.slice(0, 3).map((cot, i) => (
                            <div key={i} className={`bg-white rounded p-2 border text-center ${
                              i === (item.mejorCotizacionIndex ?? 0) ? 'border-green-300 bg-green-50' : 'border-gray-100'
                            }`}>
                              <p className="text-[10px] text-gray-400 truncate">{cot.proveedor}</p>
                              <p className="text-xs font-bold text-gray-900">{formatMoney(cot.total || 0)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Notas / Seguimiento</h3>
                {solicitudSeleccionada.notas && solicitudSeleccionada.notas.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {solicitudSeleccionada.notas.map(nota => (
                      <div key={nota.id} className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <p className="text-sm text-gray-700">{nota.texto}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {nota.autor} — {format(new Date(nota.fecha), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mb-3">Sin notas aún</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Agregar nota de seguimiento..."
                    value={nuevaNota}
                    onChange={(e) => setNuevaNota(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAgregarNota()}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAgregarNota}
                    disabled={!nuevaNota.trim() || guardandoNota}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {guardandoNota ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${color} text-white`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-lg font-bold text-gray-900">{value}</span>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
