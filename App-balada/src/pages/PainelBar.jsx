import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function PainelBar() {
  const [pedidos, setPedidos] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const eventoId = location.state?.eventoId;

  useEffect(() => {
    if (!eventoId) return;

    const q = query(
      collection(db, 'pedidos'),
      where('eventoId', '==', eventoId),
      where('status', 'in', ['pendente', 'preparando'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
      setPedidos(lista);
    });

    return () => unsubscribe();
  }, [eventoId]);

  const avancarStatus = async (pedidoId, statusAtual) => {
    const proximo = statusAtual === 'pendente' ? 'preparando' : 'pronto';
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), { status: proximo });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
  };

  if (!eventoId) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-red-400 font-bold">Nenhum evento selecionado.</p>
        <button onClick={() => navigate('/admin')} className="bg-purple-600 px-4 py-2 rounded-lg font-bold">
          Voltar ao Admin
        </button>
      </div>
    );
  }

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
            <div
              key={pedido.id}
              className={`bg-gray-800 rounded-xl p-5 border-l-4 shadow-lg ${
                pedido.status === 'preparando' ? 'border-blue-500' : 'border-yellow-500'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-white">{pedido.clienteNome}</h2>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    pedido.status === 'preparando'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-yellow-500/20 text-yellow-500'
                  }`}
                >
                  {pedido.status === 'preparando' ? 'Preparando' : 'Aguardando'}
                </span>
              </div>

              <ul className="space-y-2 mb-6">
                {pedido.itens.map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-gray-300">
                    <span className="text-xl">{item.img}</span>
                    <span>{item.nome}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => avancarStatus(pedido.id, pedido.status)}
                className={`w-full font-bold py-3 rounded-lg transition-colors active:scale-95 text-white ${
                  pedido.status === 'preparando'
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {pedido.status === 'preparando' ? 'Marcar como Pronto ✔️' : 'Aceitar Pedido 🍹'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}