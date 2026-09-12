import { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuta o login/logout do Firebase Auth
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Busca os dados de exibição e cargo no banco (Plano Gratuito)
          const docRef = doc(db, 'usuarios', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          const userData = docSnap.exists() ? docSnap.data() : {};

          // =========================================================
          // A CHAVE MESTRA: COLOQUE SEU EMAIL AQUI
          const MEU_EMAIL_DONO = 'lucasscortizo@gmail.com';
          // =========================================================

          const isDono = firebaseUser.email.toLowerCase() === MEU_EMAIL_DONO.toLowerCase();

          // Monta o usuário
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nome: userData.nome || firebaseUser.displayName || '',
            // Se o e-mail for o seu, força 'admin'. Se não for, lê do banco.
            role: isDono ? 'admin' : (userData.role || 'cliente'),
          });
        } catch (error) {
          console.error("Erro ao configurar usuário logado:", error);
          setUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // ==========================================
  // FUNÇÃO DE LOGIN
  // ==========================================
  const login = async (email, password) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  // ==========================================
  // FUNÇÃO DE LOGOUT
  // ==========================================
  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}