import { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import toast from 'react-hot-toast';
import { Wine, ArrowLeft, Search, Send, Bell, CheckCircle, Clock, LogOut } from 'lucide-react';

export default function PainelGarcom() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
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
    
    const unsubEspacos = onSnapshot(query(collection(db, "espacos"), where("eventoId", "==", eventoSelecionado.id), where("status", "==", "reservado")), snap => setEspacos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      const peds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      peds.sort((a, b) => new Date(b.data) - new Date(a.data));
      setTodosPedidos(peds);
    });

    return () => { unsubCardapio(); unsubEspacos(); unsubPedidos(); };
  }, [eventoSelecionado]);

  // ================= FUNÇÃO DE LOGOUT =================
  const sairDaConta = async () => {
    await logout();
    navigate('/login');
  };

  // ================= FILTROS E CÁLCULOS INTELIGENTES =================
  const meusPedidos = todosPedidos.filter(p => p.garcomId === user?.uid);
  const meusProntos = meusPedidos.filter(p => p.status === 'pronto');
  const meusAndamento = meusPedidos.filter(p => p.status === 'pendente' || p.status === 'preparando');

  const entregasDoApp = todosPedidos.filter(p => p.status === 'pronto' && !p.garcomId && p.tipoEntrega === 'mesa');

  const alterarQtd = (produtoId, delta) => {
    const atual = itensCarrinho[produtoId] || 0;
    const novo = Math.max(0, atual + delta);
    if (novo === 0) { 
      const copia = { ...itensCarrinho }; delete copia[produtoId]; setItensCarrinho(copia);
    } else setItensCarrinho({ ...itensCarrinho, [produtoId]: novo });
  };

  // Calcula quanto uma mesa específica já gastou (somando todos os pedidos dela)
  const calcularGastoDaMesa = (sigla) => {
    return todosPedidos
      .filter(p => p.mesaSigla === sigla)
      .reduce((acc, p) => acc + (p.total || 0), 0);
  };

  const enviarParaBar = async () => {
    if (!mesaSelecionada || Object.keys(itensCarrinho).length === 0) {
      return toast.error("Selecione a mesa e adicione bebidas ao carrinho.");
    }
    
    setIsSubmitting(true);
    const toastId = toast.loading('Enviando para a cozinha...');

    try {
      const itensFormatados = Object.entries(itensCarrinho).map(([pId, qtd]) => {
        const prod = produtos.find(p => p.id === pId);
        return { 
          produtoId: pId, 
          nome: prod?.nome || 'Produto Avulso', 
          precoUnitario: Number(prod?.preco) || 0, 
          quantidade: Number(qtd) || 1
        };
      });

      const totalCalculado = itensFormatados.reduce((acc, item) => acc + (item.precoUnitario * item.quantidade), 0);

      await addDoc(collection(db, "pedidos"), {
        eventoId: eventoSelecionado?.id || 'evento_desconhecido',
        clienteId: mesaSelecionada?.donoId || 'cliente_avulso',
        clienteNome: mesaSelecionada?.donoNome || mesaSelecionada?.sigla || 'Mesa VIP',
        mesaSigla: mesaSelecionada?.sigla || 'Mesa',
        tipoEntrega: 'mesa',
        itens: itensFormatados,
        total: totalCalculado || 0,
        status: 'pendente', 
        garcomId: user?.uid || 'id_nao_encontrado',
        garcomNome: user?.nome || user?.email || 'Garçom',
        data: new Date().toISOString()
      });

      toast.success("Pedido enviado para o bar!", { id: toastId });
      setItensCarrinho({}); 
      setMesaSelecionada(null); 
      setAbaAtiva('meus_pedidos');
    } catch (e) { 
      console.error(e);
      toast.error("Erro ao enviar. Tente novamente.", { id: toastId }); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const confirmarEntrega = async (pedidoId) => {
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), { 
        status: 'entregue',
        garcomId: user?.uid || '', 
        garcomNome: user?.nome || user?.email || 'Garçom'
      });
      toast.success("Entrega confirmada com sucesso!");
    } catch (error) {
      toast.error("Erro ao confirmar entrega.");
    }
  };

  // Trava de segurança no carrinho flutuante
  const valorTotalCarrinho = Object.entries(itensCarrinho).reduce((acc, [pId, qtd]) => {
    const prod = produtos.find(p => p.id === pId);
    return acc + ((Number(prod?.preco) || 0) * qtd);
  }, 0);

  // Cálculos visuais para o saldo do carrinho flutuante
  const gastoAtualMesa = mesaSelecionada ? calcularGastoDaMesa(mesaSelecionada.sigla) : 0;
  const saldoMesa = (mesaSelecionada?.consumacao > 0) ? (mesaSelecionada.consumacao - gastoAtualMesa) : null;
  const saldoAposPedido = saldoMesa !== null ? saldoMesa - valorTotalCarrinho : null;

  // ================= TELA 1: SELECIONAR EVENTO =================
  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
        <header className="bg-white border-b border-zinc-200 px-6 py-6 shadow-sm sticky top-0 z-40">
          <div className="w-full 2xl:max-w-[1600px] mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black mb-1 flex items-center gap-2 !text-zinc-900">
                <Wine className="w-6 h-6 text-indigo-600" /> Operação Garçom
              </h1>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Atendimento de mesas e VIPs</p>
            </div>
            <button 
              onClick={sairDaConta} 
              className="p-3 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors"
              title="Sair / Encerrar Turno"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>
        
        <main className="w-full 2xl:max-w-[1600px] mx-auto p-6 mt-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">Selecione o Evento Ativo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {eventosGlobais.map(e => (
              <button 
                key={e.id} 
                onClick={() => setEventoSelecionado(e)} 
                className="w-full bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-left group"
              >
                <h3 className="text-xl font-black !text-zinc-900 group-hover:text-indigo-600 transition-colors leading-tight">{e.nome}</h3>
                <p className="text-xs text-indigo-500 font-bold mt-3 uppercase tracking-widest flex items-center gap-1.5">
                  Iniciar Atendimento <ArrowLeft className="w-3 h-3 rotate-180" />
                </p>
              </button>
            ))}
            {eventosGlobais.length === 0 && (
              <p className="col-span-full text-zinc-400 text-sm font-medium py-10 text-center">Não há eventos ativos no momento.</p>
            )}
          </div>
        </main>

        <BottomNav />
      </div>
    );
  }

  // ================= TELA 2: OPERAÇÃO DO GARÇOM =================
  const notificacoesTotal = meusProntos.length + entregasDoApp.length;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-zinc-900 pb-32 relative">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
        <div className="w-full 2xl:max-w-[1600px] mx-auto">
          <div className="px-6 py-4 flex justify-between items-center border-b border-zinc-100">
            <button onClick={() => setEventoSelecionado(null)} className="p-2 bg-zinc-50 text-zinc-600 rounded-full hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="font-black text-zinc-900 text-sm sm:text-base uppercase tracking-widest flex items-center gap-2">
              <Wine className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600"/> Terminal Garçom
            </p>
            <button onClick={sairDaConta} className="p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          <div className="flex px-4 gap-2 bg-zinc-50/50">
            <button onClick={() => setAbaAtiva('lancar')} className={`flex-1 py-4 border-b-2 text-xs font-black uppercase tracking-widest transition-colors ${abaAtiva === 'lancar' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>Lançar Pedido</button>
            <button onClick={() => setAbaAtiva('meus_pedidos')} className={`flex-1 py-4 border-b-2 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${abaAtiva === 'meus_pedidos' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}>
              Minhas Entregas {notificacoesTotal > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">{notificacoesTotal}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full 2xl:max-w-[1600px] mx-auto p-4 sm:p-6 space-y-6">
        
        {/* ABA 1: LANÇAR PEDIDO */}
        {abaAtiva === 'lancar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 animate-fade-in">
            
            {/* Lado Esquerdo (Mesas) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
                <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">1. Destino do Pedido</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {espacos.length === 0 && <p className="col-span-full text-xs font-bold text-zinc-400 text-center py-6 bg-zinc-50 rounded-2xl border border-dashed border-zinc-300">Nenhuma mesa ou camarote ocupado no sistema.</p>}
                  
                  {espacos.map(e => {
                  const isSelected = mesaSelecionada?.id === e.id;
                  const gastoMesa = calcularGastoDaMesa(e.sigla);
                  const temConsumacao = e.consumacao > 0;
                  const consumacaoRestante = Math.max(0, e.consumacao - gastoMesa);
                  const gastoExtra = Math.max(0, gastoMesa - e.consumacao);
                                  
                  return (
                    <button 
                      key={e.id} 
                      onClick={() => setMesaSelecionada(e)} 
                      className={`p-4 rounded-2xl border text-left transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105' : 'bg-white text-zinc-900 border-zinc-200 hover:border-indigo-300'}`}
                    >
                      <p className="font-black text-xl leading-none">{e.sigla}</p>
                      <p className="text-[10px] mt-1.5 mb-2 truncate max-w-full font-bold opacity-80 uppercase tracking-widest">{e.donoNome?.split(' ')[0]}</p>
                      
                      {temConsumacao ? (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          <div className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${isSelected ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                            Bônus R$ {consumacaoRestante.toFixed(2)}
                          </div>
                          {gastoExtra > 0 && (
                            <div className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
                              Extra R$ {gastoExtra.toFixed(2)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`text-[9px] font-black inline-block px-2 py-1 rounded-md uppercase tracking-widest ${isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'}`}>
                          Comanda R$ {gastoMesa.toFixed(2)}
                        </div>
                      )}
                    </button>
                  )
                })}
                </div>
              </div>
            </div>

            {/* Lado Direito (Cardápio) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
                <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6">2. Adicionar Bebidas</h2>
                <div className="relative mb-6">
                  <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input type="text" placeholder="Buscar bebida..." value={pesquisa} onChange={e => setPesquisa(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-indigo-500 transition-colors !text-zinc-900" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 hide-scrollbar">
                  {produtos.filter(p => p.nome.toLowerCase().includes(pesquisa.toLowerCase())).map(produto => (
                    <div key={produto.id} className="flex justify-between items-center p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 hover:bg-white transition-colors">
                      <div className="flex-1 pr-2">
                        <p className="font-black text-sm !text-zinc-900 leading-tight mb-1">{produto.nome}</p>
                        <p className="text-indigo-600 font-bold text-xs">R$ {produto.preco.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white rounded-xl p-1.5 border border-zinc-200 shadow-sm">
                        <button onClick={() => alterarQtd(produto.id, -1)} className="w-8 h-8 flex items-center justify-center font-black bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-colors">-</button>
                        <span className="w-6 text-center font-black text-sm !text-zinc-900">{itensCarrinho[produto.id] || 0}</span>
                        <button onClick={() => alterarQtd(produto.id, 1)} className="w-8 h-8 flex items-center justify-center font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">+</button>
                      </div>
                    </div>
                  ))}
                  {produtos.length === 0 && <p className="col-span-full text-zinc-400 font-medium text-sm py-4">Nenhum produto cadastrado no cardápio.</p>}
                </div>
              </div>
            </div>

            {/* CARRINHO FLUTUANTE DE PEDIDO */}
            {mesaSelecionada && Object.keys(itensCarrinho).length > 0 && (
              <div className="fixed bottom-20 sm:bottom-24 md:bottom-10 left-0 right-0 p-4 z-50 pointer-events-none flex justify-center animate-slide-up">
                <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-4 sm:p-5 rounded-[2rem] pointer-events-auto flex justify-between items-center gap-4">
                  <div className="pl-2 sm:pl-4 flex items-center gap-4">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">Total para a {mesaSelecionada.sigla}</p>
                      <p className="font-black text-2xl sm:text-3xl text-white">R$ {valorTotalCarrinho.toFixed(2)}</p>
                    </div>
                    
                    {/* Aviso visual de Saldo Restante no Carrinho Flutuante */}
                    {saldoAposPedido !== null && (
                      <div className="hidden sm:block border-l border-zinc-700 pl-4 ml-2">
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-0.5">Saldo Final</p>
                        <p className={`font-black text-sm ${saldoAposPedido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          R$ {saldoAposPedido.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>

                  <button onClick={enviarParaBar} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-6 sm:px-8 rounded-2xl shadow-md uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                    <Send className="w-4 h-4"/> {isSubmitting ? 'Enviando' : 'Confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 2: ACOMPANHAR E ENTREGAR */}
        {abaAtiva === 'meus_pedidos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 animate-fade-in items-start">
            
            {/* Coluna 1: RADAR DE PEDIDOS DO APLICATIVO DO CLIENTE */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-orange-600 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-orange-200">
                <Bell className="w-4 h-4 animate-bounce"/> App Cliente (Prontos)
              </h2>
              {entregasDoApp.length === 0 && <p className="text-sm text-zinc-400 font-medium py-4">Sem entregas do App pendentes.</p>}
              
              {entregasDoApp.map(p => (
                <div key={p.id} className="bg-orange-50 border-2 border-orange-300 p-5 rounded-[2rem] shadow-sm">
                  <div className="flex justify-between items-start mb-4 border-b border-orange-200/50 pb-3">
                    <div>
                      <p className="text-[10px] uppercase font-black text-orange-500 tracking-widest">Entregar em Mesa</p>
                      <p className="font-black text-zinc-900 text-2xl leading-none mt-1">{p.mesaSigla}</p>
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest bg-orange-200 text-orange-800 px-2.5 py-1 rounded-md">App</span>
                  </div>
                  <ul className="mb-5 space-y-1.5">
                    {p.itens.map((i, idx) => <li key={idx} className="font-bold text-zinc-700 text-sm flex items-center"><span className="text-orange-600 font-black mr-2 bg-orange-100 px-1.5 py-0.5 rounded">{i.quantidade}x</span>{i.nome}</li>)}
                  </ul>
                  <button onClick={() => confirmarEntrega(p.id)} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors active:scale-95 shadow-sm">Assumir e Entregar</button>
                </div>
              ))}
            </div>

            {/* Coluna 2: PEDIDOS LANÇADOS PELO PRÓPRIO GARÇOM (PRONTOS) */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-emerald-200">
                <CheckCircle className="w-4 h-4"/> Meus Pedidos Prontos
              </h2>
              {meusProntos.length === 0 && <p className="text-sm text-zinc-400 font-medium py-4">Sem pedidos aguardando retirada.</p>}
              
              {meusProntos.map(p => (
                <div key={p.id} className="bg-emerald-50 border-2 border-emerald-400 p-5 rounded-[2rem] shadow-sm">
                  <div className="mb-4 border-b border-emerald-200/50 pb-3">
                    <p className="text-[10px] uppercase font-black text-emerald-600 tracking-widest">Seu Pedido - Mesa</p>
                    <p className="font-black text-emerald-900 text-2xl leading-none mt-1">{p.mesaSigla}</p>
                  </div>
                  <ul className="mb-5 space-y-1.5">
                    {p.itens.map((i, idx) => <li key={idx} className="font-bold text-emerald-900 text-sm flex items-center"><span className="text-emerald-700 font-black mr-2 bg-emerald-100 px-1.5 py-0.5 rounded">{i.quantidade}x</span>{i.nome}</li>)}
                  </ul>
                  <button onClick={() => confirmarEntrega(p.id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-colors active:scale-95 shadow-sm">Confirmar Entrega</button>
                </div>
              ))}
            </div>

            {/* Coluna 3: PEDIDOS LANÇADOS PELO PRÓPRIO GARÇOM (NA FILA DO BAR) */}
            <div className="space-y-4">
              <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2 pb-2 border-b border-zinc-200">
                <Clock className="w-4 h-4"/> Na Fila da Cozinha / Bar
              </h2>
              {meusAndamento.length === 0 && <p className="text-sm text-zinc-400 font-medium py-4">Nenhum pedido na fila.</p>}
              
              {meusAndamento.map(p => (
                <div key={p.id} className="bg-white border border-zinc-200 p-5 rounded-[2rem] shadow-sm">
                  <div className="flex justify-between items-center mb-4 border-b border-zinc-100 pb-3">
                    <div>
                      <p className="text-[10px] uppercase font-black text-zinc-400 tracking-widest">Mesa</p>
                      <p className="font-black text-zinc-900 text-xl leading-none mt-1">{p.mesaSigla}</p>
                    </div>
                    <span className={`text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-md ${p.status === 'preparando' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-zinc-100 text-zinc-500 border border-zinc-200'}`}>
                      {p.status}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {p.itens.map((i, idx) => <li key={idx} className="font-bold text-zinc-500 text-sm flex items-center"><span className="text-zinc-400 font-black mr-2 bg-zinc-100 px-1.5 py-0.5 rounded">{i.quantidade}x</span>{i.nome}</li>)}
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