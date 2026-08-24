import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function PainelBar() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    // Montamos a query: "Busque todos os pedidos onde o status seja 'pendente'"
    const q = query(collection(db, "pedidos"), where("status", "==", "pendente"));

    // O onSnapshot fica escutando o banco em tempo real
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaPedidos = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Ordena do mais antigo para o mais novo
      listaPedidos.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
      setPedidos(listaPedidos);
    });

    // Limpa o ouvinte quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  // Função para o barman avisar que a bebida está pronta
  const marcarComoPronto = async (pedidoId) => {
    try {
      const pedidoRef = doc(db, "pedidos", pedidoId);
      await updateDoc(pedidoRef, { status: "pronto" });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-green-400">Painel do Bar 🍸</h1>
        <p className="text-gray-400">Acompanhamento de pedidos em tempo real</p>
      </header>

      {pedidos.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-500 text-lg">
          Nenhum pedido pendente. O bar está tranquilo!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidos.map((pedido) => (
            <div key={pedido.id} className="bg-gray-800 rounded-xl p-5 border-l-4 border-yellow-500 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-white">{pedido.mesa}</h2>
                <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                  Aguardando
                </span>
              </div>
              
              <ul className="space-y-2 mb-6">
                {pedido.itens.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-300">
                    <span className="text-xl">{item.img}</span>
                    <span>1x {item.name}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => marcarComoPronto(pedido.id)}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors active:scale-95"
              >
                Marcar como Pronto ✔️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}