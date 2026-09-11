'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingCart, Building2, Loader2 } from 'lucide-react';
import { obtenerEmpresas } from '@/lib/firestore';
import type { Empresa } from '@/types';

export default function SeleccionarEmpresa() {
  const { user, usuario, loading, seleccionarEmpresa } = useAuth();
  const router = useRouter();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionando, setSeleccionando] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function cargarEmpresas() {
      if (!usuario?.empresas?.length) return;
      try {
        const todasEmpresas = await obtenerEmpresas();
        const empresasFiltradas = todasEmpresas.filter((e) =>
          usuario.empresas.includes(e.id)
        );
        setEmpresas(empresasFiltradas);
      } catch (error) {
        console.error('Error al cargar empresas:', error);
      } finally {
        setCargando(false);
      }
    }
    if (usuario) {
      cargarEmpresas();
    }
  }, [usuario]);

  const handleSeleccionar = async (empresaId: string) => {
    setSeleccionando(empresaId);
    try {
      await seleccionarEmpresa(empresaId);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error al seleccionar empresa:', error);
      setSeleccionando(null);
    }
  };

  if (loading || cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Plataforma de Compras</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Selecciona una empresa
          </h1>
          <p className="text-gray-600">
            Tienes acceso a múltiples empresas. ¿Con cuál deseas trabajar?
          </p>
        </div>

        <div className="space-y-4">
          {empresas.map((empresa) => (
            <button
              key={empresa.id}
              onClick={() => handleSeleccionar(empresa.id)}
              disabled={seleccionando !== null}
              className="w-full bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 border-2 border-transparent hover:border-blue-500 text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: empresa.color || '#3b82f6' }}
                >
                  {empresa.nombre.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {empresa.nombre}
                  </h3>
                  <p className="text-sm text-gray-500">NIT: {empresa.nit}</p>
                </div>
                {seleccionando === empresa.id ? (
                  <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                ) : (
                  <Building2 className="h-6 w-6 text-gray-400" />
                )}
              </div>
            </button>
          ))}
        </div>

        {empresas.length === 0 && !cargando && (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              No tienes acceso a ninguna empresa. Contacta al administrador.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
