import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { ArrowLeft, AlertTriangle, Wine, LogIn } from 'lucide-react';

export default function Cardapio() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const eventoId = location.state?.eventoId;

  const [produtos, setProdutos] = useState([]);
  const [carrinho, setCarrinho] = useState({});
  const [modalCheckout, setModalCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
  const [meusEspacos, setMeusEspacos] = useState([]);
  const [destinoSelecionado, setDestinoSelecionado] = useState('');

  useEffect(() => {
    if (!eventoId) return navigate('/home');

    // 1. Busca o cardápio (PÚBLICO)
    const unsubCardapio = onSnapshot(collection(db, "cardapio"), snap => setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    let unsubDono = () => {};
    let unsubConv = () => {};

    // 2. Busca as mesas APENAS SE o usuário já estiver logado
    if (user) {
      const qDono = query(collection(db, "espacos"), where("eventoId", "==", eventoId), where("donoId", "==", user.uid));
      unsubDono = onSnapshot(qDono, snap => {
        setMeusEspacos(prev => [...prev.filter(p => p.donoId !== user.uid), ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      });
      
      const qConv = query(collection(db, "espacos"), where("eventoId", "==", eventoId), where("convidadosIds", "array-contains", user.uid));
      unsubConv = onSnapshot(qConv, snap => {
        setMeusEspacos(prev => [...prev.filter(p => !p.convidadosIds?.includes(user.uid)), ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      });
    }

    return () => { unsubCardapio(); unsubDono(); unsubConv(); };
  }, [eventoId, navigate, user]);

  const alterarQtd = (produtoId, delta) => {
    const atual = carrinho[produtoId] || 0;
    const novo = Math.max(0, atual + delta);
    if (novo === 0) {
      const copia = { ...carrinho };
      delete copia[produtoId];
      setCarrinho(copia);
    } else setCarrinho({ ...carrinho, [produtoId]: novo });
  };

  const calcularTotal = () => Object.entries(carrinho).reduce((acc, [pId, qtd]) => {
    const prod = produtos.find(p => p.id === pId); return acc + (prod ? prod.preco * qtd : 0);
  }, 0);

  const categorias = ['Todos', ...Array.from(new Set(produtos.map(p => p.categoria || 'Geral'))).sort()];
  const produtosFiltrados = categoriaAtiva === 'Todos' ? produtos : produtos.filter(p => (p.categoria || 'Geral') === categoriaAtiva);

  const temItemVIP = Object.keys(carrinho).some(pId => {
    const prod = produtos.find(p => p.id === pId);
    return prod?.apenasVIP === true; 
  });

  // O "Porteiro" do Checkout
  const abrirCheckout = () => {
    if (!user) {
      toast('Faça login para fazer pedidos!', { icon: '👋' });
      navigate('/login');
      return;
    }
    setDestinoSelecionado(''); 
    setModalCheckout(true);
  };

  const fecharPedido = async () => {
    if (temItemVIP && destinoSelecionado === 'balcao') return toast.error("Este pedido possui bebidas exclusivas para Camarotes.");
    if (!destinoSelecionado) return toast.error("Selecione onde deseja receber o pedido.");

    setIsSubmitting(true);
    const toastId = toast.loading('Enviando pedido para o bar...');

    try {
      const itensFormatados = Object.entries(carrinho).map(([pId, qtd]) => {
        const prod = produtos.find(p => p.id === pId);
        return { produtoId: pId, nome: prod.nome, precoUnitario: prod.preco, quantidade: qtd };
      });

      let mesaSigla = null;
      if (destinoSelecionado !== 'balcao') {
        const espaco = meusEspacos.find(e => e.id === destinoSelecionado);
        mesaSigla = espaco ? espaco.sigla : null;
      }

      await addDoc(collection(db, "pedidos"), {
        eventoId, clienteId: user.uid, clienteNome: user.nome || user.email,
        mesaSigla: mesaSigla, tipoEntrega: destinoSelecionado === 'balcao' ? 'balcao' : 'mesa',
        itens: itensFormatados, total: calcularTotal(),
        status: destinoSelecionado === 'balcao' ? 'pronto' : 'pendente', 
        garcomId: null, data: new Date().toISOString()
      });

      toast.success("Pedido recebido pela cozinha!", { id: toastId });
      setCarrinho({}); setModalCheckout(false); navigate('/minha-conta');
    } catch (e) { 
      toast.error("Erro ao enviar pedido.", { id: toastId }); 
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
      <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-zinc-200">
        <div className="px-6 py-4 flex justify-between items-center">
          <button onClick={() => navigate(-1)} className="bg-zinc-100 p-2 rounded-full active:scale-95 transition-transform"><ArrowLeft className="w-5 h-5"/></button>
          <h1 className="font-black text-lg tracking-tight">Cardápio</h1>
          <div className="w-9"></div>
        </div>
        <div className="px-4 py-3 overflow-x-auto hide-scrollbar flex gap-2">
          {categorias.map(cat => (
            <button key={cat} onClick={() => setCategoriaAtiva(cat)} className={`whitespace-nowrap px-5 py-2 rounded-full text-xs font-black transition-all shadow-sm border ${categoriaAtiva === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-zinc-600 border-zinc-200'}`}>
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4 animate-fade-in">
        {!user && (
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-black text-indigo-900">Modo Visitante</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">Faça login para pedir</p>
            </div>
            <button onClick={() => navigate('/login')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 active:scale-95"><LogIn className="w-3 h-3"/> Entrar</button>
          </div>
        )}

        {produtosFiltrados.length === 0 && <p className="text-center text-zinc-500 py-10 font-bold">Nenhum item nesta categoria.</p>}
        
        {produtosFiltrados.map(produto => (
          <div key={produto.id} className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm flex gap-4 items-center">
            <div className="w-20 h-20 rounded-xl bg-zinc-50 border border-zinc-100 flex-shrink-0 overflow-hidden flex items-center justify-center relative">
              {produto.imagem ? <img src={produto.imagem} alt={produto.nome} className="w-full h-full object-cover" /> : <Wine className="w-6 h-6 text-zinc-300" />}
            </div>
            <div className="flex-1 min-w-0 py-1">
              <p className="font-black text-zinc-900 leading-tight truncate">{produto.nome}</p>
              {produto.descricao && <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 leading-tight">{produto.descricao}</p>}
              <p className="text-indigo-600 font-black text-sm mt-1.5">R$ {produto.preco.toFixed(2)}</p>
            </div>
            <div className="flex flex-col items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-xl p-1 flex-shrink-0">
              <button onClick={() => alterarQtd(produto.id, 1)} className="w-7 h-7 font-black bg-indigo-600 text-white rounded-lg shadow-sm flex items-center justify-center active:scale-95">+</button>
              <span className="w-7 text-center font-black text-xs">{carrinho[produto.id] || 0}</span>
              <button onClick={() => alterarQtd(produto.id, -1)} className="w-7 h-7 font-black bg-white text-zinc-600 rounded-lg shadow-sm border border-zinc-200 flex items-center justify-center active:scale-95">-</button>
            </div>
          </div>
        ))}
      </main>

      {Object.keys(carrinho).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-zinc-200 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] animate-slide-up">
          <div className="max-w-md mx-auto">
            <button onClick={abrirCheckout} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-md flex justify-between px-6 items-center active:scale-95 transition-all">
              <span>{user ? 'Finalizar Pedido' : 'Login para Pedir'}</span>
              <span>R$ {calcularTotal().toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL CHECKOUT ================= */}
      {modalCheckout && user && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[2rem] sm:rounded-3xl p-6 relative shadow-2xl">
            <h3 className="text-xl font-black mb-4">Como deseja receber?</h3>
            {temItemVIP && (
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex gap-3 mb-4 items-start">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-800 font-bold leading-relaxed">Você incluiu Combos/Garrafas. Por segurança, a entrega é exclusiva para Camarotes.</p>
              </div>
            )}
            <div className="space-y-3 mb-6">
              <button onClick={() => !temItemVIP && setDestinoSelecionado('balcao')} disabled={temItemVIP} className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${destinoSelecionado === 'balcao' ? 'border-indigo-600 bg-indigo-50' : temItemVIP ? 'border-zinc-200 bg-zinc-100 opacity-50 cursor-not-allowed' : 'border-zinc-200 bg-white hover:border-indigo-200'}`}>
                <p className="font-black text-zinc-900">Retirar no Balcão</p>
                <p className="text-xs text-zinc-500 font-medium">Bebidas em copos ou latas.</p>
              </button>
              {meusEspacos.map(esp => (
                <button key={esp.id} onClick={() => setDestinoSelecionado(esp.id)} className={`w-full text-left p-4 rounded-2xl border-2 transition-colors ${destinoSelecionado === esp.id ? 'border-indigo-600 bg-indigo-50' : 'border-zinc-200 bg-white hover:border-indigo-200'}`}>
                  <p className="font-black text-zinc-900">Entregar no {esp.sigla}</p>
                  <p className="text-xs text-zinc-500 font-medium">Um garçom levará até sua mesa.</p>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalCheckout(false)} className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black py-4 rounded-xl transition-colors">Voltar</button>
              <button onClick={fecharPedido} disabled={isSubmitting || (temItemVIP && meusEspacos.length === 0)} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-md disabled:opacity-50 transition-all active:scale-95">Confirmar Pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 