import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Substitua com as chaves que você copiou do console
const firebaseConfig = {
  apiKey: "AIzaSyCz5jEwg7jFTEYVcdH4jA7nIZ2RvdVd3oQ",
  authDomain: "app-balada-905fc.firebaseapp.com",
  projectId: "app-balada-905fc",
  storageBucket: "app-balada-905fc.firebasestorage.app",
  messagingSenderId: "676052356934",
  appId: "1:676052356934:web:aa9de5ec5ebafdcc3e5f47",
  measurementId: "G-XD5ZP860WM"
};

// Inicializando os serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };