import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, runTransaction, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, AlertTriangle, Wine, LogIn, Minus, Plus, ShieldAlert } from 'lucide-react';

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

  // Estados da Trava de Entrada (Check-in obrigatório)
  const [verificandoAcesso, setVerificandoAcesso] = useState(true);
  const [temAcesso, setTemAcesso] = useState(false);

  useEffect(() => {
    if (!eventoId) return navigate('/home');

    const validarAcessoNaPortaria = async () => {
      if (!user) {
        setVerificandoAcesso(false);
        setTemAcesso(false);
        return;
      }

      try {
        // 1. Verifica se tem ingresso usado (check-in feito na portaria)
        const qIngressos = query(
          collection(db, 'ingressos_vendidos'),
          where('eventoId', '==', eventoId),
          where('donoId', '==', user.uid),
          where('status', '==', 'usado')
        );
        const snapIngressos = await getDocs(qIngressos);

        // 2. Verifica se tem camarote/mesa com checkin ou reserva ativa
        const qEspacosDono = query(
          collection(db, 'espacos'),
          where('eventoId', '==', eventoId),
          where('donoId', '==', user.uid),
          where('status', '==', 'reservado')
        );
        const snapEspacos = await getDocs(qEspacosDono);

        if (!snapIngressos.empty || !snapEspacos.empty) {
          setTemAcesso(true);
        } else {
          setTemAcesso(false);
        }
      } catch (e) {
        console.error("Erro ao validar acesso:", e);
        setTemAcesso(false);
      } finally {
        setVerificandoAcesso(false);
      }
    };

    validarAcessoNaPortaria();

    const unsubCardapio = onSnapshot(collection(db, 'cardapio'), (snap) =>
      setProdutos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    let unsubDono = () => {};
    let unsubConv = () => {};

    if (user) {
      const qDono = query(collection(db, 'espacos'), where('eventoId', '==', eventoId), where('donoId', '==', user.uid));
      unsubDono = onSnapshot(qDono, (snap) => {
        setMeusEspacos((prev) => [...prev.filter((p) => p.donoId !== user.uid), ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))]);
      });

      const qConv = query(collection(db, 'espacos'), where('eventoId', '==', eventoId), where('convidadosIds', 'array-contains', user.uid));
      unsubConv = onSnapshot(qConv, (snap) => {
        setMeusEspacos((prev) => [...prev.filter((p) => !p.convidadosIds?.includes(user.uid)), ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))]);
      });
    }

    return () => { unsubCardapio(); unsubDono(); unsubConv(); };
  }, [eventoId, navigate, user]);

  const alterarQtd = (produtoId, delta) => {
    const atual = carrinho[produtoId] || 0;
    const novo = Math.max(0, atual + delta);
    
    const prod = produtos.find(p => p.id === produtoId);
    if (prod && novo > prod.estoque) {
      toast.error(`Apenas ${prod.estoque} unidades disponíveis.`);
      return;
    }

    if (novo === 0) {
      const copia = { ...carrinho };
      delete copia[produtoId];
      setCarrinho(copia);
    } else setCarrinho({ ...carrinho, [produtoId]: novo });
  };

  const calcularTotal = () =>
    Object.entries(carrinho).reduce((acc, [pId, qtd]) => {
      const prod = produtos.find((p) => p.id === pId);
      return acc + (prod ? prod.preco * qtd : 0);
    }, 0);

  const categorias = ['Todos', ...Array.from(new Set(produtos.map((p) => p.categoria || 'Geral'))).sort()];
  const produtosFiltrados = categoriaAtiva === 'Todos' ? produtos : produtos.filter((p) => (p.categoria || 'Geral') === categoriaAtiva);

  const temItemVIP = Object.keys(carrinho).some((pId) => produtos.find((p) => p.id === pId)?.apenasVIP === true);

  const abrirCheckout = () => {
    if (!user) {
      toast('Faça login para fazer pedidos.', { icon: '👋' });
      navigate('/login', { state: { returnTo: '/cardapio', eventoId } });
      return;
    }
    setDestinoSelecionado('');
    setModalCheckout(true);
  };

  const fecharPedido = async () => {
    if (temItemVIP && destinoSelecionado === 'balcao') return toast.error('Este pedido tem itens exclusivos de camarote.');
    if (!destinoSelecionado) return toast.error('Selecione onde deseja receber o pedido.');

    setIsSubmitting(true);
    const toastId = toast.loading('Processando pedido no caixa...');

    try {
      let mesaSigla = null;
      if (destinoSelecionado !== 'balcao') {
        const espaco = meusEspacos.find((e) => e.id === destinoSelecionado);
        mesaSigla = espaco ? espaco.sigla : null;
      }

      await runTransaction(db, async (transaction) => {
        const leiturasEstoque = [];
        for (const [pId, qtdDesejada] of Object.entries(carrinho)) {
          const docRef = doc(db, 'cardapio', pId);
          const docSnap = await transaction.get(docRef);
          
          if (!docSnap.exists()) throw new Error(`O produto não existe mais no cardápio.`);
          
          const estoqueReal = docSnap.data().estoque;
          if (estoqueReal < qtdDesejada) {
             throw new Error(`Estoque esgotado para o item: ${docSnap.data().nome}. Temos apenas ${estoqueReal} unidades.`);
          }
          
          leiturasEstoque.push({ ref: docRef, estoqueAtual: estoqueReal, subtracao: qtdDesejada });
        }

        for (const item of leiturasEstoque) {
          transaction.update(item.ref, { estoque: item.estoqueAtual - item.subtracao });
        }

        const itensFormatados = Object.entries(carrinho).map(([pId, qtd]) => {
          const prod = produtos.find((p) => p.id === pId);
          return { produtoId: pId, nome: prod.nome, precoUnitario: prod.preco, quantidade: qtd };
        });

        const novoPedidoRef = doc(collection(db, 'pedidos'));
        transaction.set(novoPedidoRef, {
          eventoId,
          clienteId: user.uid,
          clienteNome: user.nome || user.email,
          mesaSigla,
          tipoEntrega: destinoSelecionado === 'balcao' ? 'balcao' : 'mesa',
          itens: itensFormatados,
          total: calcularTotal(),
          status: destinoSelecionado === 'balcao' ? 'pronto' : 'pendente',
          garcomId: null,
          data: new Date().toISOString(),
        });
      });

      toast.success('Pedido recebido pela cozinha!', { id: toastId });
      setCarrinho({});
      setModalCheckout(false);
      navigate('/minha-conta');
      
    } catch (e) {
      toast.error(e.message || 'Erro ao processar pedido.', { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verificandoAcesso) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  // TELA DE BLOQUEIO: Se o usuário não fez check-in na portaria
  if (!temAcesso) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between p-6 text-zinc-900">
        <header className="flex items-center">
          <button onClick={() => navigate(-1)} className="rounded-full bg-zinc-100 p-2 transition hover:bg-zinc-200">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </header>

        <main className="mx-auto max-w-sm text-center py-10">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border-8 border-amber-100/50">
            <ShieldAlert className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="text-2xl font-black !text-zinc-900 mb-3 tracking-tight">Acesso ao Bar Bloqueado</h1>
          <p className="text-sm font-medium text-zinc-500 leading-relaxed mb-8">
            {!user 
              ? 'Você precisa estar logado e ter feito o check-in na portaria do evento para acessar o cardápio.'
              : 'O cardápio digital só é liberado após a leitura do seu QR Code de entrada (check-in) na portaria do evento.'}
          </p>
          {!user ? (
            <button onClick={() => navigate('/login', { state: { returnTo: '/cardapio', eventoId } })} className="w-full rounded-2xl bg-indigo-600 py-4 font-black text-white shadow-md transition hover:bg-indigo-700">
              Fazer Login
            </button>
          ) : (
            <button onClick={() => navigate('/minha-conta')} className="w-full rounded-2xl bg-zinc-900 py-4 font-black text-white shadow-md transition hover:bg-zinc-800">
              Ver Meus Ingressos
            </button>
          )}
        </main>

        <div />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32 text-zinc-900">
      <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>

      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 py-4">
          <button onClick={() => navigate(-1)} className="rounded-full bg-zinc-100 p-2 transition hover:bg-zinc-200">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-semibold tracking-tight">Cardápio</h1>
          <div className="w-9" />
        </div>
        <div className="hide-scrollbar flex gap-2 overflow-x-auto px-6 pb-4">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                categoriaAtiva === cat 
                  ? 'bg-zinc-900 text-white shadow-md' 
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-6">
        {produtosFiltrados.length === 0 && (
          <div className="py-16 text-center">
            <Wine className="mx-auto h-10 w-10 text-zinc-300 mb-3" strokeWidth={1.5} />
            <p className="font-medium text-zinc-500">Nenhum item nesta categoria.</p>
          </div>
        )}

        {produtosFiltrados.map((produto) => (
          <div key={produto.id} className="flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-indigo-100 hover:shadow-md">
            <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50">
              {produto.imagem ? <img src={produto.imagem} alt={produto.nome} className="h-full w-full object-cover" /> : <Wine className="h-8 w-8 text-zinc-300" strokeWidth={1.5} />}
            </div>
            
            <div className="min-w-0 flex-1 py-1">
              <p className="truncate text-base font-semibold leading-tight text-zinc-900">{produto.nome}</p>
              {produto.descricao && <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-zinc-500">{produto.descricao}</p>}
              <p className="mt-2 text-sm font-bold text-indigo-600">R$ {produto.preco.toFixed(2)}</p>
            </div>
            
            <div className="flex flex-shrink-0 flex-col items-center gap-1 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-1.5 shadow-sm">
              <button onClick={() => alterarQtd(produto.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-800 active:scale-95">
                <Plus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-xs font-bold text-zinc-900">{carrinho[produto.id] || 0}</span>
              <button onClick={() => alterarQtd(produto.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-900 transition hover:bg-zinc-50 active:scale-95">
                <Minus className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </main>

      {Object.keys(carrinho).length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl z-50 border-t border-zinc-200 bg-white/95 p-6 backdrop-blur-md pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          <div className="mx-auto max-w-xl">
            <button
              onClick={abrirCheckout}
              className="flex w-full items-center justify-between rounded-full bg-indigo-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:bg-indigo-700 active:scale-95"
            >
              <span className="text-base">Finalizar pedido</span>
              <span className="text-lg">R$ {calcularTotal().toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {modalCheckout && user && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/60 p-0 backdrop-blur-sm transition-all sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-[2.5rem] bg-white p-8 shadow-2xl sm:rounded-3xl animate-in slide-in-from-bottom-10">
            <h3 className="mb-6 text-2xl font-semibold tracking-tight">Como deseja receber?</h3>
            
            {temItemVIP && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-500" />
                <p className="text-sm font-medium leading-relaxed text-amber-800">
                  Seu pedido contém combos ou garrafas. Por segurança, a entrega é <strong>exclusiva para Camarotes</strong>.
                </p>
              </div>
            )}
            
            <div className="mb-8 space-y-3">
              <button
                onClick={() => !temItemVIP && setDestinoSelecionado('balcao')}
                disabled={temItemVIP}
                className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
                  destinoSelecionado === 'balcao'
                    ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-600/10'
                    : temItemVIP
                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-50'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <p className="font-semibold text-zinc-900 text-lg">Retirar no balcão</p>
                <p className="text-sm font-medium text-zinc-500 mt-1">Bebidas servidas em copo ou lata.</p>
              </button>

              {meusEspacos.map((esp) => (
                <button
                  key={esp.id}
                  onClick={() => setDestinoSelecionado(esp.id)}
                  className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
                    destinoSelecionado === esp.id 
                    ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-600/10' 
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <p className="font-semibold text-zinc-900 text-lg">Entregar no {esp.sigla}</p>
                  <p className="text-sm font-medium text-zinc-500 mt-1">Um garçom levará até sua mesa.</p>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalCheckout(false)} className="flex-1 rounded-full bg-zinc-100 py-4 font-semibold text-zinc-600 transition hover:bg-zinc-200 active:scale-95">
                Voltar
              </button>
              <button
                onClick={fecharPedido}
                disabled={isSubmitting || (temItemVIP && meusEspacos.length === 0)}
                className="flex-[2] rounded-full bg-zinc-900 py-4 font-semibold text-white shadow-md transition hover:bg-zinc-800 disabled:opacity-50 active:scale-95"
              >
                Confirmar pedido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}