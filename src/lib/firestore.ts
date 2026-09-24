import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Empresa,
  UsuarioEmpresa,
  Asignacion,
  Producto,
  Solicitud,
  ItemSolicitud,
  Proveedor,
} from '@/types';

// ==================
// EMPRESAS
// ==================

export async function obtenerEmpresas(): Promise<Empresa[]> {
  const snapshot = await getDocs(collection(db, 'empresas'));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    fechaCreacion: doc.data().fechaCreacion?.toDate() || new Date(),
  })) as Empresa[];
}

export async function obtenerEmpresa(empresaId: string): Promise<Empresa | null> {
  const docRef = doc(db, 'empresas', empresaId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    fechaCreacion: docSnap.data().fechaCreacion?.toDate() || new Date(),
  } as Empresa;
}

export async function crearEmpresa(empresa: Omit<Empresa, 'id' | 'fechaCreacion'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'empresas'), {
    ...empresa,
    fechaCreacion: Timestamp.now(),
  });
  return docRef.id;
}

// ==================
// ACTUALIZAR EMPRESA
// ==================

export async function actualizarEmpresa(
  empresaId: string,
  datos: Partial<Empresa>
): Promise<void> {
  const docRef = doc(db, 'empresas', empresaId);
  await updateDoc(docRef, datos);
}

export async function eliminarEmpresa(empresaId: string): Promise<void> {
  await deleteDoc(doc(db, 'empresas', empresaId));
}

// ==================
// USUARIOS - CRUD COMPLETO
// ==================

export async function eliminarUsuario(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'usuarios', uid));
}

export async function asignarUsuarioAEmpresa(
  uid: string,
  empresaId: string
): Promise<void> {
  const docRef = doc(db, 'usuarios', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const empresas = docSnap.data().empresas || [];
    if (!empresas.includes(empresaId)) {
      await updateDoc(docRef, {
        empresas: [...empresas, empresaId],
        fechaActualizacion: Timestamp.now(),
      });
    }
  }
}

export async function quitarUsuarioDeEmpresa(
  uid: string,
  empresaId: string
): Promise<void> {
  const docRef = doc(db, 'usuarios', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const empresas = docSnap.data().empresas || [];
    await updateDoc(docRef, {
      empresas: empresas.filter((e: string) => e !== empresaId),
      fechaActualizacion: Timestamp.now(),
    });
  }
}

export async function actualizarRolUsuario(
  uid: string,
  rol: string
): Promise<void> {
  const docRef = doc(db, 'usuarios', uid);
  await updateDoc(docRef, { rol, fechaActualizacion: Timestamp.now() });
}

// RBAC: Solo SUPER_ADMIN puede ver todos los usuarios del sistema
export async function obtenerTodosUsuarios(): Promise<UsuarioEmpresa[]> {
  const snapshot = await getDocs(collection(db, 'usuarios'));
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
    fechaCreacion: doc.data().fechaCreacion?.toDate() || new Date(),
  })) as UsuarioEmpresa[];
}

// ==================
// PRODUCTOS - CRUD COMPLETO
// ==================

export async function actualizarProducto(
  productoId: string,
  datos: Partial<Producto>
): Promise<void> {
  const docRef = doc(db, 'productos', productoId);
  await updateDoc(docRef, datos);
}

export async function eliminarProducto(productoId: string): Promise<void> {
  await deleteDoc(doc(db, 'productos', productoId));
}

// ==================
// ASIGNACIONES - CRUD COMPLETO
// ==================

export async function actualizarAsignacion(
  asignacionId: string,
  datos: Partial<Asignacion>
): Promise<void> {
  const docRef = doc(db, 'asignaciones', asignacionId);
  await updateDoc(docRef, datos);
}

export async function obtenerAsignacionesPorEmpresa(
  empresaId: string
): Promise<Asignacion[]> {
  const q = query(
    collection(db, 'asignaciones'),
    where('empresaId', '==', empresaId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Asignacion[];
}

// ==================
// PROVEEDORES - CRUD COMPLETO
// ==================

// RBAC: Solo ADMIN y ABASTECIMIENTO pueden crear proveedores
export async function crearProveedor(
  proveedor: Omit<Proveedor, 'id'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'proveedores'), proveedor);
  return docRef.id;
}

// RBAC: Solo ADMIN y ABASTECIMIENTO pueden eliminar proveedores
export async function eliminarProveedor(proveedorId: string): Promise<void> {
  await deleteDoc(doc(db, 'proveedores', proveedorId));
}

// RBAC: Solo ADMIN y ABASTECIMIENTO pueden actualizar proveedores
export async function actualizarProveedor(
  proveedorId: string,
  datos: Partial<Proveedor>
): Promise<void> {
  const docRef = doc(db, 'proveedores', proveedorId);
  await updateDoc(docRef, datos);
}

// RBAC: Obtener proveedores por empresa (aislamiento de datos)
export async function obtenerProveedoresPorEmpresa(
  empresaId: string
): Promise<Proveedor[]> {
  const q = query(
    collection(db, 'proveedores'),
    where('empresaId', '==', empresaId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Proveedor[];
}

export async function obtenerUsuario(uid: string): Promise<UsuarioEmpresa | null> {
  const docRef = doc(db, 'usuarios', uid);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    uid: docSnap.id,
    ...docSnap.data(),
    fechaCreacion: docSnap.data().fechaCreacion?.toDate() || new Date(),
  } as UsuarioEmpresa;
}

export async function crearActualizarUsuario(
  uid: string,
  datos: Partial<UsuarioEmpresa>
): Promise<void> {
  const docRef = doc(db, 'usuarios', uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    await updateDoc(docRef, {
      ...datos,
      fechaActualizacion: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      uid,
      ...datos,
      fechaCreacion: Timestamp.now(),
    });
  }
}

export async function obtenerUsuariosPorEmpresa(empresaId: string): Promise<UsuarioEmpresa[]> {
  const q = query(
    collection(db, 'usuarios'),
    where('empresas', 'array-contains', empresaId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
    fechaCreacion: doc.data().fechaCreacion?.toDate() || new Date(),
  })) as UsuarioEmpresa[];
}

export async function esPrimerUsuario(): Promise<boolean> {
  const q = query(collection(db, 'usuarios'), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty;
}

export async function actualizarUsuario(
  usuarioId: string,
  datos: Partial<UsuarioEmpresa>
): Promise<void> {
  const docRef = doc(db, 'usuarios', usuarioId);
  await updateDoc(docRef, datos);
}

export async function crearUsuario(
  datos: Omit<UsuarioEmpresa, 'id'> & { id?: string }
): Promise<string> {
  const docRef = await addDoc(collection(db, 'usuarios'), {
    ...datos,
    fechaCreacion: Timestamp.now(),
  });
  return docRef.id;
}

// ==================
// ASIGNACIONES
// ==================

export async function obtenerAsignaciones(
  empresaId: string,
  identificador?: string | (string | undefined | null)[]
): Promise<Asignacion[]> {
  const q = query(
    collection(db, 'asignaciones'),
    where('empresaId', '==', empresaId)
  );
  const snapshot = await getDocs(q);
  let results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Asignacion[];

  // El identificador puede ser el uid real de Firebase Auth, el email
  // (usado como uid temporal cuando el admin pre-registra a alguien antes de
  // su primer login, ver admin/usuarios) o la cedula. Se acepta uno solo o
  // varios candidatos y se hace match contra cualquiera de los tres campos.
  if (identificador) {
    const candidatos = (Array.isArray(identificador) ? identificador : [identificador])
      .filter((v): v is string => !!v)
      .map(v => v.toLowerCase());
    if (candidatos.length) {
      results = results.filter(a => {
        const valores = [a.uid, a.cedula].filter(Boolean).map(v => String(v).toLowerCase());
        return valores.some(v => candidatos.includes(v));
      });
    }
  }

  return results;
}

export async function crearAsignacion(
  asignacion: Omit<Asignacion, 'id'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'asignaciones'), asignacion);
  return docRef.id;
}

export async function eliminarAsignacion(asignacionId: string): Promise<void> {
  await deleteDoc(doc(db, 'asignaciones', asignacionId));
}

// ==================
// PRODUCTOS
// ==================

export async function obtenerProductos(empresaId: string): Promise<Producto[]> {
  const q = query(
    collection(db, 'productos'),
    where('empresaId', '==', empresaId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Producto)
    .filter(p => p.activo);
}

export async function crearProducto(producto: Omit<Producto, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'productos'), producto);
  return docRef.id;
}

// ==================
// SOLICITUDES
// ==================

export async function obtenerSolicitudes(
  empresaId: string,
  opciones?: {
    uid?: string;
    estado?: string;
    limite?: number;
  }
): Promise<Solicitud[]> {
  // Simple query without orderBy to avoid composite index requirement
  const q = query(
    collection(db, 'solicitudes'),
    where('empresaId', '==', empresaId)
  );

  const snapshot = await getDocs(q);
  let results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    fechaCreacion: doc.data().fechaCreacion?.toDate() || new Date(),
    fechaActualizacion: doc.data().fechaActualizacion?.toDate() || new Date(),
  })) as Solicitud[];

  // Filter client-side to avoid composite indexes
  if (opciones?.uid) {
    results = results.filter(s => s.usuario === opciones.uid);
  }
  if (opciones?.estado) {
    results = results.filter(s => s.estado === opciones.estado);
  }

  // Sort by fechaCreacion desc
  results.sort((a, b) => b.fechaCreacion.getTime() - a.fechaCreacion.getTime());

  if (opciones?.limite) {
    results = results.slice(0, opciones.limite);
  }

  return results;
}

export async function obtenerSolicitud(solicitudId: string): Promise<Solicitud | null> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return {
    id: docSnap.id,
    ...docSnap.data(),
    fechaCreacion: docSnap.data().fechaCreacion?.toDate() || new Date(),
    fechaActualizacion: docSnap.data().fechaActualizacion?.toDate() || new Date(),
  } as Solicitud;
}

export async function crearSolicitud(
  solicitud: Omit<Solicitud, 'id' | 'fechaCreacion' | 'fechaActualizacion'>
): Promise<{ id: string; numero: number }> {
  // Get all solicitations for this empresa and find max number client-side
  // This avoids needing a composite index on (empresaId, numero)
  const q = query(
    collection(db, 'solicitudes'),
    where('empresaId', '==', solicitud.empresaId)
  );
  const snapshot = await getDocs(q);
  let siguienteNumero = 1;
  if (!snapshot.empty) {
    const maxNum = Math.max(...snapshot.docs.map(d => d.data().numero || 0));
    siguienteNumero = maxNum + 1;
  }

  // Clean undefined values (Firestore doesn't accept them)
  const clean = (obj: any) => {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) result[key] = val;
    }
    return result;
  };

  const docRef = await addDoc(collection(db, 'solicitudes'), {
    ...clean(solicitud),
    items: solicitud.items?.map(item => clean(item)) || [],
    numero: siguienteNumero,
    fechaCreacion: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
  });
  // Si la solicitud trae precio (compra directa o con cotizacion inicial) y el producto estaba en 0, actualizarlo
  try {
    for (const it of (solicitud.items || []) as any[]) {
      const codigo = it.codigoProducto;
      const precioNuevo = it.precioUnitario ?? it.cotizaciones?.[it.mejorCotizacionIndex ?? 0]?.precioUnitario;
      if (!codigo || !precioNuevo || Number(precioNuevo) <= 0) continue;
      const qProd = query(collection(db, 'productos'), where('empresaId', '==', solicitud.empresaId), where('codigo', '==', codigo), limit(1));
      const snap = await getDocs(qProd);
      if (!snap.empty) {
        const docProd = snap.docs[0];
        const dataProd = docProd.data() as any;
        const precioActual = Number(dataProd.precioUnitario) || 0;
        if (precioActual === 0 || precioActual !== Number(precioNuevo)) {
          await updateDoc(doc(db, 'productos', docProd.id), { precioUnitario: Number(precioNuevo), fechaActualizacion: Timestamp.now() } as any);
        }
      }
    }
  } catch (e) {
    console.error('Error actualizando precioUnitario en crearSolicitud:', e);
  }
  return { id: docRef.id, numero: siguienteNumero };
}

export async function actualizarSolicitud(
  solicitudId: string,
  datos: Partial<Solicitud>
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    ...datos,
    fechaActualizacion: Timestamp.now(),
  });
}

export async function actualizarEstadoSolicitud(
  solicitudId: string,
  estado: string,
  respuesta?: string
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    estado,
    respuesta: respuesta || '',
    fechaActualizacion: Timestamp.now(),
  });
}

// ─── FLUJO DE COTIZACION ─────────────────────────────────
export async function enviarACotizacion(solicitudId: string, usuarioNombre: string): Promise<void> {
  // First check if document exists
  const docRef = doc(db, 'solicitudes', solicitudId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error('La solicitud no existe');
  }

  await updateDoc(docRef, {
    estado: 'en_cotizacion',
    fechaActualizacion: Timestamp.now(),
  });

  // Add note to subcollection
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    texto: `${usuarioNombre} inicio el proceso de cotizacion`,
    autor: usuarioNombre,
    fecha: Timestamp.now(),
    tipo: 'cotizacion',
  });
}

export async function guardarCotizaciones(
  solicitudId: string,
  items: ItemSolicitud[],
  cotizadoPor: string,
  cotizadoPorNombre: string
): Promise<void> {
  // Clean undefined values from items before saving
  const cleanItems = items.map(item => {
    const clean: any = {};
    for (const [key, val] of Object.entries(item)) {
      if (val !== undefined) clean[key] = val;
    }
    // Clean cotizaciones too
    if (clean.cotizaciones) {
      clean.cotizaciones = clean.cotizaciones.map((cot: any) => {
        const cleanCot: any = {};
        for (const [k, v] of Object.entries(cot)) {
          if (v !== undefined) cleanCot[k] = v;
        }
        return cleanCot;
      });
    }
    return clean;
  });

  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    items: cleanItems,
    estado: 'cotizada',
    cotizadoPor,
    cotizadoPorNombre,
    fechaCotizacion: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
  });
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    texto: `${cotizadoPorNombre} envio la cotizacion con ${items.filter(i => i.cotizaciones?.length > 0).length} items cotizados`,
    autor: cotizadoPorNombre,
    fecha: Timestamp.now(),
    tipo: 'cotizacion',
  });
  // Actualizar precioUnitario del producto si estaba en 0
  try {
    const snapSol = await getDoc(docRef);
    const empresaId = (snapSol.data() as any)?.empresaId;
    if (empresaId) {
      for (const it of cleanItems as any[]) {
        const codigo = it.codigoProducto;
        const cotIdx = it.mejorCotizacionIndex ?? 0;
        const cot = it.cotizaciones?.[cotIdx] ?? it.cotizaciones?.[0];
        const precioNuevo = cot?.precioUnitario ?? it.precioUnitario;
        if (!codigo || !precioNuevo || Number(precioNuevo) <= 0) continue;
        const qProd = query(collection(db, 'productos'), where('empresaId', '==', empresaId), where('codigo', '==', codigo), limit(1));
        const snap = await getDocs(qProd);
        if (!snap.empty) {
          const docProd = snap.docs[0];
          const dataProd = docProd.data() as any;
          const precioActual = Number(dataProd.precioUnitario) || 0;
          if (precioActual === 0 || precioActual !== Number(precioNuevo)) {
            await updateDoc(doc(db, 'productos', docProd.id), { precioUnitario: Number(precioNuevo), fechaActualizacion: Timestamp.now() } as any);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error actualizando precioUnitario en guardarCotizaciones:', e);
  }
}

export async function aprobarSolicitud(
  solicitudId: string,
  aprobadoPor: string,
  aprobadoPorNombre: string,
  items?: ItemSolicitud[]
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  const updateData: any = {
    estado: 'aprobada',
    aprobadoPor,
    aprobadoPorNombre,
    fechaAprobacion: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
  };
  if (items) updateData.items = items;
  await updateDoc(docRef, updateData);
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    texto: `${aprobadoPorNombre} aprobo la cotizacion`,
    autor: aprobadoPorNombre,
    fecha: Timestamp.now(),
    tipo: 'aprobacion',
  });
}

export async function rechazarSolicitud(
  solicitudId: string,
  motivo: string,
  rechazadoPor: string,
  rechazadoPorNombre: string
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    estado: 'en_cotizacion',
    motivoRechazo: motivo,
    fechaActualizacion: Timestamp.now(),
  });
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    texto: `${rechazadoPorNombre} rechazo la cotizacion. Motivo: ${motivo}`,
    autor: rechazadoPorNombre,
    fecha: Timestamp.now(),
    tipo: 'rechazo',
  });
}

export async function generarPedido(
  solicitudId: string,
  numeroPedido: string,
  usuarioNombre: string
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    estado: 'en_pedido',
    numeroPedido,
    fechaPedido: Timestamp.now(),
    fechaActualizacion: Timestamp.now(),
  });
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    texto: `${usuarioNombre} genero el pedido #${numeroPedido}`,
    autor: usuarioNombre,
    fecha: Timestamp.now(),
    tipo: 'general',
  });
}

export async function completarSolicitud(
  solicitudId: string,
  usuarioNombre: string
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    estado: 'completada',
    fechaActualizacion: Timestamp.now(),
  });
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    texto: `${usuarioNombre} marco la solicitud como completada`,
    autor: usuarioNombre,
    fecha: Timestamp.now(),
    tipo: 'general',
  });
}

export async function agregarNotaSolicitud(
  solicitudId: string,
  nota: { texto: string; autor: string; tipo?: string }
): Promise<void> {
  await addDoc(collection(db, 'solicitudes', solicitudId, 'notas'), {
    ...nota,
    fecha: Timestamp.now(),
    tipo: nota.tipo || 'general',
  });
}

export async function actualizarCotizaciones(
  solicitudId: string,
  items: Solicitud['items']
): Promise<void> {
  const docRef = doc(db, 'solicitudes', solicitudId);
  await updateDoc(docRef, {
    items,
    fechaActualizacion: Timestamp.now(),
  });
}

// ==================
// PROVEEDORES
// ==================

export async function obtenerProveedores(empresaId: string): Promise<Proveedor[]> {
  const q = query(
    collection(db, 'proveedores'),
    where('empresaId', '==', empresaId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Proveedor[];
}

export async function obtenerNombresProveedores(empresaId: string): Promise<string[]> {
  const proveedores = await obtenerProveedores(empresaId);
  const nombres = new Set<string>();
  proveedores.forEach((p) => {
    Object.keys(p.precios).forEach((nombre) => nombres.add(nombre));
  });
  return Array.from(nombres);
}

// ==================
// ADMIN: TODAS LAS SOLICITUDES
// ==================

export async function obtenerTodasSolicitudes(): Promise<Solicitud[]> {
  const snapshot = await getDocs(collection(db, 'solicitudes'));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    fechaCreacion: doc.data().fechaCreacion?.toDate() || new Date(),
    fechaActualizacion: doc.data().fechaActualizacion?.toDate() || new Date(),
  })) as Solicitud[];
}

// ─── MODO GRATIS OPTIMIZADO: Lectura única + cache corto + optimistic ───
const _cache = new Map<string, { data: Solicitud[]; ts: number }>();
const CACHE_MS = 15_000;

export function obtenerTodasSolicitudesEnTiempoReal(
  empresaId: string,
  callback: (solicitudes: Solicitud[]) => void
): () => void {
  let cancelled = false;
  const fetchOnce = async () => {
    const key = `all-${empresaId}`;
    const cached = _cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_MS) {
      callback(cached.data);
      return;
    }
    const q = query(collection(db, 'solicitudes'), where('empresaId', '==', empresaId), limit(100));
    const snapshot = await getDocs(q);
    const solicitudes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      fechaCreacion: doc.data().fechaCreacion?.toDate() || new Date(),
      fechaActualizacion: doc.data().fechaActualizacion?.toDate() || new Date(),
    })) as Solicitud[];
    _cache.set(key, { data: solicitudes, ts: Date.now() });
    if (!cancelled) callback(solicitudes);
  };
  fetchOnce();
  const interval = setInterval(fetchOnce, CACHE_MS);
  return () => { cancelled = true; clearInterval(interval); };
}

export function obtenerSolicitudEnTiempoReal(
  solicitudId: string,
  callback: (solicitud: Solicitud | null) => void
): () => void {
  let cancelled = false;
  const fetchOnce = async () => {
    const docRef = doc(db, 'solicitudes', solicitudId);
    const docSnap = await getDoc(docRef);
    if (cancelled) return;
    if (!docSnap.exists()) { callback(null); return; }
    callback({
      id: docSnap.id,
      ...docSnap.data(),
      fechaCreacion: docSnap.data().fechaCreacion?.toDate() || new Date(),
      fechaActualizacion: docSnap.data().fechaActualizacion?.toDate() || new Date(),
    } as Solicitud);
  };
  fetchOnce();
  const interval = setInterval(fetchOnce, CACHE_MS);
  return () => { cancelled = true; clearInterval(interval); };
}

// Invalida cache tras escrituras (llamar tras PATCH/crear)
export function invalidarCacheSolicitudes(empresaId?: string) {
  if (empresaId) _cache.delete(`all-${empresaId}`);
  else _cache.clear();
}

export async function eliminarSolicitud(solicitudId: string): Promise<void> {
  await deleteDoc(doc(db, 'solicitudes', solicitudId));
}
