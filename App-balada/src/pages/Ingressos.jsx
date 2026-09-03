import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, runTransaction, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import { ArrowLeft, MapPin, Clock, AlertCircle, Map as MapIcon, ChevronDown, ChevronUp, Ticket } from 'lucide-react';

export default function Ingressos() {
  const [evento, setEvento] = useState(null);
  const [espacos, setEspacos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [mapaAberto, setMapaAberto] = useState(false);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const eventoId = location.state?.eventoId;

  useEffect(() => {
    if (!eventoId) return navigate('/home');
    getDoc(doc(db, 'eventos', eventoId)).then((snap) => {
      if (snap.exists()) setEvento({ id: snap.id, ...snap.data() });
    });
    const unsub = onSnapshot(query(collection(db, 'espacos'), where('eventoId', '==', eventoId)), (snap) => {
      setEspacos(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.status === 'disponivel'));
    });
    return () => unsub();
  }, [navigate, eventoId]);

  const espacosAgrupados = espacos.reduce((acc, espaco) => {
    const nomeSetor = espaco.tipo || 'Outros';
    if (!acc[nomeSetor]) acc[nomeSetor] = [];
    acc[nomeSetor].push(espaco);
    return acc;
  }, {});

  // Extrai a lista de ingressos dinâmicos do evento ou converte o formato antigo (legado)
  const ingressosDoEvento = evento?.ingressos || (evento?.precoPista ? [{
    id: 'pista-legado',
    nome: 'Pista',
    tipoPreco: evento.tipoPreco || 'unico',
    preco: evento.precoPista,
    precoMasc: evento.precoPistaMasc,
    precoFem: evento.precoPistaFem
  }] : []);

  const comprarIngresso = async (ingressoSelecionado, varianteGenero = null) => {
    if (!user) {
      return navigate('/login', { state: { returnTo: '/ingressos', eventoId: eventoId } });
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const precoFinal = varianteGenero === 'Masculino' 
        ? ingressoSelecionado.precoMasc 
        : (varianteGenero === 'Feminino' ? ingressoSelecionado.precoFem : ingressoSelecionado.preco);
        
      const tipoFinal = varianteGenero 
        ? `${ingressoSelecionado.nome} - ${varianteGenero}` 
        : ingressoSelecionado.nome;

      await addDoc(collection(db, 'ingressos_vendidos'), {
        eventoId: evento.id,
        eventoNome: evento.nome,
        tipo: tipoFinal,
        preco: precoFinal,
        donoId: user.uid,
        donoNome: user.nome || user.email,
        dataCompra: new Date().toISOString(),
        status: 'valido',
      });

      navigate('/minha-conta');
    } catch (e) {
      alert('Erro ao processar a compra.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reservarEspaco = async (espaco) => {
    if (!user) return navigate('/login', { state: { returnTo: '/ingressos', eventoId: eventoId } });
    if (!window.confirm(`Reservar o espaço ${espaco.sigla} por R$ ${espaco.preco.toFixed(2)}?`)) return;

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await runTransaction(db, async (t) => {
        const ref = doc(db, 'espacos', espaco.id);
        const snap = await t.get(ref);
        if (!snap.exists() || snap.data().status !== 'disponivel') throw new Error('indisponivel');
        t.update(ref, {
          status: 'reservado',
          donoId: user.uid,
          donoNome: user.nome || user.email,
          dataReserva: new Date().toISOString(),
          checkinFeito: false,
        });
      });
      navigate('/minha-conta');
    } catch (e) {
      alert('Este espaço acabou de ser reservado por outra pessoa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!evento) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32 text-zinc-900">
      <div className="relative h-72 w-full">
        <img src={evento.linkImagem} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#FAFAFA] via-transparent to-black/40" />
        <button
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 rounded-full bg-white/90 p-3 text-zinc-900 shadow-sm backdrop-blur-md transition hover:bg-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 mx-auto -mt-14 max-w-3xl px-6">
        <div className="mb-8 rounded-3xl border border-zinc-100 bg-white p-7 shadow-sm">
          <p className="mb-1.5 text-sm font-medium text-indigo-600">{new Date(evento.data).toLocaleDateString('pt-BR')}</p>
          <h1 className="mb-3 text-3xl font-black !text-zinc-900 tracking-tight">{evento.nome}</h1>
          <p className="mb-7 text-sm leading-relaxed text-zinc-500 font-medium">{evento.descricao || 'Detalhes do evento em breve.'}</p>

          <div className="grid grid-cols-1 gap-5 border-t border-zinc-100 pt-6 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-0.5 text-xs font-black uppercase tracking-widest text-zinc-400">Local</p>
                <p className="text-sm font-black !text-zinc-900">{evento.local || 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-0.5 text-xs font-black uppercase tracking-widest text-zinc-400">Abertura</p>
                <p className="text-sm font-black !text-zinc-900">{new Date(evento.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:col-span-2">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="mb-0.5 text-xs font-black uppercase tracking-widest text-zinc-400">Regras</p>
                <p className="text-sm leading-relaxed font-bold text-zinc-600">{evento.regras || '+18 anos. Documento com foto.'}</p>
              </div>
            </div>
          </div>
        </div>

        {evento.linkMapa && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-zinc-100 bg-white p-2 shadow-sm transition-all">
            <button 
              onClick={() => setMapaAberto(!mapaAberto)} 
              className="flex w-full items-center justify-between p-4 font-black !text-zinc-900 transition active:scale-95"
            >
              <span className="flex items-center gap-2"><MapIcon className="h-5 w-5 text-indigo-600"/> Ver Mapa do Evento</span>
              {mapaAberto ? <ChevronUp className="h-5 w-5 text-zinc-400"/> : <ChevronDown className="h-5 w-5 text-zinc-400"/>}
            </button>
            {mapaAberto && (
              <div className="px-4 pb-4 animate-in slide-in-from-top-2">
                <img src={evento.linkMapa} alt="Mapa do Evento" className="w-full rounded-2xl border border-zinc-100 object-contain" />
              </div>
            )}
          </div>
        )}

        {/* ======== LÓGICA NOVA: INGRESSOS COMO CARDS DIRETAMENTE NA TELA ======== */}
        {ingressosDoEvento.length > 0 && (
          <div className="mb-10 animate-fade-in">
            <h2 className="mb-5 text-xl font-black tracking-tight !text-zinc-900 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-600"/> Ingressos Disponíveis
            </h2>
            <div className="space-y-4">
              {ingressosDoEvento.map((ing) => (
                <div key={ing.id} className="rounded-3xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-zinc-100 bg-zinc-50/50">
                    <h3 className="text-xl font-black !text-zinc-900">{ing.nome}</h3>
                    <p className="text-xs font-bold text-zinc-500 mt-1 uppercase tracking-widest">Acesso Padrão</p>
                  </div>
                  
                  {ing.tipoPreco === 'unico' ? (
                    <div className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase text-zinc-400 mb-1 tracking-widest">Lote Atual</p>
                        <p className="text-2xl font-black !text-zinc-900">R$ {Number(ing.preco).toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => comprarIngresso(ing)}
                        disabled={isSubmitting}
                        className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-50 active:scale-95 shadow-md"
                      >
                        Comprar
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100">
                      <div className="p-5 flex items-center justify-between hover:bg-pink-50/30 transition">
                        <div>
                          <p className="text-[10px] font-black uppercase text-pink-500 mb-1 tracking-widest">Feminino</p>
                          <p className="text-2xl font-black !text-zinc-900">R$ {Number(ing.precoFem).toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => comprarIngresso(ing, 'Feminino')}
                          disabled={isSubmitting}
                          className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-50 active:scale-95"
                        >
                          Comprar
                        </button>
                      </div>
                      <div className="p-5 flex items-center justify-between hover:bg-blue-50/30 transition">
                        <div>
                          <p className="text-[10px] font-black uppercase text-blue-500 mb-1 tracking-widest">Masculino</p>
                          <p className="text-2xl font-black !text-zinc-900">R$ {Number(ing.precoMasc).toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => comprarIngresso(ing, 'Masculino')}
                          disabled={isSubmitting}
                          className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-50 active:scale-95"
                        >
                          Comprar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ======================================================================= */}

        {espacos.length > 0 && (
          <div className="mb-10">
            {Object.entries(espacosAgrupados).map(([nomeSetor, listaEspacos]) => (
              <div key={nomeSetor} className="mb-8">
                <h2 className="mb-4 text-xl font-black tracking-tight !text-zinc-900">Área VIP: {nomeSetor}</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {listaEspacos.map((espaco) => (
                    <div key={espaco.id} className="flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-6 transition hover:border-indigo-200 shadow-sm">
                      <div className="mb-5 flex items-start justify-between">
                        <div>
                          <p className="mb-0.5 text-xs font-bold text-indigo-600 uppercase tracking-widest">{espaco.tipo}</p>
                          <h3 className="text-2xl font-black !text-zinc-900">{espaco.sigla}</h3>
                        </div>
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black !text-zinc-600">Até {espaco.capacidade}p</span>
                      </div>
                      <div className="mt-2 flex items-end justify-between border-t border-zinc-100 pt-4">
                        <div>
                          <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-zinc-400">Consome R$ {espaco.consumacao.toFixed(2)}</p>
                          <p className="text-2xl font-black !text-zinc-900">R$ {espaco.preco.toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => reservarEspaco(espaco)}
                          disabled={isSubmitting}
                          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-50 active:scale-95"
                        >
                          Reservar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}