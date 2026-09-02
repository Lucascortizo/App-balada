import { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { Wine, ArrowLeft, Search, Send, Bell, CheckCircle, Clock } from 'lucide-react';

export default function PainelGarcom() {
  const { user } = useContext(AuthContext);
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('lancar'); 

  const [produtos, setProdutos] = useState([]);
  const [espacos, setEspacos] = useState([]);
  const [todosPedidos, setTodosPedidos] = useState([]);
  
  const [pesquisa, setPesquisa] = useState('');
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
  const [itensCarrinho, setItensCarrinho] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubEventos = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsubEventos();
  }, []);

  useEffect(() => {
    if (!eventoSelecionado) return;
    const unsubCardapio = onSnapshot(collection(db, "cardapio"), snap => setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // O garçom atende apenas os espaços que já estão reservados por clientes
    const unsubEspacos = onSnapshot(query(collection(db, "espacos"), where("eventoId", "==", eventoSelecionado.id), where("status", "==", "reservado")), snap => setEspacos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      const peds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      peds.sort((a, b) => new Date(b.data) - new Date(a.data));
      setTodosPedidos(peds);
    });

    return () => { unsubCardapio(); unsubEspacos(); unsubPedidos(); };
  }, [eventoSelecionado]);

  // ================= FILTROS INTELIGENTES =================
  const meusPedidos = todosPedidos.filter(p => p.garcomId === user.uid);
  const meusProntos = meusPedidos.filter(p => p.status === 'pronto');
  const meusAndamento = meusPedidos.filter(p => p.status === 'pendente' || p.status === 'preparando');

  // Pedidos Órfãos (Feitos pelo App do Cliente para entrega em Mesa) que o Bar já terminou!
  const entregasDoApp = todosPedidos.filter(p => p.status === 'pronto' && !p.garcomId && p.tipoEntrega === 'mesa');

  const alterarQtd = (produtoId, delta) => {
    const atual = itensCarrinho[produtoId] || 0;
    const novo = Math.max(0, atual + delta);
    if (novo === 0) { 
      const copia = { ...itensCarrinho }; delete copia[produtoId]; setItensCarrinho(copia);
    } else setItensCarrinho({ ...itensCarrinho, [produtoId]: novo });
  };

  const enviarParaBar = async () => {
    if (!mesaSelecionada || Object.keys(itensCarrinho).length === 0) {
      return toast.error("Selecione a mesa e adicione bebidas ao carrinho.");
    }
    
    setIsSubmitting(true);
    const toastId = toast.loading('Enviando para a cozinha...');

    try {
      const total = Object.entries(itensCarrinho).reduce((acc, [pId, qtd]) => acc + (produtos.find(p => p.id === pId)?.preco * qtd || 0), 0);
      const itensFormatados = Object.entries(itensCarrinho).map(([pId, qtd]) => ({ 
        produtoId: pId, 
        nome: produtos.find(p => p.id === pId).nome, 
        precoUnitario: produtos.find(p => p.id === pId).preco, 
        quantidade: qtd 
      }));

      await addDoc(collection(db, "pedidos"), {
        eventoId: eventoSelecionado.id,
        clienteId: mesaSelecionada.donoId,
        clienteNome: mesaSelecionada.donoNome || mesaSelecionada.sigla,
        mesaSigla: mesaSelecionada.sigla,
        tipoEntrega: 'mesa',
        itens: itensFormatados,
        total,
        status: 'pendente', 
        garcomId: user.uid,
        garcomNome: user.nome || user.email,
        data: new Date().toISOString()
      });

      toast.success("Pedido enviado para o bar!", { id: toastId });
      setItensCarrinho({}); 
      setMesaSelecionada(null); 
      setAbaAtiva('meus_pedidos');
    } catch (e) { 
      toast.error("Erro ao enviar pedido.", { id: toastId }); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const confirmarEntrega = async (pedidoId) => {
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), { 
        status: 'entregue',
        garcomId: user.uid, // Assina a entrega caso seja do App do Cliente
        garcomNome: user.nome || user.email
      });
      toast.success("Entrega confirmada com sucesso!");
    } catch (error) {
      toast.error("Erro ao confirmar entrega.");
    }
  };

  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
        <header className="bg-zinc-900 text-white px-6 py-8 rounded-b-[2rem] shadow-md">
          <h1 className="text-2xl font-black mb-2 flex items-center gap-2"><Wine className="w-6 h-6 text-indigo-400" /> Operação Garçom</h1>
          <p className="text-xs font-bold text-zinc-400">Atendimento de mesas e camarotes.</p>
        </header>
        <main className="max-w-md mx-auto p-6 mt-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Selecione o Evento</h2>
          {eventosGlobais.map(e => (
            <button key={e.id} onClick={() => setEventoSelecionado(e)} className="w-full bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm hover:border-indigo-500 mb-3 text-left transition-colors">
              <h3 className="text-lg font-black">{e.nome}</h3>
              <p className="text-xs text-indigo-600 font-bold mt-1 uppercase tracking-widest">Iniciar Atendimento</p>
            </button>
          ))}
        </main>
      </div>
    );
  }

  const notificacoesTotal = meusProntos.length + entregasDoApp.length;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32">
      <header className="sticky top-0 z-40 bg-zinc-900 text-white shadow-md">
        <div className="px-6 py-4 flex justify-between items-center">
          <button onClick={() => setEventoSelecionado(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <p className="font-black text-indigo-400 text-sm">Terminal Garçom</p>
          <div className="w-8"></div>
        </div>
        <div className="flex px-4 gap-2">
          <button onClick={() => setAbaAtiva('lancar')} className={`flex-1 py-3 border-b-2 text-xs font-black uppercase tracking-widest transition-colors ${abaAtiva === 'lancar' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}>Lançar</button>
          <button onClick={() => setAbaAtiva('meus_pedidos')} className={`flex-1 py-3 border-b-2 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${abaAtiva === 'meus_pedidos' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-zinc-400 hover:text-white'}`}>
            Entregas {notificacoesTotal > 0 && <span className="bg-red-500 text-white px-1.5 rounded-full animate-pulse">{notificacoesTotal}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        
        {/* ABA 1: LANÇAR PEDIDO */}
        {abaAtiva === 'lancar' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white p-5 rounded-[2rem] border border-zinc-200 shadow-sm">
              <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">1. Destino do Pedido</h2>
              <div className="grid grid-cols-3 gap-3">
                {espacos.length === 0 && <p className="col-span-3 text-xs text-zinc-400 text-center py-4 bg-zinc-50 rounded-xl">Nenhuma mesa ocupada.</p>}
                {espacos.map(e => (
                  <button 
                    key={e.id} 
                    onClick={() => setMesaSelecionada(e)} 
                    className={`p-3 rounded-2xl border text-center transition-all ${mesaSelecionada?.id === e.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white text-zinc-900 border-zinc-200 hover:border-indigo-300'}`}
                  >
                    <p className="font-black text-lg leading-none">{e.sigla}</p>
                    <p className="text-[10px] mt-1 truncate max-w-full font-bold opacity-80">{e.donoNome?.split(' ')[0]}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-zinc-200 shadow-sm">
              <div className="relative mb-4">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" placeholder="Buscar bebida..." value={pesquisa} onChange={e => setPesquisa(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 pl-10 pr-4 text-sm font-bold outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2 hide-scrollbar">
                {produtos.filter(p => p.nome.toLowerCase().includes(pesquisa.toLowerCase())).map(produto => (
                  <div key={produto.id} className="flex justify-between items-center p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                    <div>
                      <p className="font-black text-sm text-zinc-900">{produto.nome}</p>
                      <p className="text-indigo-600 font-bold text-xs mt-0.5">R$ {produto.preco.toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-zinc-200 shadow-sm">
                      <button onClick={() => alterarQtd(produto.id, -1)} className="w-8 h-8 font-black bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-md transition-colors">-</button>
                      <span className="w-5 text-center font-black text-sm">{itensCarrinho[produto.id] || 0}</span>
                      <button onClick={() => alterarQtd(produto.id, 1)} className="w-8 h-8 font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {mesaSelecionada && Object.keys(itensCarrinho).length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-50 animate-slide-up">
                <button onClick={enviarParaBar} disabled={isSubmitting} className="w-full max-w-xl mx-auto bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-md uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                  <Send className="w-4 h-4"/> {isSubmitting ? 'Enviando...' : 'Enviar Pedido para o Bar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: ACOMPANHAR E ENTREGAR */}
        {abaAtiva === 'meus_pedidos' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* RADAR DE PEDIDOS DO APLICATIVO DO CLIENTE */}
            {entregasDoApp.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-300 p-5 rounded-[2rem] shadow-sm">
                <h2 className="text-xs font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-2"><Bell className="w-4 h-4 animate-bounce"/> Retirar no Bar (Pediram pelo App)</h2>
                {entregasDoApp.map(p => (
                  <div key={p.id} className="bg-white border border-orange-200 p-4 rounded-2xl mb-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-black text-zinc-900 text-lg">Mesa: {p.mesaSigla}</p>
                      <span className="text-[10px] uppercase font-black tracking-widest bg-orange-100 text-orange-700 px-2 py-1 rounded">App</span>
                    </div>
                    <ul className="mb-4 space-y-1">
                      {p.itens.map((i, idx) => <li key={idx} className="font-bold text-zinc-600 text-sm"><span className="text-orange-500 mr-1">{i.quantidade}x</span>{i.nome}</li>)}
                    </ul>
                    <button onClick={() => confirmarEntrega(p.id)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-colors active:scale-95">Confirmar Entrega na Mesa</button>
                  </div>
                ))}
              </div>
            )}

            {/* PEDIDOS LANÇADOS PELO PRÓPRIO GARÇOM (PRONTOS) */}
            {meusProntos.length > 0 && (
              <div>
                <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Meus Pedidos Prontos (No Bar)</h2>
                {meusProntos.map(p => (
                  <div key={p.id} className="bg-emerald-50 border-2 border-emerald-400 p-5 rounded-[2rem] mb-3 shadow-sm">
                    <p className="font-black text-emerald-800 text-xl mb-3">Mesa: {p.mesaSigla}</p>
                    <ul className="mb-4 space-y-1">
                      {p.itens.map((i, idx) => <li key={idx} className="font-bold text-emerald-900 text-sm"><span className="text-emerald-600 mr-1">{i.quantidade}x</span>{i.nome}</li>)}
                    </ul>
                    <button onClick={() => confirmarEntrega(p.id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-black text-sm uppercase tracking-widest transition-colors active:scale-95">Confirmar Entrega</button>
                  </div>
                ))}
              </div>
            )}

            {/* PEDIDOS LANÇADOS PELO PRÓPRIO GARÇOM (NA FILA DO BAR) */}
            <div>
              <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Clock className="w-4 h-4"/> Sendo Preparados pelo Bar</h2>
              {meusAndamento.length === 0 && <p className="text-sm text-zinc-400 italic bg-white p-4 rounded-xl border border-zinc-200 text-center">Você não tem nenhum pedido na fila do bar.</p>}
              {meusAndamento.map(p => (
                <div key={p.id} className="bg-white border border-zinc-200 p-4 rounded-2xl mb-3 opacity-70">
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-black text-zinc-800 text-base">{p.mesaSigla}</p>
                    <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded ${p.status === 'preparando' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-600'}`}>{p.status}</span>
                  </div>
                  <ul className="space-y-1">
                    {p.itens.map((i, idx) => <li key={idx} className="font-bold text-zinc-500 text-sm"><span className="text-zinc-400 mr-1">{i.quantidade}x</span>{i.nome}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}