import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ─── FIREBASE ADMIN CONFIGURATION ─────────────────────
// RBAC: Configuración para validación server-side

let adminDb: any = null;
let adminAuth: any = null;

// Solo inicializar si las variables de entorno están configuradas
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  const firebaseAdminConfig = {
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  };

  const app = getApps().length === 0 ? initializeApp(firebaseAdminConfig) : getApps()[0];
  adminDb = getFirestore(app);
  adminAuth = getAuth(app);
}

export { adminDb, adminAuth };

// ─── VERIFICAR TOKEN ─────────────────────────────────
// RBAC: Verifica el token de Firebase y retorna el usuario

export async function verificarToken(token: string) {
  if (!adminAuth) {
    console.error('Firebase Admin no está configurado');
    return null;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      empresaId: decodedToken.empresaId,
      rol: decodedToken.rol,
    };
  } catch (error) {
    console.error('Error verificando token:', error);
    return null;
  }
}

// ─── OBTENER USUARIO ─────────────────────────────────
// RBAC: Obtiene el usuario completo de Firestore

export async function obtenerUsuario(uid: string) {
  if (!adminDb) {
    console.error('Firebase Admin no está configurado');
    return null;
  }

  try {
    const doc = await adminDb.collection('usuarios').doc(uid).get();
    if (!doc.exists) return null;
    return {
      uid: doc.id,
      ...doc.data(),
    };
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    return null;
  }
}
