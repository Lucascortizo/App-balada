import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import { ArrowLeft, MapPin, Clock, AlertCircle } from 'lucide-react';

export default function Ingressos() {
  const [evento, setEvento] = useState(null);
  const [espacos, setEspacos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const eventoId = location.state?.eventoId;

  useEffect(() => {
    if (!eventoId) return navigate('/home');
    getDoc(doc(db, "eventos", eventoId)).then(snap => {
      if (snap.exists()) setEvento({ id: snap.id, ...snap.data() });
    });
    const unsub = onSnapshot(query(collection(db, "espacos"), where("eventoId", "==", eventoId)), snap => {
      setEspacos(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.status === "disponivel"));
    });
    return () => unsub();
  }, [navigate, eventoId]);

  const comprarPista = async () => {
    if (!user) return navigate('/login', { state: { returnTo: '/ingressos', eventoId } });
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "ingressos_vendidos"), { eventoId: evento.id, eventoNome: evento.nome, tipo: "Pista", preco: evento.precoPista, donoId: user.uid, donoNome: user.nome || user.email, dataCompra: new Date().toISOString(), status: "valido" });
      navigate('/minha-conta');
    } catch (e) { alert("Erro ao processar."); } finally { setIsSubmitting(false); }
  };

  const reservarEspaco = async (espaco) => {
    if (!user) return navigate('/login', { state: { returnTo: '/ingressos', eventoId } });
    if (!window.confirm(`Reservar o espaço ${espaco.sigla} por R$ ${espaco.preco.toFixed(2)}?`)) return;
    setIsSubmitting(true);
    try {
      await runTransaction(db, async (t) => {
        const ref = doc(db, "espacos", espaco.id);
        const snap = await t.get(ref);
        if (!snap.exists() || snap.data().status !== 'disponivel') throw new Error('indisponivel');
        t.update(ref, { status: "reservado", donoId: user.uid, donoNome: user.nome || user.email, dataReserva: new Date().toISOString(), checkinFeito: false });
      });
      navigate('/minha-conta');
    } catch (e) { alert("Indisponível no momento."); } finally { setIsSubmitting(false); }
  };

  if (!evento) return <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-40">
      <div className="relative h-80 w-full">
        <img src={evento.linkImagem} alt={evento.nome} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAFAFA] via-transparent to-black/50"></div>
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 bg-white/90 backdrop-blur-md p-3 rounded-full shadow-sm hover:bg-white transition-transform active:scale-95 text-zinc-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 -mt-16 relative z-10">
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100 mb-8">
          <p className="text-xs text-indigo-600 font-black uppercase tracking-widest mb-2">
            {new Date(evento.data).toLocaleDateString('pt-BR')}
          </p>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900 leading-none mb-4">
            {evento.nome}
          </h1>
          <p className="text-zinc-500 text-sm font-medium leading-relaxed mb-8">
            {evento.descricao || "Detalhes do evento em breve."}
          </p>
          
          <div className="pt-6 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-400 font-black tracking-widest mb-1">Local</p>
                <p className="text-sm font-bold text-zinc-800">{evento.local || "Não informado"}</p>
              </div>
            </div>
            
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-400 font-black tracking-widest mb-1">Abertura</p>
                <p className="text-sm font-bold text-zinc-800">{new Date(evento.data).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            </div>

            <div className="flex gap-4 items-center md:col-span-2">
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-500 flex-shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-zinc-400 font-black tracking-widest mb-1">Classificação & Regras</p>
                <p className="text-sm font-medium text-zinc-600 leading-relaxed">{evento.regras || "+18 anos. Obrigatório documento original com foto."}</p>
              </div>
            </div>
          </div>
        </div>

        {espacos.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-black text-zinc-900 mb-6 tracking-tight">Mesas e Camarotes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {espacos.map(espaco => (
                <div key={espaco.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-indigo-200 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-1">{espaco.tipo}</p>
                      <h3 className="text-2xl font-black text-zinc-900">{espaco.sigla}</h3>
                    </div>
                    <span className="bg-zinc-100 text-zinc-600 text-xs px-3 py-1.5 rounded-full font-bold">Até {espaco.capacidade}p</span>
                  </div>
                  <div className="flex justify-between items-end mt-4">
                    <div>
                      <p className="text-[10px] uppercase text-zinc-400 font-black tracking-widest mb-0.5">Consome R$ {espaco.consumacao.toFixed(2)}</p>
                      <p className="text-2xl font-black text-zinc-900">R$ {espaco.preco.toFixed(2)}</p>
                    </div>
                    <button onClick={() => reservarEspaco(espaco)} disabled={isSubmitting} className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-md disabled:opacity-50">
                      Reservar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-zinc-200 p-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Ingresso Pista</p>
            <p className="text-3xl font-black text-zinc-900 leading-none">R$ {evento.precoPista?.toFixed(2)}</p>
          </div>
          <button onClick={comprarPista} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all disabled:opacity-50">
            {isSubmitting ? 'Aguarde...' : 'Comprar Pista'}
          </button>
        </div>
      </div>
    </div>
  );
}