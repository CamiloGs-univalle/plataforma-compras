'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import { obtenerEmpresas } from '@/lib/firestore';
import type { Empresa } from '@/types';

export default function Home() {
  const { user, usuario, loading, signInWithGoogle, seleccionarEmpresa } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [iniciando, setIniciando] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);

  useEffect(() => {
    obtenerEmpresas()
      .then(e => setEmpresas(e.filter(emp => emp.activa)))
      .catch(() => {})
      .finally(() => setCargandoEmpresas(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user && usuario) {
      // Admin, abastecimiento go to admin panel
      if (usuario.rol === 'admin' || usuario.rol === 'abastecimiento') {
        router.push('/admin');
      }
      // Super admin: go to admin (they see all companies)
      else if (usuario.rol === 'super_admin') {
        router.push('/admin');
      }
      // Solicitante: go to nueva-solicitud (they choose company there)
      else if (usuario.rol === 'solicitante') {
        router.push('/nueva-solicitud');
      }
      // Any other user with companies
      else if (usuario.empresas && usuario.empresas.length > 0) {
        router.push('/nueva-solicitud');
      }
    }
  }, [user, usuario, loading, router]);

  const handleLogin = async () => {
    setError('');
    setIniciando(true);
    try { await signInWithGoogle(); } catch (err: any) { setError(err.message || 'Error'); } finally { setIniciando(false); }
  };

  const handleSeleccionarEmpresa = async (empId: string) => {
    await seleccionarEmpresa(empId);
    router.push('/nueva-solicitud');
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Redirecting admin users
  if (user && usuario && (usuario.rol === 'admin' || usuario.rol === 'abastecimiento')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Super admin with companies - redirecting
  if (user && usuario && usuario.rol === 'super_admin' && usuario.empresas && usuario.empresas.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Logged in user without companies - show company selector
  if (user && usuario && (!usuario.empresas || usuario.empresas.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-semibold text-gray-900">Compras</span>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Hola {usuario.nombre}</h1>
            <p className="text-gray-500 mb-8">Selecciona la empresa para la cual quieres trabajar</p>

            {cargandoEmpresas ? (
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin mx-auto" />
            ) : empresas.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <p className="text-sm text-gray-500">No hay empresas disponibles. Contacta al administrador.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {empresas.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleSeleccionarEmpresa(emp.id)}
                    className="flex items-center gap-4 bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-gray-400 transition-all text-left group"
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: emp.color || '#2563eb' }}>
                      {emp.logo ? (
                        <img src={emp.logo} alt={emp.nombre} className="h-8 w-auto" />
                      ) : (
                        <Building2 className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 group-hover:text-gray-700">{emp.nombre}</p>
                      <p className="text-xs text-gray-400">NIT: {emp.nit}</p>
                    </div>
                    <div className="text-gray-300 group-hover:text-gray-500">→</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // Not logged in - show login page
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-semibold text-gray-900">Compras</span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Plataforma de Compras</h1>
          <p className="text-gray-500 mb-8">Inicia sesion para crear solicitudes y dar seguimiento a tus pedidos.</p>

          <button onClick={handleLogin} disabled={iniciando}
            className="w-full inline-flex items-center justify-center gap-3 bg-gray-900 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm mb-4">
            {iniciando ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
            )}
            Iniciar sesion con Google
          </button>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
        </div>
      </main>
    </div>
  );
}
