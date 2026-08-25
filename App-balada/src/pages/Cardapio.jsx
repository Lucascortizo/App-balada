import { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';

export default function Cardapio() {
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [saldoVIP, setSaldoVIP] = useState(0);

  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // A MÁGICA: Qual evento o cliente está?
  const eventoId = location.state?.eventoId;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!eventoId) { navigate('/home'); return; }

    const unsubCardapio = onSnapshot(collection(db, "cardapio"), (snapshot) => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    let totalConsumacaoComprada = 0;
    let totalGastoNoBar = 0;

    const atualizarSaldo = () => {
      const saldo = totalConsumacaoComprada - totalGastoNoBar;
      setSaldoVIP(saldo > 0 ? saldo : 0);
    };

    // ISOLAMENTO: Só busca Camarotes que ele tem NESTE EVENTO
    const qEspacos = query(collection(db, "espacos"), where("donoId", "==", user.uid), where("eventoId", "==", eventoId));
    const unsubEspacos = onSnapshot(qEspacos, (snapshot) => {
      totalConsumacaoComprada = snapshot.docs.reduce((acc, doc) => acc + (Number(doc.data().consumacao) || 0), 0);
      atualizarSaldo();
    });

    // ISOLAMENTO: Só busca Pedidos que ele fez NESTE EVENTO
    const qPedidos = query(collection(db, "pedidos"), where("clienteId", "==", user.uid), where("eventoId", "==", eventoId));
    const unsubPedidos = onSnapshot(qPedidos, (snapshot) => {
      totalGastoNoBar = snapshot.docs.reduce((acc, doc) => acc + (Number(doc.data().total) || 0), 0);
      atualizarSaldo();
    });

    return () => { unsubCardapio(); unsubEspacos(); unsubPedidos(); };
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
        eventoId: eventoId, // CARIMBANDO O EVENTO
        clienteId: user.uid,
        clienteNome: user.nome || "Anônimo",
        itens: cart,
        total: totalCart,
        status: "pendente",
        formaPagamento: usouSaldoVIP ? 'Saldo VIP' : 'A Pagar',
        dataHora: new Date().toISOString()
      });

      const contagemItens = {};
      cart.forEach(item => { contagemItens[item.id] = (contagemItens[item.id] || 0) + 1; });

      for (const [itemId, qtdComprada] of Object.entries(contagemItens)) {
        batch.update(doc(db, "cardapio", itemId), { estoque: increment(-qtdComprada) });
      }

      await batch.commit();
      alert(usouSaldoVIP ? "Descontado do Saldo VIP! 🥂" : "Adicionado à sua Comanda da festa! 🚀");
      setCart([]);
    } catch (error) { alert("Erro ao processar."); } finally { setIsSubmitting(false); }
  };

  if (!user || !eventoId) return <div className="h-screen bg-gray-900 flex items-center justify-center text-purple-400">Carregando...</div>;

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-900 text-white flex flex-col font-sans relative overflow-hidden">
      <header className="p-5 bg-gray-800 flex justify-between items-center border-b border-gray-700">
        <button onClick={() => navigate('/home')} className="text-xs text-purple-400 hover:text-white">← Voltar</button>
        <h1 className="text-xl font-bold text-white">Bar da Festa</h1>
        <button onClick={() => { logout(); navigate('/'); }} className="text-xs bg-gray-700 px-3 py-1 rounded-full">Sair</button>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-32">
        {saldoVIP > 0 && (
          <div className="mb-6 bg-gradient-to-r from-blue-900 to-purple-900 p-4 rounded-xl border border-purple-500/50 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-xs text-purple-300 font-bold uppercase">Saldo Consumação</p>
              <p className="text-2xl font-bold">R$ {saldoVIP.toFixed(2)}</p>
            </div>
            <div className="text-4xl">👑</div>
          </div>
        )}

        <section className="mb-6 flex flex-col items-center p-4 bg-gray-800 rounded-2xl border border-gray-700">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">QR Code Mesa / Bar</p>
          <div className="bg-white p-2 rounded-lg"><QRCode value={user?.uid || ''} size={100} /></div>
        </section>

        <div className="space-y-3">
          {menuItems.map((item) => {
            const qtdNoCarrinho = cart.filter(c => c.id === item.id).length;
            const semEstoque = item.estoque <= 0 || qtdNoCarrinho >= item.estoque;
            return (
              <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${semEstoque ? 'bg-gray-900 border-red-900/50 opacity-60' : 'bg-gray-800 border-gray-700'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gray-900 rounded flex items-center justify-center text-xl ${semEstoque ? 'grayscale' : ''}`}>{item.img}</div>
                  <div>
                    <h3 className={`font-bold text-sm ${semEstoque ? 'line-through text-gray-500' : ''}`}>{item.nome}</h3>
                    <p className="text-purple-400 font-bold text-xs">R$ {item.preco.toFixed(2)}</p>
                  </div>
                </div>
                <button onClick={() => addToCart(item)} disabled={semEstoque} className={`h-8 px-3 rounded-full font-bold ${semEstoque ? 'bg-red-900/40 text-red-400 text-xs' : 'bg-purple-600 text-white hover:bg-purple-500'}`}>
                  {semEstoque ? 'Esgotado' : '+'}
                </button>
              </div>
            );
          })}
        </div>
      </main>

      {cart.length > 0 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%]">
          <button onClick={finalizarPedido} disabled={isSubmitting} className="w-full bg-purple-600 p-4 rounded-xl font-bold flex flex-col items-center shadow-lg">
            <div className="flex w-full justify-between items-center mb-1">
              <span>{cart.length} itens</span>
              <span className="text-xl">R$ {totalCart.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-white/80 uppercase">
              {saldoVIP >= totalCart ? '✓ Desconta do VIP' : 'Pague na saída (Comanda)'}
            </p>
          </button>
        </div>
      )}
    </div>
  );
}