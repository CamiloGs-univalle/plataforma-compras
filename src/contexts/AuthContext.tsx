'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { UsuarioEmpresa } from '@/types';

interface AuthContextType {
  user: User | null;
  usuario: UsuarioEmpresa | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  seleccionarEmpresa: (empresaId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  usuario: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
  signOut: async () => {},
  seleccionarEmpresa: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function crearUsuarioFallback(firebaseUser: User): UsuarioEmpresa {
  const ADMIN_EMAILS = ['auxiliar.ti@proservis.com.co', 'camilo13369@gmail.com'];
  const isAdmin = ADMIN_EMAILS.includes(firebaseUser.email || '');

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    nombre: firebaseUser.displayName || firebaseUser.email || 'Sin nombre',
    rol: isAdmin ? 'super_admin' : 'solicitante',
    empresas: [],
    activo: true,
    fechaCreacion: new Date(),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<UsuarioEmpresa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!alive) return;

      setUser(firebaseUser);

      if (!firebaseUser) {
        setUsuario(null);
        setLoading(false);
        return;
      }

      // ALWAYS create fallback immediately so the app is never stuck
      const fallback = crearUsuarioFallback(firebaseUser);
      setUsuario(fallback);
      setLoading(false);

      // NOW try to load real data from Firestore (non-blocking)
      try {
        const docRef = doc(db, 'usuarios', firebaseUser.uid);
        const docSnap = await Promise.race([
          getDoc(docRef),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
        ]);

        if (!alive) return;

        if (docSnap && 'exists' in docSnap && docSnap.exists()) {
          const data = docSnap.data();
          setUsuario({
            uid: docSnap.id,
            ...data,
            fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(),
          } as UsuarioEmpresa);
        } else {
          // UID not found - try searching by email (super admin might have different UID)
          const { query: fsQuery, where: fsWhere, collection: fsCollection, getDocs: fsGetDocs } = await import('firebase/firestore');
          const emailQuery = fsQuery(
            fsCollection(db, 'usuarios'),
            fsWhere('email', '==', firebaseUser.email)
          );
          const emailSnap = await Promise.race([
            fsGetDocs(emailQuery),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]).catch(() => null);

          if (emailSnap && 'empty' in emailSnap && !emailSnap.empty) {
            // Found by email - use this document
            const doc = emailSnap.docs[0];
            const data = doc.data();
            setUsuario({
              uid: doc.id,
              ...data,
              fechaCreacion: data.fechaCreacion?.toDate?.() || new Date(),
            } as UsuarioEmpresa);
          } else {
          // User not in Firestore yet, create them
          const isFirst = (await Promise.race([
            import('firebase/firestore').then(({ collection, query, limit, getDocs }) => {
              return getDocs(query(collection(db, 'usuarios'), limit(1)));
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ])) as any;

          const isNew = isFirst?.empty ?? true;
          const ADMIN_EMAILS = ['auxiliar.ti@proservis.com.co', 'camilo13369@gmail.com'];
          const isAdminEmail = ADMIN_EMAILS.includes(firebaseUser.email || '');
          const rol = isAdminEmail ? 'super_admin' : (isNew ? 'solicitante' : 'solicitante');

          await Promise.race([
            setDoc(docRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nombre: firebaseUser.displayName || firebaseUser.email || 'Sin nombre',
              rol,
              empresas: isAdminEmail ? ['siamo', 'proservis', 'affine'] : [],
              activo: true,
              fechaCreacion: serverTimestamp(),
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]);

          if (!alive) return;

          // Try to get the created doc
          try {
            const newSnap = await Promise.race([
              getDoc(docRef),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
            ]);
            if (newSnap && 'exists' in newSnap && newSnap.exists()) {
              setUsuario({
                uid: newSnap.id,
                ...newSnap.data(),
                fechaCreacion: newSnap.data().fechaCreacion?.toDate?.() || new Date(),
              } as UsuarioEmpresa);
            }
          } catch {}
          } // end inner else (user not in Firestore)
        } // end outer else (UID not found)
      } catch (error) {
        console.error('Auth: Firestore error (using fallback):', error);
        // fallback is already set, app works fine
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        throw error;
      }
    }
  };

  const signOutFn = async () => {
    await signOut(auth);
    setUsuario(null);
    setUser(null);
  };

  const seleccionarEmpresa = async (empresaId: string) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'usuarios', user.uid);
      await setDoc(docRef, { empresaActual: empresaId }, { merge: true });
    } catch {}
    setUsuario((prev) => (prev ? { ...prev, empresaActual: empresaId } : null));
  };

  return (
    <AuthContext.Provider value={{ user, usuario, loading, signInWithGoogle, logout: signOutFn, signOut: signOutFn, seleccionarEmpresa }}>
      {children}
    </AuthContext.Provider>
  );
}
