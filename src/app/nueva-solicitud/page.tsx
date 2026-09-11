'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Send, Plus, Trash2, ShoppingCart, Upload, X, Building2, Mail, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { obtenerProductos, obtenerAsignaciones, crearSolicitud, obtenerEmpresa, obtenerEmpresas, obtenerProveedores, obtenerUsuariosPorEmpresa } from '@/lib/firestore';
import { enviarCorreoNuevaSolicitud } from '@/lib/email';
import AdminLayout from '@/components/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import type { Producto, Asignacion, Empresa } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FilaProducto {
  _key: number;
  codigoProducto: string;
  descripcion: string;
  cantidad: number;
  precioCotizado: string;
  proveedorCotizado: string;
  archivoCotizacion: string;
  archivoCotizacionNombre: string;
  busquedaProducto: string;
  mostrarSugerencias: boolean;
}

let nextKey = 2;

export default function NuevaSolicitud() {
  const { user, usuario, loading, seleccionarEmpresa } = useAuth();
  const { empresa: empresaActual } = useCompany();
  const router = useRouter();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string>('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedoresMap, setProveedoresMap] = useState<Record<string, Record<string, number>>>({});
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [centroTrabajo, setCentroTrabajo] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [fechaRequerida, setFechaRequerida] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [archivos, setArchivos] = useState<{ id:string; nombre:string; descripcion:string; base64:string; tipo:string; tamano:number }[]>([]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ to:string; cc:string; subject:string; body:string } | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);
  const [filas, setFilas] = useState<FilaProducto[]>([
    { _key: 1, codigoProducto: '', descripcion: '', cantidad: 1, precioCotizado: '', proveedorCotizado: '', archivoCotizacion: '', archivoCotizacionNombre: '', busquedaProducto: '', mostrarSugerencias: false },
  ]);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // Load available companies
  useEffect(() => {
    obtenerEmpresas()
      .then(e => setEmpresas(e.filter(emp => emp.activa)))
      .catch(() => {})
      .finally(() => setCargandoEmpresas(false));
  }, []);

  // If user already has a company, use it
  useEffect(() => {
    if (usuario?.empresaActual && !empresaSeleccionada) {
      setEmpresaSeleccionada(usuario.empresaActual);
    }
  }, [usuario]);

  // Load products when company is selected
  useEffect(() => {
    if (!empresaSeleccionada || !user) {
      setProductos([]);
      setAsignaciones([]);
      return;
    }

    setCargandoDatos(true);
    Promise.all([
      obtenerProductos(empresaSeleccionada),
      obtenerAsignaciones(empresaSeleccionada, user.uid),
      obtenerProveedores(empresaSeleccionada),
    ])
      .then(([prods, asigs, provs]) => {
        setProductos(prods);
        setAsignaciones(asigs);
        const map: Record<string, Record<string, number>> = {};
        provs.forEach((p:any)=>{ if(p.codigo) map[p.codigo]=p.precios||{}; });
        setProveedoresMap(map);
        if (asigs.length > 0) {
          const primerCentro = [...new Set(asigs.map(a => a.centroTrabajo))][0];
          if (primerCentro) setCentroTrabajo(primerCentro);
        }
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setCargandoDatos(false));
  }, [empresaSeleccionada, user]);

  const handleCambiarEmpresa = async (empId: string) => {
    setEmpresaSeleccionada(empId);
    setCentroTrabajo('');
    setFilas([{ _key: 1, codigoProducto: '', descripcion: '', cantidad: 1, precioCotizado: '', proveedorCotizado: '', archivoCotizacion: '', archivoCotizacionNombre: '', busquedaProducto: '', mostrarSugerencias: false }]);
    if (user) {
      await seleccionarEmpresa(empId);
    }
  };

  const centrosTrabajo = [...new Set(asignaciones.map(a => a.centroTrabajo))];

  const agregarFila = () => {
    setFilas([...filas, { _key: nextKey++, codigoProducto: '', descripcion: '', cantidad: 1, precioCotizado: '', proveedorCotizado: '', archivoCotizacion: '', archivoCotizacionNombre: '', busquedaProducto: '', mostrarSugerencias: false }]);
  };

  const quitarFila = (key: number) => {
    if (filas.length > 1) setFilas(filas.filter(f => f._key !== key));
  };

  const actualizarFila = (key: number, field: keyof FilaProducto, value: any) => {
    setFilas(filas.map(f => {
      if (f._key !== key) return f;
      const updated = { ...f, [field]: value };
      if (field === 'busquedaProducto') {
        updated.mostrarSugerencias = value.length > 0;
      }
      if (field === 'codigoProducto') {
        const p = productos.find(x => x.codigo === value);
        updated.descripcion = p ? p.descripcion : '';
        updated.busquedaProducto = p ? `${p.codigo} - ${p.descripcion}` : '';
        updated.mostrarSugerencias = false;
      }
      return updated;
    }));
  };

  const seleccionarProducto = (key: number, producto: Producto) => {
    const precios = proveedoresMap[producto.codigo];
    let mejorProv = ''; let mejorPrecio = '';
    if (precios && Object.keys(precios).length){
      const sorted = Object.entries(precios).sort((a,b)=>a[1]-b[1]);
      mejorProv = sorted[0][0]; mejorPrecio = String(sorted[0][1]);
    }
    setFilas(filas.map(f => {
      if (f._key !== key) return f;
      return {
        ...f,
        codigoProducto: producto.codigo,
        descripcion: producto.descripcion,
        busquedaProducto: `${producto.codigo} - ${producto.descripcion}`,
        mostrarSugerencias: false,
        precioCotizado: mejorPrecio || f.precioCotizado,
        proveedorCotizado: mejorProv || f.proveedorCotizado,
      };
    }));
    // autogestiona: agrega nueva fila vacía si es la última
    setTimeout(()=>{
      const last = filas[filas.length-1];
      if(last && last._key===key){
        const nueva = filas.find(ff=>ff._key===key);
        if(nueva && nueva.codigoProducto) agregarFila();
      }
    },100);
  };

  const productosFiltrados = (busqueda: string) => {
    if (!busqueda || busqueda.length < 1) return [];
    const term = busqueda.toLowerCase();
    return productos.filter(p =>
      p.codigo?.toLowerCase().includes(term) ||
      p.descripcion?.toLowerCase().includes(term) ||
      p.nombreCuentaMayor?.toLowerCase().includes(term)
    ).slice(0, 10);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSeleccionada) { toast.error('Selecciona una empresa'); return; }
    if (!user || !usuario) { toast.error('Error de sesion'); return; }

    const filasValidas = filas.filter(f => (f.codigoProducto || f.descripcion) && f.cantidad > 0);
    if (filasValidas.length === 0) { toast.error('Agrega al menos un producto'); return; }

    // Preparar datos y mostrar ventana de confirmación con correo (igual que Gestión Humana)
    const asignacionesFiltradas = asignaciones.filter(a => !centroTrabajo || a.centroTrabajo === centroTrabajo);
    const primAsig = asignacionesFiltradas[0] || {} as any;

    // Buscar email del analista (admin/abastecimiento) para CC
    let analistaEmail = '';
    try {
      const usuarios = await obtenerUsuariosPorEmpresa(empresaSeleccionada);
      const analista = usuarios.find(u => ['admin','abastecimiento'].includes(u.rol)) as any;
      analistaEmail = analista?.email || '';
    } catch {}
    if (!analistaEmail) analistaEmail = 'compras@siamo.com';

    const empresaInfo = empresas.find(e=> e.id===empresaSeleccionada);
    const subject = `[SOLICITUD #PROV-${Date.now().toString().slice(-6)}] ${filasValidas[0]?.descripcion?.slice(0,40) || 'Compra'} — ${centroTrabajo} — ${prioridad.toUpperCase()} — ${usuario.nombre}`;
    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#1e293b">
        <div style="background:#0f172a;color:#fff;padding:16px;border-radius:10px 10px 0 0">
          <h2 style="margin:0;font-size:18px">📋 Nueva Solicitud de Compra — ${centroTrabajo}</h2>
          <p style="margin:4px 0 0;opacity:.8;font-size:12px">${empresaInfo?.nombre || ''} • Prioridad ${prioridad.toUpperCase()} • Requiere: ${fechaRequerida || 'No definida'}</p>
        </div>
        <div style="background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-top:0">
          <div style="background:#fff;padding:12px;border-radius:8px;margin-bottom:12px">
            <p style="margin:0 0 6px;font-size:12px;letter-spacing:.06em;color:#64748b;font-weight:700">SOLICITANTE</p>
            <p style="margin:0;font-size:13px"><b>${usuario.nombre}</b> — ${usuario.email} — Centro <b>${centroTrabajo}</b></p>
            <p style="margin:4px 0 0;font-size:12px;color:#475569">Observaciones: ${observaciones || '—'}</p>
          </div>
          <div style="background:#fff;padding:12px;border-radius:8px">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:.06em;color:#64748b;font-weight:700">DETALLE (${filasValidas.length} items)</p>
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <tr style="background:#f1f5f9"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0">Código</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0">Descripción</th><th style="padding:8px;text-align:center;border:1px solid #e2e8f0">Cant</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0">Cuenta/Proyecto</th></tr>
              ${filasValidas.map(f=> {
                const p = productos.find(x=> x.codigo===f.codigoProducto);
                return `<tr><td style="padding:8px;border:1px solid #eee;font-family:monospace">${f.codigoProducto}</td><td style="padding:8px;border:1px solid #eee">${f.descripcion}</td><td style="padding:8px;border:1px solid #eee;text-align:center">${f.cantidad}</td><td style="padding:8px;border:1px solid #eee;font-size:11px;color:#475569">${p?.cuentaMayor || ''} • ${p?.nombreCuentaMayor || (primAsig as any)?.proyecto || ''}</td></tr>`;
              }).join('')}
            </table>
          </div>
          ${archivos.length? `<div style="background:#fff;padding:12px;border-radius:8px;margin-top:12px"><p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#64748b">📎 ARCHIVOS ADJUNTOS (${archivos.length})</p>${archivos.map(a=> `<div style="padding:6px 0;border-bottom:1px solid #f1f5f9"><b style="font-size:12px">${a.nombre}</b> <span style="font-size:11px;color:#64748b">(${(a.tamano/1024).toFixed(0)} KB)</span><br><span style="font-size:11px;color:#334155">${a.descripcion || 'Sin descripción'}</span></div>`).join('')}</div>`:''}
          <p style="margin:12px 0 0;font-size:11px;color:#64748b">Este correo queda en el <b>mismo hilo [SOL-#]</b> para todo el seguimiento. Responder aquí mantiene la trazabilidad. Se copia a analista: ${analistaEmail}</p>
        </div>
        <div style="background:#f1f5f9;padding:10px;text-align:center;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px"><p style="margin:0;color:#94a3b8;font-size:11px">Plataforma de Compras • Ver en: ${typeof window !== 'undefined' ? window.location.origin : ''}/admin/solicitudes</p></div>
      </div>
    `;

    setPendingData({ filasValidas, primAsig, analistaEmail, empresaInfo });
    setEmailPreview({ to: usuario.email, cc: analistaEmail, subject, body: bodyHtml });
    setShowEmailPreview(true);
  };

  const handleConfirmEnvio = async () => {
    if (!pendingData) return;
    const { filasValidas, primAsig } = pendingData;
    setEnviando(true);
    try {
      const archivosPayload = archivos.map(a=>({ id:a.id, nombre:a.nombre, descripcion:a.descripcion, base64:a.base64, tipo:a.tipo, tamano:a.tamano, fecha:new Date(), autor: usuario!.nombre }));
      const solicitudResult = await crearSolicitud({
        empresaId: empresaSeleccionada,
        usuario: user!.uid,
        nombreUsuario: usuario!.nombre,
        emailUsuario: usuario!.email,
        centroTrabajo: centroTrabajo || '',
        prioridad: prioridad as any,
        fechaRequerida: fechaRequerida || '',
        observaciones: observaciones || '',
        archivos: archivosPayload as any,
        items: filasValidas.map((fila:any) => {
          const producto = productos.find(p => p.codigo === fila.codigoProducto);
          return {
            codigoProducto: fila.codigoProducto,
            descripcion: fila.descripcion,
            cantidad: fila.cantidad,
            cliente: primAsig.cliente || '',
            contrato: primAsig.contrato || '',
            unidadNegocio: primAsig.unidadNegocio || '',
            sucursal: primAsig.sucursal || '',
            ciudad: '',
            proyecto: primAsig.proyecto || '',
            cuentaMayor: producto?.cuentaMayor || '',
            nombreCuentaMayor: producto?.nombreCuentaMayor || '',
            precioUnitario: producto?.precioUnitario || 0,
            indicadorImpuestos: producto?.indicadorImpuestos || '',
            cotizaciones: [],
            estadoItem: 'pendiente',
          };
        }),
        estado: 'pendiente',
      });

      // 1) Log en Sheet (sin enviar correo automático) — solo registro
      try {
        await fetch(emailPreview ? 'https://script.google.com/macros/s/AKfycbyMS9s2ImwWYctd7vhfA5lBpuiPx5XMIYk0wrASkEyAWtMwREOGbGB4MuABfTJC7sMM-Q/exec' : '', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'nueva_solicitud_compra',
            solicitud: { numero: solicitudResult.numero, nombreUsuario: usuario!.nombre, emailUsuario: usuario!.email, centroTrabajo, prioridad, fechaRequerida, observaciones, items: filasValidas, archivos: archivosPayload },
            empresa: { nombre: pendingData.empresaInfo?.nombre },
            analistaEmail: pendingData.analistaEmail,
            soloLog: true,
          }),
          mode: 'no-cors',
        } as any);
      } catch {}

      // 2) Abrir GMAIL REAL como VENTANA EMERGENTE centrada (no pestaña) — correo mejorado
      const to = pendingData.analistaEmail || 'camilo13369@gmail.com';
      const cc = usuario!.email;
      const subject = `[SOL-#${solicitudResult.numero}] Nueva Solicitud — ${centroTrabajo} — ${prioridad.toUpperCase()} — ${usuario!.nombre}`;
      const bodyText = `Hola equipo de Compras,

Se ha creado una nueva solicitud de compra que requiere su gestión:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLICITUD #${solicitudResult.numero} — ${pendingData.empresaInfo?.nombre || ''} — ${centroTrabajo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Solicitante: ${usuario!.nombre} (${usuario!.email})
Centro de trabajo: ${centroTrabajo}
Prioridad: ${prioridad.toUpperCase()} | Fecha requerida: ${fechaRequerida || 'No definida'}
Observaciones: ${observaciones || '—'}

DETALLE DE PRODUCTOS (${filasValidas.length}):
${filasValidas.map((f:any,i:number)=> `${i+1}. ${f.codigoProducto} — ${f.descripcion} | Cant: ${f.cantidad} | Cuenta: ${productos.find(p=>p.codigo===f.codigoProducto)?.cuentaMayor || '—'} — ${productos.find(p=>p.codigo===f.codigoProducto)?.nombreCuentaMayor || pendingData.primAsig?.proyecto || ''}`).join('\n')}

${archivos.length ? `ARCHIVOS ADJUNTOS (${archivos.length}):\n${archivos.map(a=> `• ${a.nombre} — ${a.descripcion || 'sin descripción'} (${(a.tamano/1024).toFixed(0)} KB)`).join('\n')}\n` : ''}Ver y gestionar en plataforma: ${window.location.origin}/admin/solicitudes/${solicitudResult.id}

Este correo inicia el hilo [SOL-#${solicitudResult.numero}]. Todas las actualizaciones (cotización, aprobación, OC, entrega) responderán aquí mismo para trazabilidad completa.
`;
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      const w = 780, h = 620;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      const popup = window.open(gmailUrl, 'gmailCompose', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no`);
      if (!popup) window.open(gmailUrl, '_blank'); // fallback si bloquea popups

      setShowEmailPreview(false);
      toast.success(`Solicitud #${solicitudResult.numero} creada — ventana de Gmail abierta`);
      // Cuando cierre la ventana de Gmail (enviar o cancelar), se quita sola; detectamos cierre para redirigir
      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            router.push('/dashboard');
          }
        }, 800);
        // por si no cierra en 2 min, igual redirige
        setTimeout(() => { clearInterval(timer); router.push('/dashboard'); }, 120000);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar la solicitud');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return <AdminLayout><div className="flex items-center justify-center py-32"><Loader2 className="h-6 w-6 text-blue-600 animate-spin" /></div></AdminLayout>;
  }

  if (!user || !usuario) return null;

  const empresaInfo = empresas.find(e => e.id === empresaSeleccionada);
  const companyColor = empresaInfo?.color || '#2563eb';

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">

        {/* STEP 1: Select company - ALWAYS shown if no company selected */}
        {!empresaSeleccionada ? (
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: companyColor }}>
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido {usuario.nombre}</h1>
            <p className="text-gray-500 mb-8">Selecciona la empresa para la cual quieres hacer la solicitud</p>

            {cargandoEmpresas ? (
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin mx-auto" />
            ) : (
              <div className="grid gap-3">
                {empresas.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleCambiarEmpresa(emp.id)}
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
        ) : cargandoDatos ? (
          /* Loading data */
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: companyColor }} />
            <p className="text-sm text-gray-500">Cargando productos de {empresaInfo?.nombre}...</p>
          </div>
        ) : (
          /* STEP 2: Fill the form */
          <form onSubmit={handleSubmit}>
            {/* Company header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: companyColor }}>
                {empresaInfo?.logo ? (
                  <img src={empresaInfo.logo} alt="" className="h-6 w-auto" />
                ) : (
                  <ShoppingCart className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">Nueva Solicitud</h1>
                <p className="text-sm text-gray-500">{empresaInfo?.nombre}</p>
              </div>
              <button type="button" onClick={() => handleCambiarEmpresa('')}
                className="text-xs text-gray-400 hover:text-gray-600 underline">
                Cambiar empresa
              </button>
            </div>

            {/* User data - auto */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tus datos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                  <input type="text" value={usuario.nombre} readOnly
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input type="email" value={usuario.email} readOnly
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700" />
                </div>
              </div>
            </div>

            {/* Work details */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Detalles del pedido</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Centro de trabajo</label>
                  <input type="text" value={centroTrabajo} onChange={e => setCentroTrabajo(e.target.value)}
                    placeholder="Ej: PLANTAS MENORES, UNIVALLE..."
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': companyColor } as any} />
                  {centrosTrabajo.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {centrosTrabajo.slice(0, 5).map(ct => (
                        <button key={ct} type="button" onClick={() => setCentroTrabajo(ct)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                            centroTrabajo === ct ? 'text-white' : 'text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}
                          style={centroTrabajo === ct ? { backgroundColor: companyColor, borderColor: companyColor } : {}}>
                          {ct}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Prioridad</label>
                  <select value={prioridad} onChange={e => setPrioridad(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': companyColor } as any}>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Fecha requerida</label>
                  <input type="date" value={fechaRequerida} onChange={e => setFechaRequerida(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': companyColor } as any} />
                </div>
              </div>
            </div>

            {/* Barra rápida */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center text-xs">
              <span className="font-semibold text-blue-800">⚡ Modo rápido:</span>
              <span className="text-blue-700">Escribe y autocompleta · Precio y proveedor se llenan solos · Enter agrega fila</span>
              <button type="button" onClick={()=>{
                const ejemplos = productos.slice(0,3).map((p,i)=>({ _key: nextKey++, codigoProducto:p.codigo, descripcion:p.descripcion, cantidad: i===0?2:1, precioCotizado:'', proveedorCotizado:'', archivoCotizacion:'', archivoCotizacionNombre:'', busquedaProducto: `${p.codigo} - ${p.descripcion}`, mostrarSugerencias:false }));
                if(ejemplos.length) setFilas(ejemplos);
                else toast('Cargue productos primero');
              }} className="ml-auto bg-white border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-colors">✨ Cargar 3 sugeridos</button>
            </div>
            {/* Products */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Productos</h2>
                <div className="flex gap-2">
                <button type="button" onClick={()=>{
                  const t = prompt('Pegar códigos separados por coma (ej: 451173, CEL-001)');
                  if(!t) return;
                  const codigos = t.split(',').map(s=>s.trim()).filter(Boolean);
                  const nuevas = codigos.map(c=>{
                    const p = productos.find(x=>x.codigo===c);
                    return { _key: nextKey++, codigoProducto:c, descripcion:p?.descripcion||c, cantidad:1, precioCotizado:'', proveedorCotizado:'', archivoCotizacion:'', archivoCotizacionNombre:'', busquedaProducto: p? `${p.codigo} - ${p.descripcion}`: c, mostrarSugerencias:false };
                  });
                  setFilas([...filas.filter(f=>f.codigoProducto||f.descripcion), ...nuevas]);
                }} className="text-[11px] border px-2 py-1 rounded-lg bg-white hover:bg-gray-50">📋 Pegar códigos</button>
                <button type="button" onClick={agregarFila}
                  className="inline-flex items-center gap-1 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-colors"
                  style={{ backgroundColor: companyColor }}>
                  <Plus className="h-3 w-3" /> Agregar
                </button>
                </div>
              </div>

              <div className="space-y-4">
                {filas.map((fila) => (
                  <div key={fila._key} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid grid-cols-12 gap-3 items-start mb-3">
                      <div className="col-span-5 relative">
                        <label className="block text-xs text-gray-500 mb-1">Buscar producto *</label>
                        <input type="text" value={fila.busquedaProducto}
                          onChange={e => actualizarFila(fila._key, 'busquedaProducto', e.target.value)}
                          onFocus={() => actualizarFila(fila._key, 'mostrarSugerencias', true)}
                          placeholder="Escribe nombre o codigo..."
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': companyColor } as any} />
                        {fila.mostrarSugerencias && fila.busquedaProducto && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {productosFiltrados(fila.busquedaProducto).length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-400">No se encontraron productos</p>
                            ) : (
                              productosFiltrados(fila.busquedaProducto).map(p => (
                                <button key={p.id} type="button"
                                  onClick={() => seleccionarProducto(fila._key, p)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                  <p className="text-xs font-medium text-gray-900">{p.codigo}</p>
                                  <p className="text-[11px] text-gray-500 truncate">{p.descripcion}</p>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Descripcion</label>
                        <input type="text" value={fila.descripcion} readOnly
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Cantidad *</label>
                        <input type="number" min="1" value={fila.cantidad}
                          onChange={e => actualizarFila(fila._key, 'cantidad', parseInt(e.target.value) || 1)}
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': companyColor } as any} />
                      </div>
                      <div className="col-span-1 flex justify-end pt-6">
                        <button type="button" onClick={() => quitarFila(fila._key)} disabled={filas.length <= 1}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quotation */}
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-3">
                        <label className="block text-xs text-gray-500 mb-1">Precio cotizado</label>
                        <input type="number" min="0" step="100" value={fila.precioCotizado}
                          onChange={e => actualizarFila(fila._key, 'precioCotizado', e.target.value)}
                          placeholder="$ 0"
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': companyColor } as any} />
                      </div>
                      <div className="col-span-4">
                        <label className="block text-xs text-gray-500 mb-1">Proveedor</label>
                        <input type="text" value={fila.proveedorCotizado}
                          onChange={e => actualizarFila(fila._key, 'proveedorCotizado', e.target.value)}
                          placeholder="Nombre del proveedor"
                          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                          style={{ '--tw-ring-color': companyColor } as any} />
                      </div>
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-500 mb-1">Cotizacion (PDF)</label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors">
                            <Upload className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-500 truncate">{fila.archivoCotizacionNombre || 'Subir archivo'}</span>
                            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    actualizarFila(fila._key, 'archivoCotizacion', reader.result as string);
                                    actualizarFila(fila._key, 'archivoCotizacionNombre', file.name);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }} />
                          </label>
                          {fila.archivoCotizacion && (
                            <button type="button" onClick={() => {
                              actualizarFila(fila._key, 'archivoCotizacion', '');
                              actualizarFila(fila._key, 'archivoCotizacionNombre', '');
                            }} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Archivos adjuntos PDF */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">📎 Archivos adjuntos (PDF, imagen) — con descripción</h2>
              <p className="text-xs text-gray-500 mb-3">Adjunte cotizaciones, especificaciones o soportes. Cada archivo lleva su descripción y quedará visible en todo el sistema (Mis Solicitudes, Admin, Seguimiento, Reportes).</p>
              <div className="space-y-3">
                {archivos.map(a=>(
                  <div key={a.id} className="flex gap-3 items-start bg-gray-50 border rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">📄 {a.nombre} <span className="text-xs text-gray-400">({(a.tamano/1024).toFixed(0)} KB)</span></p>
                      <input value={a.descripcion} onChange={e=>setArchivos(prev=>prev.map(x=>x.id===a.id?{...x, descripcion:e.target.value}:x))} placeholder="Descripción: ej. Cotización proveedor X - válida 15 días" className="w-full mt-1 bg-white border border-gray-300 rounded px-2 py-1.5 text-xs" />
                    </div>
                    <button type="button" onClick={()=>setArchivos(prev=>prev.filter(x=>x.id!==a.id))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><X className="h-4 w-4"/></button>
                    <a href={a.base64} download={a.nombre} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded text-xs">Ver</a>
                  </div>
                ))}
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                  <Upload className="h-5 w-5 text-gray-400"/>
                  <span className="text-sm text-gray-600">Agregar PDF / imagen</span>
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    if(f.size> 4*1024*1024){ toast.error('Máx 4MB por archivo'); return; }
                    const r=new FileReader(); r.onload=()=> setArchivos(prev=>[...prev,{ id: String(Date.now())+Math.random().toString(36).slice(2), nombre:f.name, descripcion:'', base64:r.result as string, tipo:f.type, tamano:f.size }]); r.readAsDataURL(f); (e.target as HTMLInputElement).value='';
                  }}/>
                </label>
              </div>
            </div>

            {/* Observations */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Observaciones (opcional)</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': companyColor } as any}
                placeholder="Ej: Urgente, entregar en bodega principal, etc." />
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <button type="submit" disabled={enviando || !centroTrabajo}
                className="inline-flex items-center gap-2 text-white px-8 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 text-sm"
                style={{ backgroundColor: companyColor }}>
                {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Revisar y enviar</>}
              </button>
            </div>
          </form>
        )}

        {/* Ventana emergente de confirmación con correo — igual que Gestión Humana */}
        <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600"/> Confirmar envío por correo</DialogTitle>
              <DialogDescription>Revise lo que se enviará. Se copiará automáticamente al analista de compras.</DialogDescription>
            </DialogHeader>
            {emailPreview && pendingData && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-blue-900">Resumen de solicitud</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-gray-500">Solicitante:</span> <span className="font-medium">{usuario?.nombre}</span></div>
                    <div><span className="text-gray-500">Centro:</span> <span className="font-medium">{centroTrabajo}</span></div>
                    <div><span className="text-gray-500">Prioridad:</span> <span className="font-medium">{prioridad.toUpperCase()}</span></div>
                    <div><span className="text-gray-500">Analista (CC):</span> <span className="font-medium text-blue-700">{emailPreview.cc}</span></div>
                  </div>
                  <div className="mt-3 bg-white rounded-lg p-2.5 border">
                    <p className="text-xs font-semibold text-gray-600">{pendingData.filasValidas.length} productos</p>
                    <ul className="text-xs text-gray-700 mt-1 space-y-0.5">
                      {pendingData.filasValidas.slice(0,4).map((f:any,i:number)=> <li key={i}>• {f.codigoProducto} — {f.descripcion} x{f.cantidad}</li>)}
                      {pendingData.filasValidas.length>4 && <li className="text-gray-400">+{pendingData.filasValidas.length-4} más…</li>}
                    </ul>
                    {archivos.length>0 && <p className="text-xs text-gray-500 mt-2">📎 {archivos.length} archivo(s) con descripción</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0"/>
                  <span>Al confirmar se creará la solicitud y se abrirá <b>Gmail en ventana emergente</b> con el correo al analista ya armado (asunto, tabla de productos y archivos). Usted solo da <b>Enviar</b> en Gmail.</span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={()=> setShowEmailPreview(false)}>Cancelar</Button>
              <Button onClick={handleConfirmEnvio} disabled={enviando} className="bg-blue-600 hover:bg-blue-700">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <><Mail className="h-4 w-4 mr-2"/> Abrir en Gmail</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
