import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import { Wine, Clock, ChefHat, Bell, QrCode, ScanLine, CheckCircle2 } from 'lucide-react';
import BottomNav from '../components/BottomNav';

export default function PainelBar() {
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [pedidosFila, setPedidosFila] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('producao'); // 'producao' ou 'leitor'

  // Estados do Scanner
  const [statusLeitura, setStatusLeitura] = useState('aguardando'); 
  const [pedidoLido, setPedidoLido] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!eventoSelecionado) return;
    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      const peds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      peds.sort((a, b) => (a.data ? new Date(a.data).getTime() : 0) - (b.data ? new Date(b.data).getTime() : 0));
      setPedidosFila(peds);
    });
    return () => unsubPedidos();
  }, [eventoSelecionado]);

  // ================= FUNÇÕES DE PRODUÇÃO (KDS) =================
  const atualizarStatus = async (pedidoId, status) => {
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), { status });
      if (status === 'preparando') toast.success("Iniciando preparo!", { icon: '🧑‍🍳' });
      else if (status === 'pronto') toast.success("Pedido pronto!", { icon: '🔔' });
    } catch (error) { toast.error("Erro ao atualizar o pedido."); }
  };

  // ================= FUNÇÕES DO LEITOR DE BALCÃO =================
  const validarFichaBalcao = async (textoQrCode) => {
    if (statusLeitura !== 'aguardando') return;
    setStatusLeitura('processando');

    try {
      const partes = textoQrCode.split('|');
      const tipo = partes[0]; 
      const idItem = partes[1];

      if (tipo !== 'retirada') {
        toast.error('QR Code inválido para o Bar.');
        setStatusLeitura('erro');
        return;
      }

      const docRef = doc(db, 'pedidos', idItem);
      const snap = await getDoc(docRef);
      
      if (!snap.exists()) {
        toast.error('Pedido não encontrado.');
        setStatusLeitura('erro');
        return;
      }

      const pedido = snap.data();
      
      if (pedido.status === 'entregue') {
        toast.error('Esta ficha já foi utilizada!');
        setStatusLeitura('erro');
        return;
      }

      setPedidoLido({ id: snap.id, ...pedido });
      setStatusLeitura('sucesso');
      toast.success('Ficha Válida! Separe as bebidas.');

    } catch (error) {
      toast.error('Erro de conexão.');
      setStatusLeitura('erro');
    }
  };

  const confirmarEntregaBalcao = async () => {
    if (!pedidoLido) return;
    try {
      await updateDoc(doc(db, "pedidos", pedidoLido.id), { status: 'entregue', dataEntrega: new Date().toISOString() });
      toast.success("Bebida entregue ao cliente!");
      setStatusLeitura('aguardando');
      setPedidoLido(null);
    } catch (error) {
      toast.error("Erro ao dar baixa na ficha.");
    }
  };

  // ================= TELA DE SELEÇÃO DE EVENTO =================
  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
        <header className="bg-white px-6 py-8 rounded-b-[2rem] shadow-sm border-b border-zinc-200">
          <h1 className="text-3xl font-black flex items-center gap-2 tracking-tight text-zinc-900"><Wine className="text-indigo-600 w-8 h-8"/> Operação Bar</h1>
          <p className="text-zinc-500 text-sm mt-1 font-bold">Produção KDS e Retirada no Balcão</p>
        </header>
        <main className="max-w-md mx-auto p-6 mt-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Selecione o Evento</h2>
          {eventosGlobais.map(evento => (
            <button key={evento.id} onClick={() => setEventoSelecionado(evento)} className="w-full bg-white border border-zinc-200 p-6 rounded-3xl text-left hover:border-indigo-500 transition-all shadow-sm active:scale-95 mb-3">
              <h3 className="text-xl font-black text-zinc-900">{evento.nome}</h3>
              <p className="text-indigo-600 text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2"><ChefHat className="w-4 h-4"/> Abrir Terminal</p>
            </button>
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  // Apenas pedidos de Mesa vão para a fila da Cozinha (KDS). Balcão é lido na câmera.
  const pendentes = pedidosFila.filter(p => p.tipoEntrega === 'mesa' && (!p.status || p.status === 'pendente'));
  const preparando = pedidosFila.filter(p => p.tipoEntrega === 'mesa' && p.status === 'preparando');

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="font-black text-zinc-900">Operação Bar</h1>
          <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest">{eventoSelecionado.nome}</p>
        </div>
        <button onClick={() => setEventoSelecionado(null)} className="bg-zinc-100 text-zinc-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-zinc-200">Sair</button>
      </header>

      <div className="flex gap-2 px-6 mt-4 max-w-6xl mx-auto">
        <button onClick={() => setAbaAtiva('producao')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'producao' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'}`}>KDS (Mesas)</button>
        <button onClick={() => setAbaAtiva('leitor')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'leitor' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'}`}><QrCode className="w-4 h-4"/> Ler Fichas</button>
      </div>

      <main className="max-w-6xl mx-auto p-6 animate-fade-in">
        
        {/* ================= ABA 1: KDS DE PRODUÇÃO (MESAS) ================= */}
        {abaAtiva === 'producao' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] p-6 border border-zinc-200 shadow-sm">
              <h2 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-6 flex items-center gap-2"><Clock className="w-5 h-5"/> Preparar para Mesas ({pendentes.length})</h2>
              <div className="space-y-4">
                {pendentes.length === 0 && <p className="text-zinc-400 text-sm bg-zinc-50 p-4 rounded-xl text-center font-medium">Fila limpa.</p>}
                {pendentes.map(p => (
                  <div key={p.id} className="bg-zinc-50 border border-zinc-200 p-5 rounded-3xl shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div><span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-3 py-1 rounded-full">{p.mesaSigla || 'Garçom'}</span></div>
                      {p.data && <span className="text-[10px] text-zinc-400 font-mono font-black">{new Date(p.data).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                    </div>
                    <div className="space-y-3 mb-6">
                      {p.itens?.map((item, idx) => (
                        <p key={idx} className="font-black text-lg text-zinc-900 border-b border-zinc-200 pb-3 flex items-start gap-3"><span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-sm border border-indigo-100">{item.quantidade}x</span>{item.nome}</p>
                      ))}
                    </div>
                    <button onClick={() => atualizarStatus(p.id, 'preparando')} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest active:scale-95 shadow-md">Começar Preparo</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 border border-zinc-200 shadow-sm">
              <h2 className="text-sm font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-2"><ChefHat className="w-5 h-5"/> Em Preparo ({preparando.length})</h2>
              <div className="space-y-4">
                {preparando.length === 0 && <p className="text-zinc-400 text-sm bg-zinc-50 p-4 rounded-xl text-center font-medium">Nenhuma bebida na coqueteleira.</p>}
                {preparando.map(p => (
                  <div key={p.id} className="bg-amber-50 border-2 border-amber-300 p-5 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="mb-4"><span className="bg-amber-200 text-amber-800 text-[10px] font-black uppercase px-3 py-1 rounded-full">{p.mesaSigla || 'Garçom'}</span></div>
                    <div className="space-y-3 mb-6 relative z-10">
                      {p.itens?.map((item, idx) => (
                        <p key={idx} className="font-black text-lg text-amber-950 border-b border-amber-200 pb-3 flex items-start gap-3"><span className="bg-amber-200 text-amber-700 px-2 py-1 rounded-lg text-sm">{item.quantidade}x</span>{item.nome}</p>
                      ))}
                    </div>
                    <button onClick={() => atualizarStatus(p.id, 'pronto')} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl text-sm uppercase tracking-widest active:scale-95 shadow-md relative z-10">Finalizar (Chamar Garçom)</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 2: LEITOR DE FICHAS (PISTA) ================= */}
        {abaAtiva === 'leitor' && (
          <div className="flex flex-col items-center justify-center max-w-md mx-auto">
            {statusLeitura === 'aguardando' && (
              <div className="w-full rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative bg-black aspect-square flex items-center justify-center">
                <Scanner 
                  onScan={(result) => validarFichaBalcao(result[0].rawValue)} 
                  formats={['qr_code']} components={{ audio: false, finder: false }} styles={{ video: { objectFit: 'cover' } }}
                />
                <div className="absolute inset-0 border-[40px] border-zinc-900/60 pointer-events-none flex items-center justify-center">
                  <div className="w-full h-full border-2 border-indigo-500/50 rounded-xl"></div>
                </div>
                <p className="absolute bottom-4 bg-white/90 px-4 py-2 rounded-full text-xs font-black text-zinc-900 z-10 shadow-sm">Aponte para a Ficha Digital do Cliente</p>
              </div>
            )}

            {statusLeitura === 'processando' && (
              <div className="text-center animate-pulse py-20">
                <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="font-black text-zinc-400 uppercase tracking-widest">Validando Ficha...</p>
              </div>
            )}

            {statusLeitura === 'erro' && (
              <div className="text-center w-full py-10 animate-slide-up">
                <h2 className="text-3xl font-black text-red-500 mb-2">Ficha Inválida</h2>
                <p className="text-zinc-500 font-medium mb-8">O cliente já retirou ou o código está corrompido.</p>
                <button onClick={() => setStatusLeitura('aguardando')} className="w-full bg-zinc-100 text-zinc-600 font-black py-4 rounded-2xl uppercase tracking-widest active:scale-95">Tentar Novamente</button>
              </div>
            )}

            {statusLeitura === 'sucesso' && pedidoLido && (
              <div className="w-full animate-slide-up">
                <div className="bg-emerald-500 text-white p-6 rounded-t-[2rem] text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-emerald-200" />
                  <h2 className="text-2xl font-black">Ficha Válida!</h2>
                  <p className="text-emerald-100 text-sm font-medium">Faça as bebidas e entregue ao cliente.</p>
                </div>
                <div className="bg-white p-6 rounded-b-[2rem] border-x border-b border-zinc-200 shadow-xl">
                  <ul className="space-y-3 mb-6">
                    {pedidoLido.itens.map((i, idx) => (
                      <li key={idx} className="font-black text-xl text-zinc-900 border-b border-zinc-100 pb-3 flex items-center gap-3">
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-xl">{i.quantidade}x</span> {i.nome}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button onClick={() => { setStatusLeitura('aguardando'); setPedidoLido(null); }} className="flex-1 bg-zinc-100 text-zinc-600 font-black py-4 rounded-xl transition-colors">Cancelar</button>
                    <button onClick={confirmarEntregaBalcao} className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl uppercase tracking-widest shadow-md active:scale-95 transition-transform">Entregar Bebida</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}