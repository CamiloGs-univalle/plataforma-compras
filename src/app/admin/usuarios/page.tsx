'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { obtenerUsuariosPorEmpresa, actualizarUsuario } from '@/lib/firestore';
import type { UsuarioEmpresa } from '@/types';
import { ROLES_CONFIG } from '@/types';
import { Button, Card, Input, Badge, ModalWrapper, SkeletonTable, Label } from '@/components/ui';
import { Search, Plus, Check, X, UserCog, Mail } from 'lucide-react';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function UsuariosPage() {
  const { empresa } = useCompany();
  const { usuario } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'solicitante' as string });
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState('');

  const esAdmin = usuario?.rol === 'admin' || usuario?.rol === 'super_admin';

  useEffect(() => {
    if (!empresa?.id) { setCargando(false); return; }
    obtenerUsuariosPorEmpresa(empresa.id).then(u => { setUsuarios(u); setCargando(false); }).catch(() => setCargando(false));
  }, [empresa?.id]);

  const filtrados = usuarios.filter(u =>
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.rol?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleCrear = async () => {
    if (!empresa?.id || !form.email || !form.nombre) return;
    setGuardando(true);
    setExito('');
    try {
      await addDoc(collection(db, 'usuarios'), {
        uid: form.email,
        email: form.email,
        nombre: form.nombre,
        rol: form.rol,
        empresas: [empresa.id],
        activo: true,
        fechaCreacion: Timestamp.now(),
      });
      const updated = await obtenerUsuariosPorEmpresa(empresa.id);
      setUsuarios(updated);
      setNuevo(false);
      setForm({ nombre: '', email: '', rol: 'solicitante' });
      setExito(`Usuario "${form.nombre}" creado. Debera iniciar sesion con Google usando ${form.email}`);
      setTimeout(() => setExito(''), 5000);
    } catch (err: any) {
      console.error(err);
    } finally { setGuardando(false); }
  };

  const handleCambiarRol = async (userId: string, nuevoRol: string) => {
    await actualizarUsuario(userId, { rol: nuevoRol as any });
    setUsuarios(usuarios.map(u => u.id === userId ? { ...u, rol: nuevoRol as any } : u));
  };

  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <SkeletonTable rows={5} columns={3} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-[var(--font-bold)] text-[var(--text-primary)]">Usuarios</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {usuarios.length} usuarios en {empresa?.nombre || 'la empresa'}
          </p>
        </div>
        {esAdmin && (
          <Button onClick={() => setNuevo(true)}>
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Success message */}
      {exito && (
        <div className="bg-[var(--success-50)] border border-[var(--success-200)] rounded-[var(--radius-lg)] px-4 py-3 text-[var(--text-sm)] text-[var(--success-700)]">
          {exito}
        </div>
      )}

      {/* Form nuevo usuario */}
      <ModalWrapper
        open={nuevo}
        onClose={() => { setNuevo(false); setForm({ nombre: '', email: '', rol: 'solicitante' }); }}
        title="Crear Usuario"
        description="El usuario debera iniciar sesion con Google usando el email indicado"
        footer={
          <>
            <Button
              variant="default"
              onClick={handleCrear}
              disabled={guardando || !form.email || !form.nombre}
            >
              {guardando ? 'Creando...' : 'Crear'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setNuevo(false); setForm({ nombre: '', email: '', rol: 'solicitante' }); }}
            >
              Cancelar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Juan Perez"
              className="px-3 py-2"
            />
          </div>
          <div className="space-y-2">
            <Label>Email (para login con Google)</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="usuario@empresa.com"
              className="px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-[var(--font-medium)] text-[var(--text-primary)] mb-1.5">
              Rol
            </label>
            <select
              value={form.rol}
              onChange={e => setForm({ ...form, rol: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-[var(--radius-lg)] bg-[var(--bg-surface)]"
            >
              {Object.entries(ROLES_CONFIG)
                .filter(([k]) => k !== 'super_admin')
                .map(([k, v]) => (
                  <option key={k} value={k}>{v.label} — {v.descripcion}</option>
                ))}
            </select>
          </div>
        </div>
      </ModalWrapper>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)]" />
        <Input
          placeholder="Buscar por nombre, email, rol..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="pl-9 px-3 py-2"
        />
      </div>

      {/* User cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map((u, index) => {
          const role = ROLES_CONFIG[u.rol];
          return (
            <Card key={u.id || `user-${index}`} className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-sm)] font-[var(--font-bold)] text-white shrink-0"
                  style={{ backgroundColor: role?.color || '#6b7280' }}
                >
                  {u.nombre?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--text-sm)] font-[var(--font-semibold)] text-[var(--text-primary)] truncate">
                    {u.nombre}
                  </p>
                  <p className="text-[var(--text-xs)] text-[var(--text-tertiary)] truncate flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {u.email}
                  </p>
                  <div className="mt-2">
                    {esAdmin ? (
                      <select
                        value={u.rol}
                        onChange={e => handleCambiarRol(u.id!, e.target.value)}
                        className="text-[var(--font-size-xs)] font-[var(--font-medium)] px-2 py-1 rounded-[var(--radius-lg)] border border-[var(--border-default)] cursor-pointer"
                        style={{ color: role?.color }}
                      >
                        {Object.entries(ROLES_CONFIG)
                          .filter(([k]) => k !== 'super_admin')
                          .map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                      </select>
                    ) : (
                      <Badge variant="secondary">{role?.label}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <div className="p-8 text-center">
            <p className="text-[var(--text-secondary)] text-sm">No se encontraron usuarios</p>
        </div>
      )}
    </div>
  );
}
