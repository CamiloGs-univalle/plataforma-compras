'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Loader2, Send, Plus, Trash2, ShoppingCart, Upload, X, Building2, Mail, Check, Search, Copy, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { obtenerProductos, obtenerAsignaciones, crearSolicitud, obtenerEmpresa, obtenerEmpresas, obtenerProveedores, obtenerUsuariosPorEmpresa } from '@/lib/firestore';
import { datosSapPorCentroTrabajo, CENTROS_TRABAJO_CONOCIDOS, CLIENTES, CONTRATOS, UNIDADES_NEGOCIO, SUPERVISORES_SIAMO, nombreCliente, nombreContrato, nombreUnidadNegocio } from '@/lib/sap-catalogos';
import { filtrarProductosPorSupervisor } from '@/lib/supervisor-productos';
import { enviarCorreoNuevaSolicitud } from '@/lib/email';
import AdminLayout from '@/components/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import type { Producto, Asignacion, Empresa } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─── Fila de producto: replica tabla-editable de index.html ───
// Cada fila tiene su propio Cliente/Contrato/UnidadNegocio/Proyecto/Sucursal
// filtrados por cedula + centroTrabajo (actualizarFiltrosPorCentro)
// y sus datos contables autocompletados al elegir codigo (aplicarValorCampo)
interface FilaProducto {
  _key: number;
  codigoProducto: string;
  descripcion: string;
  cantidad: number;
  cantidadDetalle: string;
  // SAP por fila (filtrables)
  cliente: string;
  contrato: string;
  unidadNegocio: string;
  proyecto: string;
  sucursal: string;
  ciudad: string;
  // Datos contables autocompletados
  cuentaMayor: string;
  nombreCuentaMayor: string;
  precioUnitario: string;
  indicadorImpuestos: string;
  // Cotizacion directa opcional
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
  const [proveedoresLista, setProveedoresLista] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [esCompraDirecta, setEsCompraDirecta] = useState(false);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [centroTrabajo, setCentroTrabajo] = useState('');
  const [cliente, setCliente] = useState('');
  const [contrato, setContrato] = useState('');
  const [unidadNegocio, setUnidadNegocio] = useState('');
  const [proyecto, setProyecto] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [ciudad, setCiudad] = useState('05001');
  const [prioridad, setPrioridad] = useState('media');
  const [fechaRequerida, setFechaRequerida] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [archivos, setArchivos] = useState<{ id:string; nombre:string; descripcion:string; base64:string; tipo:string; tamano:number }[]>([]);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ to:string; cc:string; subject:string; body:string } | null>(null);
  const [pendingData, setPendingData] = useState<any>(null);
  const [filas, setFilas] = useState<FilaProducto[]>([
    { _key: 1, codigoProducto: '', descripcion: '', cantidad: 1, cantidadDetalle: '', cliente: '', contrato: '', unidadNegocio: '', proyecto: '', sucursal: '', ciudad: '05001', cuentaMayor: '', nombreCuentaMayor: '', precioUnitario: '', indicadorImpuestos: '', precioCotizado: '', proveedorCotizado: '', archivoCotizacion: '', archivoCotizacionNombre: '', busquedaProducto: '', mostrarSugerencias: false },
  ]);

  // Arrastre tipo Excel: copiar valor hacia abajo
  const [arrastre, setArrastre] = useState<{ columna: keyof FilaProducto; filaOrigen: number } | null>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  // Cargar empresas disponibles
  useEffect(() => {
    obtenerEmpresas()
      .then(e => setEmpresas(e.filter(emp => emp.activa)))
      .catch(() => {})
      .finally(() => setCargandoEmpresas(false));
  }, []);

  useEffect(() => {
    if (usuario?.empresaActual && !empresaSeleccionada) {
      setEmpresaSeleccionada(usuario.empresaActual);
    }
  }, [usuario]);

  // Cargar productos + asignaciones + proveedores
  useEffect(() => {
    if (!empresaSeleccionada || !user) {
      setProductos([]);
      setAsignaciones([]);
      return;
    }

    setCargandoDatos(true);
    Promise.all([
      obtenerProductos(empresaSeleccionada),
      obtenerAsignaciones(empresaSeleccionada, [user.uid, user.email, usuario?.email, (usuario as any)?.cedula]),
      obtenerProveedores(empresaSeleccionada),
    ])
      .then(([prods, asigs, provs]) => {
        setProductos(prods);
        setAsignaciones(asigs);
        setProveedoresLista(provs as any[]);
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
    setFilas([{ _key: 1, codigoProducto: '', descripcion: '', cantidad: 1, cantidadDetalle: '', cliente: '', contrato: '', unidadNegocio: '', proyecto: '', sucursal: '', ciudad: '05001', cuentaMayor: '', nombreCuentaMayor: '', precioUnitario: '', indicadorImpuestos: '', precioCotizado: '', proveedorCotizado: '', archivoCotizacion: '', archivoCotizacionNombre: '', busquedaProducto: '', mostrarSugerencias: false }]);
    if (user) {
      await seleccionarEmpresa(empId);
    }
  };

  const centrosTrabajo = asignaciones.length
    ? [...new Set(asignaciones.map(a => a.centroTrabajo))]
    : CENTROS_TRABAJO_CONOCIDOS;

  const productosDisponibles = useMemo(() => {
    const ordenados = [...productos].sort((a,b) => {
      const na = parseInt(a.codigo) || 999999;
      const nb = parseInt(b.codigo) || 999999;
      if (na !== nb) return na - nb;
      return String(a.codigo).localeCompare(String(b.codigo));
    });
    const cedula = (usuario as any)?.cedula || asignaciones[0]?.cedula || '';
    return filtrarProductosPorSupervisor(ordenados, cedula, centroTrabajo);
  }, [productos, asignaciones, centroTrabajo, usuario]);

  // ─── Lógica clave: AsignacionesUsuario filtra Cliente/Contrato/etc por centro ───
  // Replica actualizarFiltrosPorCentro() de index.html - para el solicitante es invisible, se autocompleta
  const { clientesDisponibles, contratosDisponibles, unidadesNegocioDisponibles, proyectosDisponibles, sucursalesDisponibles } = useMemo(() => {
    // Si el usuario no tiene asignaciones, usa el fallback del catalogo SAP por centro (no todos)
    if (asignaciones.length === 0) {
      const fb = datosSapPorCentroTrabajo(centroTrabajo);
      if (fb) {
        return {
          clientesDisponibles: fb.cliente ? [fb.cliente] : [],
          contratosDisponibles: fb.contrato ? [fb.contrato] : [],
          unidadesNegocioDisponibles: fb.unidadNegocio ? [fb.unidadNegocio] : [],
          proyectosDisponibles: fb.proyecto ? [fb.proyecto] : [],
          sucursalesDisponibles: fb.sucursal ? [fb.sucursal] : [],
        };
      }
      return { clientesDisponibles: [], contratosDisponibles: [], unidadesNegocioDisponibles: [], proyectosDisponibles: [], sucursalesDisponibles: [] };
    }
    if (!centroTrabajo) {
      return {
        clientesDisponibles: [] as string[],
        contratosDisponibles: [] as string[],
        unidadesNegocioDisponibles: [] as string[],
        proyectosDisponibles: [] as string[],
        sucursalesDisponibles: [] as string[],
      };
    }
    const coincidencias = asignaciones.filter(a => a.centroTrabajo === centroTrabajo);
    const uniq = (arr: (string|undefined)[]) => [...new Set(arr.filter(Boolean) as string[])];
    return {
      clientesDisponibles: uniq(coincidencias.map(a => a.cliente)),
      contratosDisponibles: uniq(coincidencias.map(a => a.contrato)),
      unidadesNegocioDisponibles: uniq(coincidencias.map(a => a.unidadNegocio)),
      proyectosDisponibles: uniq(coincidencias.map(a => a.proyecto)),
      sucursalesDisponibles: uniq(coincidencias.map(a => a.sucursal)),
    };
  }, [asignaciones, centroTrabajo]);

  // Cuando cambia el centro, limpiar valores que ya no son válidos y autocompletar si solo hay 1 opción
  useEffect(() => {
    if (!centroTrabajo) return;
    setFilas(prev => prev.map(f => {
      let next = { ...f, cantidadDetalle: f.cantidadDetalle || centroTrabajo };
      // Limpiar si el valor actual ya no está entre los disponibles (replica index.html:281-284)
      if (clientesDisponibles.length && next.cliente && !clientesDisponibles.includes(next.cliente)) next.cliente = '';
      if (contratosDisponibles.length && next.contrato && !contratosDisponibles.includes(next.contrato)) next.contrato = '';
      if (unidadesNegocioDisponibles.length && next.unidadNegocio && !unidadesNegocioDisponibles.includes(next.unidadNegocio)) next.unidadNegocio = '';
      if (proyectosDisponibles.length && next.proyecto && !proyectosDisponibles.includes(next.proyecto)) next.proyecto = '';
      if (sucursalesDisponibles.length && next.sucursal && !sucursalesDisponibles.includes(next.sucursal)) next.sucursal = '';
      // Si solo hay 1 opción, autocompletar en filas vacías (replica index.html:286-295)
      if (clientesDisponibles.length === 1 && !next.cliente) next.cliente = clientesDisponibles[0];
      if (contratosDisponibles.length === 1 && !next.contrato) next.contrato = contratosDisponibles[0];
      if (unidadesNegocioDisponibles.length === 1 && !next.unidadNegocio) next.unidadNegocio = unidadesNegocioDisponibles[0];
      if (proyectosDisponibles.length === 1 && !next.proyecto) next.proyecto = proyectosDisponibles[0];
      if (sucursalesDisponibles.length === 1 && !next.sucursal) next.sucursal = sucursalesDisponibles[0];
      return next;
    }));
  }, [centroTrabajo, clientesDisponibles, contratosDisponibles, unidadesNegocioDisponibles, proyectosDisponibles, sucursalesDisponibles]);

  useEffect(() => {
    if (!centroTrabajo) return;
    const m = asignaciones.filter(a => a.centroTrabajo === centroTrabajo)[0] || datosSapPorCentroTrabajo(centroTrabajo) as any;
    if (m) {
      if (!cliente && m.cliente) setCliente(m.cliente);
      if (!contrato && m.contrato) setContrato(m.contrato);
      if (!unidadNegocio && m.unidadNegocio) setUnidadNegocio(m.unidadNegocio);
      if (!proyecto && m.proyecto) setProyecto(m.proyecto);
      if (!sucursal && m.sucursal) setSucursal(m.sucursal);
    }
  }, [centroTrabajo, asignaciones]);

  // Sincronizar cantidadDetalle con centroTrabajo para filas que aún no tengan detalle
  useEffect(() => {
    if (!centroTrabajo) return;
    setFilas(prev => prev.map(f => !f.cantidadDetalle ? { ...f, cantidadDetalle: centroTrabajo } : f));
  }, [centroTrabajo]);

  const agregarFila = useCallback(() => {
    setFilas(prev => [...prev, {
      _key: nextKey++,
      codigoProducto: '',
      descripcion: '',
      cantidad: 1,
      cantidadDetalle: centroTrabajo || '',
      cliente: clientesDisponibles.length === 1 ? clientesDisponibles[0] : '',
      contrato: contratosDisponibles.length === 1 ? contratosDisponibles[0] : '',
      unidadNegocio: unidadesNegocioDisponibles.length === 1 ? unidadesNegocioDisponibles[0] : '',
      proyecto: proyectosDisponibles.length === 1 ? proyectosDisponibles[0] : '',
      sucursal: sucursalesDisponibles.length === 1 ? sucursalesDisponibles[0] : '',
      ciudad: '05001',
      cuentaMayor: '',
      nombreCuentaMayor: '',
      precioUnitario: '',
      indicadorImpuestos: '',
      precioCotizado: '',
      proveedorCotizado: '',
      archivoCotizacion: '',
      archivoCotizacionNombre: '',
      busquedaProducto: '',
      mostrarSugerencias: false
    }]);
  }, [centroTrabajo, clientesDisponibles, contratosDisponibles, unidadesNegocioDisponibles, proyectosDisponibles, sucursalesDisponibles]);

  const quitarFila = (key: number) => {
    if (filas.length > 1) setFilas(prev => prev.filter(f => f._key !== key));
    else {
      // Si es la última, limpiarla en lugar de borrarla
      setFilas(prev => prev.map(f => f._key === key ? { ...f, codigoProducto: '', descripcion: '', cantidad: 1, busquedaProducto: '', mostrarSugerencias: false, cuentaMayor: '', nombreCuentaMayor: '', precioUnitario: '', indicadorImpuestos: '' } : f));
    }
  };

  // ─── aplicarValorCampo: al elegir código se autocompleta todo ───
  const aplicarValorCampo = (key: number, field: keyof FilaProducto, value: any) => {
    setFilas(prev => prev.map(f => {
      if (f._key !== key) return f;
      const updated = { ...f, [field]: value } as FilaProducto;
      if (field === 'busquedaProducto') {
        updated.mostrarSugerencias = value.length > 0;
      }
      if (field === 'codigoProducto') {
        if (value === 'OTRO') {
          updated.descripcion = '';
          updated.cuentaMayor = '';
          updated.nombreCuentaMayor = '';
          updated.precioUnitario = '';
          updated.indicadorImpuestos = '';
          updated.busquedaProducto = 'OTRO - servicio / no listado';
          updated.mostrarSugerencias = false;
        } else {
          const p = productosDisponibles.find(x => x.codigo === value) || productos.find(x => x.codigo === value);
          if (p) {
            updated.descripcion = p.descripcion || '';
            updated.cuentaMayor = (p as any).cuentaMayor || '';
            updated.nombreCuentaMayor = (p as any).nombreCuentaMayor || '';
            updated.precioUnitario = String((p as any).precioUnitario || '');
            updated.indicadorImpuestos = (p as any).indicadorImpuestos || '';
            updated.busquedaProducto = `${p.codigo} - ${p.descripcion}`;
          } else {
            updated.descripcion = '';
            updated.cuentaMayor = '';
            updated.nombreCuentaMayor = '';
            updated.precioUnitario = '';
            updated.indicadorImpuestos = '';
            updated.busquedaProducto = value;
          }
          updated.mostrarSugerencias = false;
        }
      }
      return updated;
    }));
  };

  const actualizarFila = aplicarValorCampo;

  // Copiar valor hacia abajo (handle de arrastre)
  const copiarAbajo = (keyOrigen: number, columna: keyof FilaProducto) => {
    const idxOrigen = filas.findIndex(f => f._key === keyOrigen);
    if (idxOrigen === -1) return;
    const valorOrigen = (filas[idxOrigen] as any)[columna];
    setFilas(prev => prev.map((f, idx) => {
      if (idx <= idxOrigen) return f;
      // Para codigoProducto usar aplicarValorCampo para arrastrar también descripcion/cuenta
      if (columna === 'codigoProducto') {
        if (valorOrigen === 'OTRO') {
          return { ...f, codigoProducto: 'OTRO', descripcion: '', cuentaMayor: '', nombreCuentaMayor: '', precioUnitario: '', indicadorImpuestos: '', busquedaProducto: 'OTRO - servicio / no listado' };
        }
        const p = productosDisponibles.find(x => x.codigo === valorOrigen) || productos.find(x => x.codigo === valorOrigen);
        return { ...f, codigoProducto: valorOrigen || '', descripcion: p?.descripcion || '', cuentaMayor: (p as any)?.cuentaMayor || '', nombreCuentaMayor: (p as any)?.nombreCuentaMayor || '', precioUnitario: String((p as any)?.precioUnitario || ''), indicadorImpuestos: (p as any)?.indicadorImpuestos || '', busquedaProducto: p ? `${p.codigo} - ${p.descripcion}` : (valorOrigen || '') };
      }
      return { ...f, [columna]: valorOrigen } as FilaProducto;
    }));
    toast.success(`Copiado "${String(valorOrigen).slice(0,20) || '-'}" hacia abajo`);
  };

  const seleccionarProducto = (key: number, producto: Producto) => {
    const precios = proveedoresMap[producto.codigo];
    let mejorProv = ''; let mejorPrecio = '';
    if (precios && Object.keys(precios).length){
      const sorted = Object.entries(precios).sort((a,b)=>a[1]-b[1]);
      mejorProv = sorted[0][0]; mejorPrecio = String(sorted[0][1]);
    }
    setFilas(prev => prev.map(f => {
      if (f._key !== key) return f;
      return {
        ...f,
        codigoProducto: producto.codigo,
        descripcion: producto.descripcion,
        busquedaProducto: `${producto.codigo} - ${producto.descripcion}`,
        mostrarSugerencias: false,
        cuentaMayor: (producto as any).cuentaMayor || f.cuentaMayor,
        nombreCuentaMayor: (producto as any).nombreCuentaMayor || f.nombreCuentaMayor,
        precioUnitario: String((producto as any).precioUnitario || f.precioUnitario),
        indicadorImpuestos: (producto as any).indicadorImpuestos || f.indicadorImpuestos,
        precioCotizado: mejorPrecio || f.precioCotizado,
        proveedorCotizado: mejorProv || f.proveedorCotizado,
      };
    }));
  };

  const productosFiltrados = (busqueda: string) => {
    if (!busqueda || busqueda.length < 1) return [];
    const term = busqueda.toLowerCase();
    const base = productosDisponibles.filter(p =>
      p.codigo?.toLowerCase().includes(term) ||
      p.descripcion?.toLowerCase().includes(term) ||
      (p as any).nombreCuentaMayor?.toLowerCase().includes(term)
    ).slice(0, 10);
    // Incluir OTRO si coincide
    if ('otro'.includes(term) || 'servicio'.includes(term) || term.length < 3) {
      // no forzar, solo si no hay resultados
      if (base.length === 0) return [] as any;
    }
    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaSeleccionada) { toast.error('Selecciona una empresa'); return; }
    if (!user || !usuario) { toast.error('Error de sesion'); return; }

    let filasValidas: any[] = filas.filter(f => (f.codigoProducto || f.descripcion) && f.cantidad > 0);
    if (filasValidas.length === 0) { toast.error('Agrega al menos un producto'); return; }
    if (!centroTrabajo) { toast.error('Selecciona centro de trabajo'); return; }
    const asignacionesFiltradas = asignaciones.filter(a => !centroTrabajo || a.centroTrabajo === centroTrabajo);
    const primAsig = asignacionesFiltradas[0] || datosSapPorCentroTrabajo(centroTrabajo) || {} as any;
    // Autocompletar SAP por fila desde el centro (usuario no ve estos campos, se llenan solos)
    filasValidas = filasValidas.map((f:any) => ({
      ...f,
      cliente: f.cliente || cliente || primAsig.cliente || '',
      contrato: f.contrato || contrato || primAsig.contrato || '',
      unidadNegocio: f.unidadNegocio || unidadNegocio || primAsig.unidadNegocio || '',
      proyecto: f.proyecto || proyecto || primAsig.proyecto || '',
      sucursal: f.sucursal || sucursal || primAsig.sucursal || '',
      ciudad: f.ciudad || ciudad || '05001',
    }));

    let analistaEmail = '';
    try {
      const usuarios = await obtenerUsuariosPorEmpresa(empresaSeleccionada);
      const analista = usuarios.find(u => ['admin','abastecimiento'].includes(u.rol)) as any;
      analistaEmail = analista?.email || '';
    } catch {}
    if (!analistaEmail) analistaEmail = 'compras@siamo.com';

    const empresaInfo = empresas.find(e=> e.id===empresaSeleccionada);
    const subject = `[SOLICITUD #PROV-${Date.now().toString().slice(-6)}] ${filasValidas[0]?.descripcion?.slice(0,40) || 'Compra'} - ${centroTrabajo} - ${prioridad.toUpperCase()} - ${(usuario as any)?.nombre || ''}`;
    const bodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#1e293b">
        <div style="background:#0f172a;color:#fff;padding:16px;border-radius:10px 10px 0 0">
          <h2 style="margin:0;font-size:18px">Nueva Solicitud - ${centroTrabajo}</h2>
          <p style="margin:4px 0 0;opacity:.8;font-size:12px">${empresaInfo?.nombre || ''} - Prioridad ${prioridad.toUpperCase()}</p>
        </div>
        <div style="background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-top:0">
          <p>Solicitante: ${(usuario as any)?.nombre || ''} - ${(usuario as any)?.email || ''} - Centro ${centroTrabajo}</p>
          <p>Productos: ${filasValidas.length} items</p>
        </div>
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
          const producto = productosDisponibles.find(p => p.codigo === fila.codigoProducto) || productos.find(p => p.codigo === fila.codigoProducto);
          return {
            codigoProducto: fila.codigoProducto,
            descripcion: fila.descripcion,
            cantidad: fila.cantidad,
            cantidadDetalle: fila.cantidadDetalle || centroTrabajo || '',
            cliente: fila.cliente || primAsig.cliente || '',
            contrato: fila.contrato || primAsig.contrato || '',
            unidadNegocio: fila.unidadNegocio || primAsig.unidadNegocio || '',
            sucursal: fila.sucursal || primAsig.sucursal || '',
            ciudad: fila.ciudad || (primAsig as any).ciudad || '05001',
            proyecto: fila.proyecto || primAsig.proyecto || '',
            cuentaMayor: fila.cuentaMayor || producto?.cuentaMayor || '',
            nombreCuentaMayor: fila.nombreCuentaMayor || producto?.nombreCuentaMayor || '',
            precioUnitario: Number(fila.precioUnitario) || Number(producto?.precioUnitario) || 0,
            indicadorImpuestos: fila.indicadorImpuestos || producto?.indicadorImpuestos || 'IVAD05',
            cotizaciones: [],
            estadoItem: 'pendiente',
          };
        }),
        estado: 'pendiente',
      } as any);

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
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'nueva_solicitud',
            solicitud: {
              numero: solicitudResult.numero,
              id: solicitudResult.id,
              nombreUsuario: usuario!.nombre,
              emailUsuario: usuario!.email,
              centroTrabajo,
              prioridad,
              fechaRequerida,
              observaciones,
              items: filasValidas.map((f:any)=> {
                const pr = productosDisponibles.find(x=>x.codigo===f.codigoProducto) || productos.find(x=>x.codigo===f.codigoProducto);
                return { ...f, cuentaMayor: f.cuentaMayor || pr?.cuentaMayor || '', nombreCuentaMayor: f.nombreCuentaMayor || pr?.nombreCuentaMayor || '' };
              }),
              archivos: archivosPayload,
            },
            empresa: pendingData.empresaInfo,
            emailDestino: pendingData.analistaEmail,
            html: (pendingData as any).bodyHtml || '',
            text: (pendingData as any).bodyText || '',
          }),
        });
      } catch {}

      const to = pendingData.analistaEmail || 'camilo13369@gmail.com';
      const cc = (usuario as any)?.email || '';
      const subject = `[SOL-#${solicitudResult.numero}] Nueva Solicitud - ${centroTrabajo} - ${prioridad.toUpperCase()} - ${ (usuario as any)?.nombre || ''}`;
      const totalCant = filasValidas.reduce((a:any,f:any)=> a + (Number(f.cantidad)||0), 0);
      const bodyText2 = `[SOL-#${solicitudResult.numero}] Nueva Solicitud - ${centroTrabajo} - ${prioridad.toUpperCase()} - ${ (usuario as any)?.nombre || ''}

Hola equipo de Compras,

Se ha creado una nueva solicitud que requiere gestion:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLICITUD #${solicitudResult.numero} - ${pendingData.empresaInfo?.nombre || ''} - ${centroTrabajo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Solicitante: ${(usuario as any)?.nombre || ''} (${(usuario as any)?.email || ''})
Centro: ${centroTrabajo} | Cliente: ${filasValidas[0]?.cliente || primAsig.cliente || '-'} | Contrato: ${filasValidas[0]?.contrato || primAsig.contrato || '-'}
Prioridad: ${prioridad.toUpperCase()} | Fecha: ${fechaRequerida || 'No definida'}
Observaciones: ${observaciones || '-'}

DETALLE (${filasValidas.length} productos, ${totalCant} unidades):
${filasValidas.map((f:any,i:any)=> (i+1) + '. ' + f.codigoProducto + ' - ' + f.descripcion + ' Cant:' + f.cantidad + ' Cliente:' + (f.cliente||'-') + ' Contrato:' + (f.contrato||'-')).join('\n')}

${archivos.length ? 'ARCHIVOS (' + archivos.length + '):\n' + archivos.map(a=> '- ' + a.nombre + ' (' + (a.tamano/1024).toFixed(0) + ' KB)').join('\n') + '\n' : ''}Ver y gestionar: ${typeof window !== 'undefined' ? window.location.origin : ''}/admin/solicitudes/${solicitudResult.id}

Botones:
- Ver solicitud: ${typeof window !== 'undefined' ? window.location.origin : ''}/admin/solicitudes
- Aprobar / Rechazar / Generar Pedido (desde la plataforma)

Este correo abre el hilo [SOL-#${solicitudResult.numero}] - responda aqui para trazabilidad.
`;

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText2)}`;
      const w = 780, h = 620;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      const popup = window.open(gmailUrl, 'gmailCompose', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no`);
      if (!popup) window.open(gmailUrl, '_blank');

      setShowEmailPreview(false);
      toast.success(`Solicitud #${solicitudResult.numero} creada - ventana de Gmail abierta`);
      if (popup) {
        const timer = setInterval(() => {
          if (popup.closed) {
            clearInterval(timer);
            router.push('/dashboard');
          }
        }, 800);
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
      <div className="max-w-[1400px] mx-auto">

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
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: companyColor }} />
            <p className="text-sm text-gray-500">Cargando productos de {empresaInfo?.nombre}...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header compacto */}
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: companyColor }}>
                {empresaInfo?.logo ? <img src={empresaInfo.logo} alt="" className="h-6 w-auto" /> : <ShoppingCart className="h-5 w-5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{empresaInfo?.nombre}</p>
                <p className="text-xs text-gray-500 truncate">{usuario.nombre} - {usuario.email}</p>
              </div>
              <button type="button" onClick={() => handleCambiarEmpresa('')} className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0">Cambiar</button>
            </div>

            {/* Centro + Prioridad + Fecha - una sola fila compacta */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Centro de trabajo *</label>
                  <div className="flex gap-2">
                    <select value={centroTrabajo} onChange={e => setCentroTrabajo(e.target.value)} className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: companyColor }}>
                      <option value="">-- Selecciona --</option>
                      {centrosTrabajo.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                      {/* también incluir conocidos para usuarios sin asignaciones */}
                      {asignaciones.length===0 && CENTROS_TRABAJO_CONOCIDOS.filter(c=> !centrosTrabajo.includes(c)).map(c=> <option key={c} value={c}>{c}</option>)}
                    </select>
                    {centrosTrabajo.length === 1 && <span className="self-center text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">{centrosTrabajo[0]}</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">Al cambiar el centro se filtran Cliente/Contrato/Unidad/Proyecto/Sucursal por fila (AsignacionesUsuario). Arrastra el cuadrito azul para copiar hacia abajo.</p>
                  {centrosTrabajo.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {centrosTrabajo.map(ct => (
                        <button key={ct} type="button" onClick={() => setCentroTrabajo(ct)} className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${centroTrabajo===ct ? 'text-white shadow-sm' : 'bg-white text-gray-600 border-gray-200'}`} style={centroTrabajo===ct ? { backgroundColor: companyColor, borderColor: companyColor } : {}}>{ct}</button>
                      ))}
                    </div>
                  )}
                  {centroTrabajo && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-2 w-fit">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: companyColor }} />
                      <span className="font-medium">{centroTrabajo}</span>
                      <span className="text-gray-400">•</span>
                      <span className="font-mono text-gray-700">{(clientesDisponibles[0] || cliente || 'CL') + (contratosDisponibles[0] ? ' • ' + contratosDisponibles[0].slice(0,8) : '')}</span>
                      <span className="hidden sm:inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-xs font-medium">
                        {productosDisponibles.length} productos
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Prioridad</label>
                    <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm">
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">¿Cuándo lo necesitas?</label>
                    <input type="date" value={fechaRequerida} onChange={e => setFechaRequerida(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* Productos - ultra simple: solo buscar y cantidad */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: companyColor }}><ShoppingCart className="h-3.5 w-3.5" /></span>
                  ¿Que necesitas?
                </h2>
                <span className="text-xs bg-gray-50 border px-2.5 py-1 rounded-full text-gray-600">
                  {filas.filter(f=>f.codigoProducto).length} productos • {filas.filter(f=>f.codigoProducto).reduce((a,f)=>a+Number(f.cantidad||0),0)} unidades
                </span>
              </div>

              {/* Buscador grande - solo uno, no por fila */}
              <div className="relative mb-4">
                <input
                  type="text"
                  id="buscador-global"
                  placeholder="Escribe codigo o nombre para agregar... ej: 451173"
                  onKeyDown={e=> {
                    if (e.key==='Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (!val) return;
                      const hit = productosDisponibles.find(p=> p.codigo.toLowerCase()===val.toLowerCase() || p.descripcion.toLowerCase().includes(val.toLowerCase()));
                      if (hit) {
                        const vacia = filas.find(f=> !f.codigoProducto);
                        if (vacia) seleccionarProducto(vacia._key, hit);
                        else {
                          const nk = nextKey++;
                          const defaults = (() => {
                            const c = clientesDisponibles[0] || '';
                            const co = contratosDisponibles[0] || '';
                            const u = unidadesNegocioDisponibles[0] || '';
                            const pr = proyectosDisponibles[0] || '';
                            const s = sucursalesDisponibles[0] || '';
                            return { cliente: c, contrato: co, unidadNegocio: u, proyecto: pr, sucursal: s, ciudad: '05001' };
                          })();
                          setFilas([...filas, { _key: nk, codigoProducto: hit.codigo, descripcion: hit.descripcion, cantidad: 1, cantidadDetalle: centroTrabajo||'', cliente: defaults.cliente, contrato: defaults.contrato, unidadNegocio: defaults.unidadNegocio, proyecto: defaults.proyecto, sucursal: defaults.sucursal, ciudad: defaults.ciudad, cuentaMayor: hit.cuentaMayor||'', nombreCuentaMayor: hit.nombreCuentaMayor||'', precioUnitario: String(hit.precioUnitario||''), indicadorImpuestos: hit.indicadorImpuestos||'IVAD05', precioCotizado: '', proveedorCotizado: '', archivoCotizacion: '', archivoCotizacionNombre: '', busquedaProducto: hit.codigo + ' - ' + hit.descripcion, mostrarSugerencias: false }]);
                        }
                        (e.target as HTMLInputElement).value='';
                      } else {
                        toast('No encontrado: ' + val);
                      }
                    }
                  }}
                  className="w-full bg-white border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm font-medium placeholder:text-gray-400 focus:outline-none focus:border-gray-300 focus:ring-4 focus:ring-gray-100"
                />
                <Search className="absolute left-3.5 top-4 h-4 w-4 text-gray-400" />
                <span className="absolute right-3 top-3 hidden md:inline-flex items-center gap-1 text-xs bg-gray-900 text-white px-2 py-1 rounded-full">↵ Enter para agregar</span>
              </div>

              {/* Lista de productos - cards ultra simples, sin amontonar */}
              <div className="space-y-3">
                {filas.filter(f=> f.codigoProducto || filas.length===1).map((fila) => (
                  <div key={fila._key} className="group flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl p-3 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 grid place-items-center shrink-0 font-mono text-xs font-bold text-gray-700">
                      {fila.codigoProducto ? fila.codigoProducto.slice(0,4) : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      {fila.codigoProducto ? (
                        <>
                          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{fila.descripcion || fila.codigoProducto}</p>
                          <p className="text-xs font-mono text-gray-500 truncate">{fila.codigoProducto} {fila.cuentaMayor ? '• ' + fila.cuentaMayor : ''}</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Busca arriba y presiona Enter</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
                        <button type="button" onClick={() => aplicarValorCampo(fila._key, 'cantidad', Math.max(1, Number(fila.cantidad)-1))} className="w-8 h-8 rounded-full hover:bg-gray-100 grid place-items-center text-gray-700 font-bold">−</button>
                        <span className="w-8 text-center text-sm font-extrabold tabular-nums">{fila.cantidad}</span>
                        <button type="button" onClick={() => aplicarValorCampo(fila._key, 'cantidad', Number(fila.cantidad)+1)} className="w-8 h-8 rounded-full hover:bg-gray-100 grid place-items-center text-gray-700 font-bold">+</button>
                      </div>
                      <button type="button" onClick={() => quitarFila(fila._key)} className="w-8 h-8 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 grid place-items-center shrink-0"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {/* Hidden SAP fields - se guardan pero no se muestran */}
                    <input type="hidden" value={fila.cliente} />
                    <input type="hidden" value={fila.contrato} />
                    <input type="hidden" value={fila.unidadNegocio} />
                    <input type="hidden" value={fila.proyecto} />
                    <input type="hidden" value={fila.sucursal} />
                    <input type="hidden" value={fila.ciudad} />
                  </div>
                ))}
              </div>

              <button type="button" onClick={agregarFila} className="w-full mt-3 border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm font-semibold text-gray-600 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" /> Agregar otro producto
              </button>
              <p className="text-xs text-center text-gray-400 mt-2">Productos reordenados • {productosDisponibles.length} disponibles para {centroTrabajo || 'tu centro'}</p>
            </div>
            {/* Observaciones y archivos - compacto */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">¿Algo más? (opcional)</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} placeholder="Ej: Entregar en bodega, urgente..." className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: companyColor }} />
              {archivos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {archivos.map(a=>(
                    <div key={a.id} className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                      <span className="text-xs font-medium truncate flex-1">{a.nombre}</span>
                      <span className="text-xs text-gray-400">{(a.tamano/1024).toFixed(0)}KB</span>
                      <button type="button" onClick={()=>setArchivos(prev=>prev.filter(x=>x.id!==a.id))} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4"/></button>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-3 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-3 cursor-pointer hover:border-gray-300 hover:bg-gray-50">
                <Upload className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-600">{archivos.length ? 'Agregar otro archivo' : 'Adjuntar foto o PDF (opcional)'}</span>
                <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>{
                  const f=e.target.files?.[0]; if(!f) return;
                  if(f.size> 4*1024*1024){ toast.error('Max 4MB'); return; }
                  const r=new FileReader(); r.onload=()=> setArchivos(prev=>[...prev,{ id: String(Date.now())+Math.random().toString(36).slice(2), nombre:f.name, descripcion:'', base64:r.result as string, tipo:f.type, tamano:f.size }]); r.readAsDataURL(f); (e.target as HTMLInputElement).value='';
                }}/>
              </label>
            </div>

            {/* Sticky bottom bar */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 -mx-4 px-4 py-3 flex items-center justify-between gap-3 md:rounded-xl md:border md:mx-0 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
              <div className="text-xs text-gray-500">
                <span className="font-medium text-gray-900">{filas.filter(f=>f.codigoProducto).length} productos</span>
                <span className="hidden md:inline"> - {centroTrabajo || 'Elige centro'}</span>
              </div>
              <button type="submit" disabled={enviando || !centroTrabajo || filas.filter(f=>f.codigoProducto).length===0} className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-sm disabled:opacity-50" style={{ backgroundColor: companyColor }}>
                {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Enviar pedido</>}
              </button>
            </div>
          </form>
        )}

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
                      {pendingData.filasValidas.slice(0,4).map((f:any,i:number)=> <li key={i}>- {f.codigoProducto} - {f.descripcion} x{f.cantidad} [{f.cliente||'-'}/{f.contrato||'-'}]</li>)}
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
