'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Loader2 } from 'lucide-react';

export default function AdminLayoutRoot({ children }: { children: React.ReactNode }) {
  const { user, usuario, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/'); return; }
    if (usuario?.rol === 'solicitante') { router.push('/nueva-solicitud'); return; }
  }, [user, usuario, loading, router]);

  if (loading || !user || !usuario || usuario.rol === 'solicitante') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
