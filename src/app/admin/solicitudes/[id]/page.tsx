'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { obtenerSolicitudEnTiempoReal, obtenerProveedores } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import AdminLayout from '@/components/AdminLayout';
import toast from 'react-hot-toast';
import { BotonMandarAPedir } from '@/components/MandarAPedirDialog';
import { ProcesoTimeline } from '@/components/ProcesoTimeline';

export default function SolicitudDetalleAdmin() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [sol, setSol] = useState<Solicitud | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = obtenerSolicitudEnTiempoReal(id, (data) => {
      if (!data) {
        toast.error('Solicitud no encontrada');
        router.replace('/admin/solicitudes');
        return;
      }
      setSol(data);
      setCargando(false);
    });
    return () => unsub();
  }, [id, router]);

  const [proveedoresMap, setProveedoresMap] = useState<Record<string, Record<string, number>>>({});
  useEffect(() => {
    if (!sol?.empresaId) return;
    obtenerProveedores(sol.empresaId).then(provs => {
      const map: Record<string, Record<string, number>> = {};
      provs.forEach((p:any)=>{ if(p.codigo) map[p.codigo]=p.precios||{}; });
      setProveedoresMap(map);
    });
  }, [sol?.empresaId]);

  if (cargando) return <AdminLayout><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin"/></div></AdminLayout>;
  if (!sol) return <AdminLayout><div className="p-6 text-center">No encontrada</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <Link href="/admin/solicitudes" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4"/> Volver a solicitudes
        </Link>
        <div className="bg-white border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">Solicitud #{sol.numero}</h1>
              <p className="text-sm text-gray-500">{sol.nombreUsuario} · {sol.centroTrabajo} · <span className="capitalize">{sol.estado}</span></p>
            </div>
            <BotonMandarAPedir solicitud={sol} proveedoresMap={proveedoresMap} onSuccess={()=> setSol({...sol} as any)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/admin/solicitudes/${sol.id}/cotizar`} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700">Cotizar</Link>
            <Link href={`/admin/solicitudes/${sol.id}/enviar-cotizacion`} className="text-sm border px-4 py-2 rounded-xl hover:bg-gray-50">Enviar cotización</Link>
          </div>
        </div>
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-bold mb-3">Línea de proceso — seguimiento automático</h3>
          <ProcesoTimeline solicitud={sol as any} />
          <p className="text-xs text-gray-500 mt-3">Cada paso responde por correo en el mismo hilo [SOL-#{sol.numero}]. El botón verde <b>Mandar a pedir</b> salta la cotización si ya tienes proveedor.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
