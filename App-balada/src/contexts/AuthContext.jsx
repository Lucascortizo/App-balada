import { createContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const docRef = doc(db, 'usuarios', firebaseUser.uid);
        
        // Verifica se é a primeira vez. Se for, cria como cliente.
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, { 
            nome: firebaseUser.displayName || '', 
            email: firebaseUser.email, 
            role: 'cliente' 
          });
        }

        // MÁGICA: Fica "escutando" o banco em tempo real. 
        // Se o Admin mudar o cargo lá no painel, o celular do funcionário atualiza na mesma hora!
        unsubDoc = onSnapshot(docRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            setUser({ uid: firebaseUser.uid, ...firebaseUser, ...docSnapshot.data() });
          }
          setLoading(false);
        });
        
      } else {
        setUser(null);
        setLoading(false);
        if (unsubDoc) unsubDoc(); // Para de escutar se deslogar
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
  const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}