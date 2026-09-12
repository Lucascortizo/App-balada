import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';

export const gerarTokenPasseSaida = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const criarPasseSaidaRef = () =>
  doc(collection(db, 'passes_saida'), gerarTokenPasseSaida());