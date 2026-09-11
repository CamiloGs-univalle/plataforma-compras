'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';
import { obtenerSolicitudEnTiempoReal } from '@/lib/firestore';
import type { Solicitud } from '@/types';
import AdminLayout from '@/components/AdminLayout';
import toast from 'react-hot-toast';

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

  if (cargando) return <AdminLayout><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin"/></div></AdminLayout>;
  if (!sol) return <AdminLayout><div className="p-6 text-center">No encontrada</div></AdminLayout>;

  // reutiliza la vista pública pero dentro de layout admin
  return (
    <AdminLayout>
      <div className="p-4 max-w-4xl mx-auto">
        <Link href="/admin/solicitudes" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4"/> Volver a solicitudes
        </Link>
        <div className="bg-white border rounded-xl p-6">
          <h1 className="text-xl font-bold">Solicitud #{sol.numero}</h1>
          <p className="text-sm text-gray-500">{sol.nombreUsuario} · {sol.centroTrabajo} · {sol.estado}</p>
          <div className="mt-4">
            <Link href={`/admin/solicitudes/${sol.id}/cotizar`} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg">Ir a cotizar</Link>
            <Link href={`/admin/solicitudes/${sol.id}/enviar-cotizacion`} className="text-sm border px-4 py-2 rounded-lg ml-2">Enviar cotización</Link>
          </div>
          <p className="text-xs text-gray-400 mt-4">Si llegó aquí por 404, use los botones superiores. El listado principal es <Link href="/admin/solicitudes" className="underline">/admin/solicitudes</Link>.</p>
        </div>
      </div>
    </AdminLayout>
  );
}
