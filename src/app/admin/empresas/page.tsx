'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  obtenerEmpresas, crearEmpresa, actualizarEmpresa, eliminarEmpresa,
  obtenerUsuariosPorEmpresa, actualizarUsuario,
} from '@/lib/firestore';
import type { Empresa, UsuarioEmpresa } from '@/types';
import { Plus, Loader2, Check, X, Trash2, Building2, Users, Edit3 } from 'lucide-react';
import { addDoc, collection, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function EmpresasPage() {
  const { usuario } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, UsuarioEmpresa[]>>({});
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState<Partial<Empresa>>({});
  const [formAdmin, setFormAdmin] = useState({ email: '', nombre: '' });
  const [guardando, setGuardando] = useState(false);
  const [modalAdmin, setModalAdmin] = useState<string | null>(null);
  const [exito, setExito] = useState('');

  const cargarDatos = async () => {
    try {
      const emps = await obtenerEmpresas();
      setEmpresas(emps);
      const map: Record<string, UsuarioEmpresa[]> = {};
      for (const emp of emps) {
        try {
          map[emp.id] = await obtenerUsuariosPorEmpresa(emp.id);
        } catch { map[emp.id] = []; }
      }
      setUsuariosMap(map);
    } catch (err) {
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const handleGuardarEmpresa = async () => {
    setGuardando(true);
    try {
      if (editando) {
        await actualizarEmpresa(editando, form);
        setEmpresas(empresas.map(e => e.id === editando ? { ...e, ...form } : e));
      } else if (nueva) {
        const id = await crearEmpresa({
          nombre: form.nombre || '',
          nit: form.nit || '',
          color: form.color || '#2563eb',
          colorSecundario: form.colorSecundario || '',
          logo: form.logo || '',
          activa: true,
        });
        setEmpresas([...empresas, { ...form, id, activa: true, fechaCreacion: new Date() } as Empresa]);
      }
      setEditando(null);
      setNueva(false);
      setForm({});
    } finally { setGuardando(false); }
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('Eliminar esta empresa?')) return;
    await eliminarEmpresa(id);
    setEmpresas(empresas.filter(e => e.id !== id));
  };

  const handleCrearAdmin = async () => {
    if (!modalAdmin || !formAdmin.email || !formAdmin.nombre) return;
    setGuardando(true);
    try {
      // Check if user already exists by email
      const q = query(collection(db, 'usuarios'), where('email', '==', formAdmin.email));
      const existing = await getDocs(q);

      if (!existing.empty) {
        // User exists - update their empresas and rol
        const userDoc = existing.docs[0];
        const userData = userDoc.data();
        const empresasActuales = userData.empresas || [];
        if (!empresasActuales.includes(modalAdmin)) {
          empresasActuales.push(modalAdmin);
        }
        await actualizarUsuario(userDoc.id, {
          rol: 'admin',
          empresas: empresasActuales,
        });
        setExito(`Usuario "${formAdmin.nombre}" actualizado como Admin de la empresa`);
      } else {
        // Create new user
        await addDoc(collection(db, 'usuarios'), {
          uid: formAdmin.email,
          email: formAdmin.email,
          nombre: formAdmin.nombre,
          rol: 'admin',
          empresas: [modalAdmin],
          activo: true,
          fechaCreacion: Timestamp.now(),
        });
        setExito(`Admin "${formAdmin.nombre}" creado. Debera iniciar sesion con Google usando ${formAdmin.email}`);
      }

      setModalAdmin(null);
      setFormAdmin({ email: '', nombre: '' });
      setTimeout(() => setExito(''), 5000);

      // Reload data
      await cargarDatos();
    } catch (err: any) {
      console.error('Error creating admin:', err);
    } finally { setGuardando(false); }
  };

  if (cargando) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500">{empresas.length} empresas</p>
        </div>
        <button onClick={() => { setNueva(true); setEditando(null); setForm({ nombre: '', nit: '', color: '#2563eb' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800">
          <Plus className="h-4 w-4" /> Nueva Empresa
        </button>
      </div>

      {exito && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">{exito}</div>
      )}

      {(nueva || editando) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{editando ? 'Editar Empresa' : 'Nueva Empresa'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
              <input value={form.nombre || ''} onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre de la empresa" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">NIT</label>
              <input value={form.nit || ''} onChange={e => setForm({ ...form, nit: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="900123456-7" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Color</label>
              <div className="flex gap-2">
                <input type="color" value={form.color || '#2563eb'}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                <input value={form.color || ''} onChange={e => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleGuardarEmpresa} disabled={guardando || !form.nombre}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {editando ? 'Guardar' : 'Crear'}
              </button>
              <button onClick={() => { setEditando(null); setNueva(false); setForm({}); }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {empresas.map(emp => {
          const empUsers = usuariosMap[emp.id] || [];
          const admins = empUsers.filter(u => u.rol === 'admin' || u.rol === 'super_admin');
          return (
            <div key={emp.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: emp.color || '#2563eb' }}>
                    {emp.logo ? <img src={emp.logo} alt="" className="h-8 w-auto" /> : <Building2 className="h-6 w-6 text-white" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{emp.nombre}</p>
                    <p className="text-xs text-gray-400">NIT: {emp.nit}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditando(emp.id); setNueva(false); setForm(emp); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 className="h-4 w-4" /></button>
                  <button onClick={() => handleEliminar(emp.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {empUsers.length} usuarios</span>
                <span className={`w-2 h-2 rounded-full ${emp.activa ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{emp.activa ? 'Activa' : 'Inactiva'}</span>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] text-gray-400 font-semibold mb-2">ADMINS</p>
                {admins.length > 0 ? (
                  <div className="space-y-1.5">
                    {admins.map(a => (
                      <div key={a.id || a.uid} className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                          {a.nombre?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{a.nombre}</p>
                          <p className="text-[10px] text-gray-500 truncate">{a.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic mb-2">Sin admin</p>
                )}
                <button onClick={() => setModalAdmin(emp.id)}
                  className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                  + Asignar Admin
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalAdmin(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Asignar Admin</h3>
              <p className="text-xs text-gray-500 mt-0.5">Empresa: {empresas.find(e => e.id === modalAdmin)?.nombre}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre completo</label>
                <input value={formAdmin.nombre} onChange={e => setFormAdmin({ ...formAdmin, nombre: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Juan Perez" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email (para login con Google)</label>
                <input type="email" value={formAdmin.email} onChange={e => setFormAdmin({ ...formAdmin, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@empresa.com" />
              </div>
              <p className="text-[11px] text-gray-400">
                Si el usuario ya existe, se actualizara su rol. Si no, se creara.
              </p>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-2">
              <button onClick={handleCrearAdmin} disabled={guardando || !formAdmin.email || !formAdmin.nombre}
                className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50">
                {guardando ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Asignar Admin'}
              </button>
              <button onClick={() => setModalAdmin(null)}
                className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
