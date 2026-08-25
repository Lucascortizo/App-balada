import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';

export default function Ingressos() {
  const [evento, setEvento] = useState(null);
  const [espacos, setEspacos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const eventoId = location.state?.eventoId;

  useEffect(() => {
    if (!eventoId) {
      navigate('/home');
      return;
    }

    const buscarEvento = async () => {
      const docRef = doc(db, "eventos", eventoId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEvento({ id: docSnap.id, ...docSnap.data() });
      }
    };
    buscarEvento();

    const q = query(collection(db, "espacos"), where("eventoId", "==", eventoId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(espaco => espaco.status === "disponivel");

      lista.sort((a, b) => a.sigla.localeCompare(b.sigla));
      setEspacos(lista);
    });

    return () => unsubscribe();
  }, [navigate, eventoId]);

  const comprarPista = async () => {
    if (!user) {
      navigate('/login', { state: { returnTo: '/ingressos', eventoId: eventoId } });
      return;
    }

    if (window.confirm(`Comprar Ingresso Pista por R$ ${evento.precoPista.toFixed(2)}?`)) {
      setIsSubmitting(true);
      try {
        await addDoc(collection(db, "ingressos_vendidos"), {
          eventoId: evento.id,
          eventoNome: evento.nome,
          tipo: "Pista",
          preco: evento.precoPista,
          donoId: user.uid,
          donoNome: user.nome || user.email,
          dataCompra: new Date().toISOString(),
          status: "valido"
        });
        alert("Ingresso Pista garantido! QR Code gerado.");
        navigate('/minha-conta');
      } catch (error) {
        alert("Erro ao processar compra.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const reservarEspaco = async (espaco) => {
    if (!user) {
      navigate('/login', { state: { returnTo: '/ingressos', eventoId: eventoId } });
      return;
    }

    if (window.confirm(`Reservar o ${espaco.sigla} por R$ ${espaco.preco.toFixed(2)}? \n(Consumação: R$ ${espaco.consumacao.toFixed(2)})`)) {
      setIsSubmitting(true);
      try {
        const espacoRef = doc(db, "espacos", espaco.id);

        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(espacoRef);
          if (!snap.exists() || snap.data().status !== 'disponivel') {
            throw new Error('indisponivel');
          }
          transaction.update(espacoRef, {
            status: "reservado",
            donoId: user.uid,
            donoNome: user.nome || user.email,
            dataReserva: new Date().toISOString()
          });
        });

        alert(`Reserva do ${espaco.sigla} confirmada!`);
        navigate('/minha-conta');
      } catch (error) {
        alert("Ops, alguém foi mais rápido e reservou este espaço!");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const camarotes = espacos.filter(e => e.tipo === 'Camarote');
  const bistros = espacos.filter(e => e.tipo === 'Bistrô');
  const lounges = espacos.filter(e => e.tipo === 'Lounge');

  if (!evento) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-purple-400">Carregando mapa...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans pb-24">
      <header className="mb-6 flex flex-col gap-2 border-b border-gray-700 pb-4">
        <button onClick={() => navigate('/home')} className="text-gray-400 hover:text-white transition self-start">
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-white">{evento.nome}</h1>
        <p className="text-sm text-purple-400">Escolha seu setor</p>
      </header>

      <div className="space-y-10">

        <section>
          <h2 className="text-xl font-bold mb-4 border-l-4 border-green-500 pl-3">Ingresso Avulso</h2>
          <div className="bg-gray-800 p-5 rounded-xl border border-green-500/30 flex justify-between items-center shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 rounded-bl-full"></div>
            <div className="z-10">
              <h3 className="font-bold text-xl text-white">Pista</h3>
              <p className="text-sm text-gray-400 mt-1">Acesso à área geral</p>
            </div>
            <div className="text-right z-10">
              <p className="text-green-400 font-bold text-2xl mb-2">R$ {evento.precoPista.toFixed(2)}</p>
              <button onClick={comprarPista} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition active:scale-95">
                Comprar
              </button>
            </div>
          </div>
        </section>

        {camarotes.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 border-l-4 border-purple-500 pl-3">Camarotes</h2>
            <div className="grid grid-cols-2 gap-4">
              {camarotes.map(espaco => (
                <button key={espaco.id} onClick={() => reservarEspaco(espaco)} disabled={isSubmitting} className="bg-gray-800 p-4 rounded-xl border border-purple-500/50 hover:bg-purple-900/40 transition text-left flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full"></div>
                  <div className="flex justify-between items-start z-10">
                    <h3 className="font-bold text-2xl text-purple-300">{espaco.sigla}</h3>
                    <span className="text-xs bg-gray-900 text-gray-400 px-2 py-1 rounded">Até {espaco.capacidade}p</span>
                  </div>
                  <div className="mt-6 z-10">
                    <p className="text-white font-bold text-xl">R$ {espaco.preco.toFixed(2)}</p>
                    <p className="text-xs text-green-400 font-bold mt-1">Consome: R$ {espaco.consumacao.toFixed(2)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {bistros.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4 border-l-4 border-blue-500 pl-3">Bistrôs</h2>
            <div className="grid grid-cols-3 gap-3">
              {bistros.map(espaco => (
                <button key={espaco.id} onClick={() => reservarEspaco(espaco)} disabled={isSubmitting} className="bg-gray-800 p-3 rounded-xl border border-blue-500/30 hover:bg-blue-900/40 transition text-center flex flex-col items-center justify-center gap-1 aspect-square">
                  <h3 className="font-bold text-xl text-blue-300">{espaco.sigla}</h3>
                  <div className="mt-2">
                    <p className="text-white text-sm font-bold">R$ {espaco.preco}</p>
                    <p className="text-[10px] text-green-400 font-bold">Consuma R$ {espaco.consumacao}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}