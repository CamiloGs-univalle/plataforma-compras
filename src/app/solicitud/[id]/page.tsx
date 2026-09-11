'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft, Save, Clock, FileText, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { obtenerSolicitud, actualizarEstadoSolicitud, agregarNotaSolicitud } from '@/lib/firestore';
import { ESTADOS_SOLICITUD } from '@/types';
import AdminLayout from '@/components/AdminLayout';
import { formatMoney } from '@/lib/format';
import type { Solicitud } from '@/types';

export default function DetalleSolicitud() {
  const { user, usuario, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const solicitudId = params.id as string;

  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState('');
  const [nota, setNota] = useState('');

  useEffect(() => {
    if (!usuario || loading) return;
    const cargarSolicitud = async () => {
      try {
        const data = await obtenerSolicitud(solicitudId);
        if (data) {
          setSolicitud(data);
          setEstado(data.estado);
        } else {
          toast.error('Solicitud no encontrada');
          router.push('/admin/solicitudes');
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Error al cargar');
      } finally {
        setCargando(false);
      }
    };
    cargarSolicitud();
  }, [solicitudId, usuario, loading]);

  const handleGuardarEstado = async () => {
    if (!solicitud || !usuario) return;
    setGuardando(true);
    try {
      await actualizarEstadoSolicitud(solicitud.id, estado);
      if (nota) {
        await agregarNotaSolicitud(solicitud.id, {
          texto: nota,
          autor: usuario.nombre || usuario.email || 'Usuario',
          tipo: 'general',
        });
      }
      toast.success('Actualizado');
      setNota('');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (loading || cargando) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!solicitud) {
    return (
      <AdminLayout>
        <div className="p-6 text-center text-gray-500">Solicitud no encontrada</div>
      </AdminLayout>
    );
  }

  const estadoInfo = ESTADOS_SOLICITUD.find(e => e.value === solicitud.estado);
  const totalGeneral = solicitud.items?.reduce((sum, item) => {
    const mejor = item.cotizaciones?.[item.mejorCotizacionIndex ?? 0];
    return sum + (mejor?.total || 0);
  }, 0) || 0;

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 max-w-[1000px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/solicitudes" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Solicitud #{solicitud.numero}</h1>
            <p className="text-sm text-gray-500">{solicitud.nombreUsuario} · {solicitud.centroTrabajo}</p>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: estadoInfo?.color + '20', color: estadoInfo?.color }}>
            {estadoInfo?.icon} {estadoInfo?.label}
          </span>
        </div>

        {/* Info basica */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Solicitante:</span> <span className="font-medium">{solicitud.nombreUsuario}</span></div>
            <div><span className="text-gray-500">Centro:</span> <span className="font-medium">{solicitud.centroTrabajo}</span></div>
            <div><span className="text-gray-500">Prioridad:</span> <span className="font-medium capitalize">{solicitud.prioridad}</span></div>
            <div><span className="text-gray-500">Fecha requerida:</span> <span className="font-medium">{solicitud.fechaRequerida || 'No definida'}</span></div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Items ({solicitud.items?.length || 0})</h3>
          <div className="space-y-3">
            {solicitud.items?.map((item, i) => {
              const mejor = item.cotizaciones?.[item.mejorCotizacionIndex ?? 0];
              return (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.descripcion}</p>
                      <p className="text-xs text-gray-500">Cantidad: {item.cantidad} · Codigo: {item.codigoProducto}</p>
                    </div>
                    {mejor ? (
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">{formatMoney(mejor.total || 0)}</p>
                        <p className="text-[10px] text-gray-500">{mejor.proveedor} (IVA {mejor.porcentajeIva}%)</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Sin cotizar</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {totalGeneral > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="font-bold text-gray-900">Total:</span>
              <span className="text-xl font-bold text-green-600">{formatMoney(totalGeneral)}</span>
            </div>
          )}
        </div>

        {/* Cambiar estado */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Cambiar Estado</h3>
          <div className="space-y-3">
            <select value={estado} onChange={e => setEstado(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500">
              {ESTADOS_SOLICITUD.map(e => (
                <option key={e.value} value={e.value}>{e.icon} {e.label}</option>
              ))}
            </select>
            <textarea value={nota} onChange={e => setNota(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nota opcional..." rows={2} />
            <button onClick={handleGuardarEstado} disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </div>

        {/* Notas */}
        {solicitud.notas && solicitud.notas.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3">Historial</h3>
            <div className="space-y-2">
              {solicitud.notas.map((n, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900">{n.texto}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{n.autor} · {n.fecha?.toLocaleString?.() || ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
