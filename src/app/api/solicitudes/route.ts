import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

// ─── MIDDLEWARE DE SEGURIDAD ─────────────────────────
// RBAC: Valida token y permisos en cada petición

async function validarAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Token no proporcionado', status: 401 };
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const { adminDb } = await import('@/lib/firebase-admin');
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    if (!adminDb) return { error: 'Firebase Admin no configurado', status: 503 };
    const snap = await adminDb.collection('usuarios').doc(uid).get();
    if (!snap.exists) return { error: 'Usuario no encontrado', status: 404 };
    const data = snap.data() as any;
    return {
      uid,
      email: decoded.email || data.email,
      rol: data.rol || 'solicitante',
      empresaId: data.empresaActual || (data.empresas?.[0] || ''),
    };
  } catch (e) {
    return { error: 'Token invalido', status: 401 };
  }
}

// ─── GET: Obtener solicitudes ─────────────────────────
export async function GET(request: NextRequest) {
  try {
    // Verificar que Firebase Admin está configurado
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin no está configurado' },
        { status: 503 }
      );
    }

    const usuario = await validarAuth(request);
    if ('error' in usuario) {
      return NextResponse.json({ error: usuario.error }, { status: usuario.status });
    }

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get('empresaId');

    // RBAC: ADMIN y ABASTECIMIENTO solo ven solicitudes de su empresa
    if (usuario.rol !== 'super_admin') {
      if (empresaId !== usuario.empresaId) {
        return NextResponse.json(
          { error: 'No tienes acceso a estos datos' },
          { status: 403 }
        );
      }
    }

    // Consultar Firestore
    const snapshot = await adminDb
      .collection('solicitudes')
      .where('empresaId', '==', empresaId)
      .get();

    const solicitudes = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ data: solicitudes });
  } catch (error) {
    console.error('Error en GET /api/solicitudes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ─── POST: Crear solicitud ────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Verificar que Firebase Admin está configurado
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin no está configurado' },
        { status: 503 }
      );
    }

    const usuario = await validarAuth(request);
    if ('error' in usuario) {
      return NextResponse.json({ error: usuario.error }, { status: usuario.status });
    }

    // RBAC: Solo SOLICITANTE, ADMIN y SUPER_ADMIN pueden crear solicitudes
    if (!['solicitante', 'admin', 'super_admin'].includes(usuario.rol)) {
      return NextResponse.json(
        { error: 'No tienes permiso para crear solicitudes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { empresaId, items, centroTrabajo, cliente, contrato, nombreUsuario, emailUsuario, prioridad, observaciones, archivos } = body;

    // Validar que empresaId coincida con el usuario (si no es super_admin)
    if (usuario.rol !== 'super_admin' && empresaId !== usuario.empresaId) {
      return NextResponse.json(
        { error: 'No puedes crear solicitudes para otra empresa' },
        { status: 403 }
      );
    }

    // Validar campos requeridos
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'La solicitud debe tener al menos un item' },
        { status: 400 }
      );
    }

    // Generar numero secuencial
    const snapshot = await adminDb
      .collection('solicitudes')
      .where('empresaId', '==', empresaId)
      .get();
    
    let siguienteNumero = 1;
    if (!snapshot.empty) {
      const maxNum = Math.max(...snapshot.docs.map((d: any) => d.data().numero || 0));
      siguienteNumero = maxNum + 1;
    }

    // Crear en Firestore
    const docRef = await adminDb.collection('solicitudes').add({
      empresaId,
      usuario: usuario.uid,
      nombreUsuario: nombreUsuario || usuario.email,
      emailUsuario: emailUsuario || usuario.email,
      centroTrabajo,
      cliente,
      contrato,
      items,
      prioridad: prioridad || 'normal',
      observaciones,
      archivos: archivos || [],
      numero: siguienteNumero,
      estado: 'pendiente',
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    });

    return NextResponse.json({ id: docRef.id, numero: siguienteNumero }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/solicitudes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ─── PUT: Actualizar solicitud ────────────────────────
export async function PUT(request: NextRequest) {
  try {
    // Verificar que Firebase Admin está configurado
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin no está configurado' },
        { status: 503 }
      );
    }

    const usuario = await validarAuth(request);
    if ('error' in usuario) {
      return NextResponse.json({ error: usuario.error }, { status: usuario.status });
    }

    const body = await request.json();
    const { id, ...datos } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de solicitud requerido' },
        { status: 400 }
      );
    }

    // Verificar que la solicitud existe y pertenece a la empresa del usuario
    const doc = await adminDb.collection('solicitudes').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    const solicitud = doc.data();
    if (usuario.rol !== 'super_admin' && solicitud?.empresaId !== usuario.empresaId) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta solicitud' },
        { status: 403 }
      );
    }

    // RBAC: Solo ADMIN, ABASTECIMIENTO y SUPER_ADMIN pueden actualizar solicitudes
    if (!['admin', 'abastecimiento', 'super_admin'].includes(usuario.rol)) {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar solicitudes' },
        { status: 403 }
      );
    }

    await adminDb.collection('solicitudes').doc(id).update({
      ...datos,
      fechaActualizacion: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en PUT /api/solicitudes:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
