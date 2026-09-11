'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { obtenerEmpresa } from '@/lib/firestore';
import type { Empresa } from '@/types';

interface CompanyContextType {
  empresa: Empresa | null;
  loading: boolean;
  seleccionarEmpresa: (emp: Empresa) => void;
}

const CompanyContext = createContext<CompanyContextType>({
  empresa: null,
  loading: true,
  seleccionarEmpresa: () => {},
});

export function useCompany() {
  return useContext(CompanyContext);
}

const DEFAULT_COLORS: Record<string, { color: string; colorSecundario: string }> = {
  siamo: { color: '#0066CC', colorSecundario: '#004499' },
  proservis: { color: '#00A651', colorSecundario: '#008040' },
  affine: { color: '#FF6B35', colorSecundario: '#E55A2B' },
};

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { usuario, loading: authLoading } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);

  const seleccionarEmpresa = (emp: Empresa) => {
    const defaults = DEFAULT_COLORS[emp.id] || { color: '#2563eb', colorSecundario: '#1d4ed8' };
    setEmpresa({
      ...emp,
      color: emp.color || defaults.color,
      colorSecundario: emp.colorSecundario || defaults.colorSecundario,
    });
    document.documentElement.style.setProperty('--company-color', emp.color || defaults.color);
    document.documentElement.style.setProperty('--company-color-sec', emp.colorSecundario || defaults.colorSecundario);
  };

  useEffect(() => {
    if (authLoading) return;

    async function loadEmpresa() {
      const empId = usuario?.empresaActual;

      // If user has empresaActual, load it
      if (empId) {
        try {
          const emp = await obtenerEmpresa(empId);
          if (emp) {
            seleccionarEmpresa(emp);
          }
        } catch (error) {
          console.error('Error loading empresa:', error);
        }
        setLoading(false);
        return;
      }

      // If no empresaActual but user has empresas, auto-select the first one
      if (usuario?.empresas && usuario.empresas.length > 0) {
        try {
          const emp = await obtenerEmpresa(usuario.empresas[0]);
          if (emp) {
            seleccionarEmpresa(emp);
          }
        } catch (error) {
          console.error('Error loading empresa:', error);
        }
        setLoading(false);
        return;
      }

      // No companies at all
      setEmpresa(null);
      setLoading(false);
    }

    loadEmpresa();
  }, [usuario?.empresaActual, usuario?.empresas, authLoading]);

  return (
    <CompanyContext.Provider value={{ empresa, loading, seleccionarEmpresa }}>
      {children}
    </CompanyContext.Provider>
  );
}
