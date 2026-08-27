import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import { ArrowLeft, GlassWater, Crown, ShoppingBag } from 'lucide-react';

export default function Cardapio() {
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [saldoVIP, setSaldoVIP] = useState(0);

  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const eventoId = location.state?.eventoId;

  useEffect(() => {
    if (!user || !eventoId) {
      navigate('/home');
      return;
    }

    const unsubCardapio = onSnapshot(collection(db, "cardapio"), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    let totalConsumoComprado = 0;
    let totalGastoNoBar = 0;

    const calcularSaldoDisponivel = () => {
      const saldo = totalConsumoComprado - totalGastoNoBar;
      setSaldoVIP(saldo > 0 ? saldo : 0);
    };

    const unsubEspacos = onSnapshot(query(collection(db, "espacos"), where("donoId", "==", user.uid), where("eventoId", "==", eventoId)), (snapshot) => {
      totalConsumoComprado = snapshot.docs.reduce((acc, doc) => acc + (Number(doc.data().consumacao) || 0), 0);
      calcularSaldoDisponivel();
    });

    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("clienteId", "==", user.uid), where("eventoId", "==", eventoId)), (snapshot) => {
      totalGastoNoBar = snapshot.docs.reduce((acc, doc) => acc + (Number(doc.data().total) || 0), 0);
      calcularSaldoDisponivel();
    });

    return () => { 
      unsubCardapio(); 
      unsubEspacos(); 
      unsubPedidos(); 
    };
  }, [user, navigate, eventoId]);

  const addToCart = (item) => setCart([...cart, item]);
  
  const totalCart = cart.reduce((acc, item) => acc + item.preco, 0);

  const finalizarPedido = async () => {
    if (cart.length === 0 || !user) return;
    
    setIsSubmitting(true);
    const usouSaldoVIP = saldoVIP >= totalCart;

    try {
      const batch = writeBatch(db);
      const novoPedidoRef = doc(collection(db, "pedidos"));
      
      batch.set(novoPedidoRef, {
        eventoId: eventoId, 
        clienteId: user.uid,
        clienteNome: user.nome || "Anônimo",
        itens: cart,
        total: totalCart,
        status: "pendente",
        formaPagamento: usouSaldoVIP ? 'Saldo VIP' : 'Comanda Saída',
        dataHora: new Date().toISOString()
      });

      const contagemItens = {};
      cart.forEach(item => { 
        contagemItens[item.id] = (contagemItens[item.id] || 0) + 1; 
      });

      for (const [itemId, qtdComprada] of Object.entries(contagemItens)) {
        batch.update(doc(db, "cardapio", itemId), { 
          estoque: increment(-qtdComprada) 
        });
      }

      await batch.commit();
      alert(usouSaldoVIP ? "Pedido descontado do seu VIP com sucesso!" : "Adicionado à sua Comanda digital!");
      setCart([]);
      
    } catch (error) { 
      alert("Ocorreu um erro ao enviar seu pedido."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  if (!user || !eventoId) return null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans relative pb-40">
      
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => navigate(-1)} 
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 p-2.5 rounded-full transition-transform active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black tracking-tight text-zinc-900">Bar Digital</h1>
        <div className="w-10"></div>
      </header>

      <main className="p-6 max-w-lg mx-auto">
        
        {saldoVIP > 0 && (
          <div className="mb-8 bg-gradient-to-br from-indigo-600 to-purple-600 p-8 rounded-[2rem] shadow-[0_8px_30px_rgba(79,70,229,0.3)] flex justify-between items-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">
                Crédito VIP
              </p>
              <p className="text-4xl font-black tracking-tight">
                R$ {saldoVIP.toFixed(2)}
              </p>
            </div>
            <Crown className="w-12 h-12 opacity-90 relative z-10 drop-shadow-md text-indigo-100" />
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-[11px] text-zinc-400 uppercase tracking-widest font-black mb-4 pl-2">
            Cardápio Oficial
          </h2>
          
          {menuItems.map((item) => {
            const itensDesteNoCarrinho = cart.filter(c => c.id === item.id).length;
            const semEstoque = item.estoque <= 0 || itensDesteNoCarrinho >= item.estoque;
            
            return (
              <div 
                key={item.id} 
                className={`p-4 rounded-3xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                  semEstoque ? 'bg-zinc-50 border-zinc-200 opacity-60' : 'bg-white border-zinc-200 shadow-sm hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 shadow-inner ${semEstoque ? 'grayscale' : ''}`}>
                    <GlassWater className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className={`font-black text-lg leading-tight mb-1 ${semEstoque ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>
                      {item.nome}
                    </h3>
                    <p className="text-indigo-600 font-black text-sm">
                      R$ {item.preco.toFixed(2)}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => addToCart(item)} 
                  disabled={semEstoque} 
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl transition-transform active:scale-90 ${
                    semEstoque ? 'bg-zinc-100 text-zinc-400' : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-md'
                  }`}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {/* Checkout Fixo no Rodapé */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-zinc-200 p-6 z-50">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-6">
            <div className="flex-1">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" /> {cart.length} {cart.length === 1 ? 'item' : 'itens'}
              </p>
              <p className="text-3xl font-black text-zinc-900 tracking-tight leading-none">
                R$ {totalCart.toFixed(2)}
              </p>
            </div>
            <button 
              onClick={finalizarPedido} 
              disabled={isSubmitting} 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-[0_8px_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100 flex-1 flex justify-center items-center"
            >
              {isSubmitting ? 'Enviando...' : 'Fazer Pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}