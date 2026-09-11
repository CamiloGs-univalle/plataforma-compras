'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Clock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  FileText,
  Loader2,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { obtenerSolicitudes, obtenerEmpresas } from '@/lib/firestore';
import AdminLayout from '@/components/AdminLayout';
import type { Solicitud, Empresa } from '@/types';

export default function DashboardPage() {
  const { user, usuario, loading } = useAuth();
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  useEffect(() => {
    async function cargar() {
      if (!usuario) return;
      try {
        const empData = await obtenerEmpresas();
        const misEmpresas = usuario.rol === 'super_admin'
          ? empData
          : empData.filter(e => usuario.empresas?.includes(e.id));
        setEmpresas(misEmpresas);

        const all: Solicitud[] = [];
        for (const emp of misEmpresas) {
          all.push(...await obtenerSolicitudes(emp.id));
        }
        setSolicitudes(all);
      } catch (e) { console.error(e); } finally { setCargando(false); }
    }
    if (usuario) cargar();
  }, [usuario]);

  const stats = useMemo(() => {
    const total = solicitudes.length;
    const pendientes = solicitudes.filter(s => s.estado === 'pendiente').length;
    const enCotizacion = solicitudes.filter(s => s.estado === 'en_cotizacion').length;
    const cotizadas = solicitudes.filter(s => s.estado === 'cotizada').length;
    const aprobadas = solicitudes.filter(s => s.estado === 'aprobada').length;
    const completadas = solicitudes.filter(s => s.estado === 'completada').length;
    const maxEstado = Math.max(pendientes, enCotizacion, cotizadas, aprobadas, completadas, 1);
    return { total, pendientes, enCotizacion, cotizadas, aprobadas, completadas, maxEstado };
  }, [solicitudes]);

  const empresaStats = useMemo(() => {
    return empresas.map(emp => ({
      nombre: emp.nombre,
      color: emp.color,
      count: solicitudes.filter(s => s.empresaId === emp.id).length,
    })).filter(e => e.count > 0).sort((a, b) => b.count - a.count);
  }, [empresas, solicitudes]);

  if (loading || cargando) {
    return <AdminLayout><div className="flex flex-col items-center justify-center py-32 gap-3"><Loader2 className="h-6 w-6 text-blue-600 animate-spin" /><p className="text-sm text-gray-500">Cargando solicitudes...</p></div></AdminLayout>;
  }

  if (!user || !usuario) return null;

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Resumen de compras</p>
        </div>
        <button onClick={() => router.push('/nueva-solicitud')}
          className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" /> Nueva
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'En Cotizacion', value: stats.enCotizacion, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Aprobadas', value: stats.aprobadas, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${bg}`}><Icon className={`h-4 w-4 ${color}`} /></div>
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Bar chart - por estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Por Estado</h3>
          <div className="space-y-3">
            {[
              { label: 'Pendientes', value: stats.pendientes, color: 'bg-amber-400' },
              { label: 'En Cotizacion', value: stats.enCotizacion, color: 'bg-blue-400' },
              { label: 'Aprobadas', value: stats.aprobadas, color: 'bg-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-semibold text-gray-900">{value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${stats.maxEstado > 0 ? (value / stats.maxEstado) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por empresa */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Por Empresa</h3>
          {empresaStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">Sin datos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {empresaStats.map((emp) => (
                <div key={emp.nombre} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: emp.color }} />
                  <span className="text-sm text-gray-700 flex-1 truncate">{emp.nombre}</span>
                  <span className="text-sm font-semibold text-gray-900">{emp.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Urgentes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Atencion</h3>
          <div className="space-y-3">
            {stats.pendientes > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">{stats.pendientes} pendientes</p>
                  <p className="text-xs text-amber-600">Requieren revision</p>
                </div>
              </div>
            )}
            {solicitudes.filter(s => s.prioridad === 'urgente').length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">{solicitudes.filter(s => s.prioridad === 'urgente').length} urgentes</p>
                  <p className="text-xs text-red-600">Prioridad maxima</p>
                </div>
              </div>
            )}
            {stats.pendientes === 0 && solicitudes.filter(s => s.prioridad === 'urgente').length === 0 && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-900">Todo al dia</p>
                  <p className="text-xs text-emerald-600">Sin pendientes urgentes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla recientes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Solicitudes Recientes</h3>
        </div>
        {solicitudes.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No hay solicitudes aun</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Solicitante</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Empresa</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Prioridad</th>
                  <th className="text-left py-2.5 px-4 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitudes.slice(0, 10).map(sol => {
                  const emp = empresas.find(e => e.id === sol.empresaId);
                  return (
                    <tr key={sol.id} className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/solicitud/${sol.id}`)}>
                      <td className="py-2.5 px-4 font-mono text-gray-500">#{sol.numero || '-'}</td>
                      <td className="py-2.5 px-4 font-medium text-gray-900">{sol.nombreUsuario}</td>
                      <td className="py-2.5 px-4 text-gray-600">{emp?.nombre || '-'}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          sol.estado === 'pendiente' ? 'bg-amber-100 text-amber-700' :
                          sol.estado === 'en_cotizacion' ? 'bg-blue-100 text-blue-700' :
                          sol.estado === 'cotizada' ? 'bg-purple-100 text-purple-700' :
                          sol.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700' :
                          sol.estado === 'en_pedido' ? 'bg-cyan-100 text-cyan-700' :
                          sol.estado === 'completada' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-red-100 text-red-700'
                        }`}>{sol.estado}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs font-medium ${
                          sol.prioridad === 'urgente' ? 'text-red-600' :
                          sol.prioridad === 'alta' ? 'text-orange-600' :
                          sol.prioridad === 'media' ? 'text-amber-600' : 'text-gray-500'
                        }`}>{sol.prioridad}</span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">
                        {sol.fechaCreacion instanceof Date ? sol.fechaCreacion.toLocaleDateString('es-CO') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
