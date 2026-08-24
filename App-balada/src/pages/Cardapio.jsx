import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import QRCode from 'react-qr-code'; // 1. Importamos a biblioteca do QR Code!

export default function Cardapio() {
  const [cart, setCart] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usuario, setUsuario] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsuario(user);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const menuItems = [
    { id: 1, name: 'Gin Tônica', price: 35.0, category: 'Drinks', img: '🍸' },
    { id: 2, name: 'Combo Vodka + Energético', price: 250.0, category: 'Combos', img: '🍾' },
    { id: 3, name: 'Cerveja Long Neck', price: 15.0, category: 'Cervejas', img: '🍺' },
    { id: 4, name: 'Água Mineral', price: 8.0, category: 'Sem Álcool', img: '💧' },
  ];

  const addToCart = (item) => {
    setCart([...cart, item]);
  };

  const totalCart = cart.reduce((acc, item) => acc + item.price, 0);

  const finalizarPedido = async () => {
    if (cart.length === 0 || !usuario) return;
    setIsSubmitting(true);

    try {
      const novoPedido = {
        clienteId: usuario.uid,
        clienteEmail: usuario.email, 
        mesa: "Pista",
        itens: cart,
        total: totalCart,
        status: "pendente",
        dataHora: new Date().toISOString()
      };

      await addDoc(collection(db, "pedidos"), novoPedido);

      alert("Pedido enviado para o bar com sucesso! 🚀");
      setCart([]);
    } catch (error) {
      console.error("Erro ao enviar pedido:", error);
      alert("Deu erro! Verifique o console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fazerLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (!usuario) return <div className="h-screen bg-gray-900"></div>;

  return (
    <div className="max-w-md mx-auto h-screen bg-gray-900 text-white flex flex-col font-sans relative overflow-hidden">
      <header className="p-5 bg-gray-800 flex justify-between items-center border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-purple-400">Neon Club</h1>
          <p className="text-sm text-gray-400">Olá, {usuario.email.split('@')[0]}</p>
        </div>
        <button 
          onClick={fazerLogout}
          className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full hover:bg-red-500/40 transition"
        >
          Sair
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-5 pb-24">
        
        {/* 2. NOVA SEÇÃO: A Identidade Digital do Cliente */}
        <section className="mb-8 flex flex-col items-center justify-center p-6 bg-gray-800 rounded-2xl border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
          <p className="text-sm text-gray-400 mb-4 font-semibold uppercase tracking-wider">Sua Identidade Digital</p>
          
          <div className="bg-white p-3 rounded-xl shadow-lg">
            {/* O QR Code é gerado usando o ID ÚNICO (UID) do usuário no Firebase */}
            <QRCode 
              value={usuario.uid} 
              size={140}
              bgColor="#ffffff"
              fgColor="#000000"
              level="H" // Alta tolerância a erros (fácil de ler na balada escura)
            />
          </div>
          
          <span className="mt-5 px-4 py-1.5 bg-green-500/20 text-green-400 rounded-full text-xs font-bold tracking-wide">
            ENTRADA LIBERADA
          </span>
          <p className="text-xs text-gray-500 mt-3 text-center">Apresente este código na portaria e no bar.</p>
        </section>

        <h2 className="text-lg font-semibold mb-4">Cardápio</h2>
        
        <div className="space-y-4">
          {menuItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-800 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center text-2xl">
                  {item.img}
                </div>
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-purple-400">R$ {item.price.toFixed(2)}</p>
                </div>
              </div>
              <button 
                onClick={() => addToCart(item)}
                className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold hover:bg-purple-500 active:scale-95 transition-transform"
              >
                +
              </button>
            </div>
          ))}
        </div>
      </main>

      {cart.length > 0 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-[90%]">
          <button 
            onClick={finalizarPedido}
            disabled={isSubmitting}
            className={`w-full text-white p-4 rounded-2xl font-bold flex justify-between items-center shadow-lg transition-colors ${
              isSubmitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">
                {cart.length}
              </span>
              <span>{isSubmitting ? 'Enviando...' : 'Finalizar Pedido'}</span>
            </div>
            <span>R$ {totalCart.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
}