'use client';

import { useRouter } from 'next/navigation';
import { CheckCircle, ShoppingCart, Home } from 'lucide-react';

export default function SolicitudExitosa() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-sm mx-auto text-center px-4">
        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Solicitud Enviada</h1>
          <p className="text-sm text-gray-500 mb-6">El equipo de abastecimiento la revisara pronto.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => router.push('/solicitud-publica')} className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 text-sm">
              <ShoppingCart className="h-4 w-4" /> Nueva Solicitud
            </button>
            <button onClick={() => router.push('/')} className="inline-flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg text-sm">
              <Home className="h-4 w-4" /> Volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
