import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { LogOut, CupSoda, CheckCircle2, Clock, Inbox, ChefHat } from 'lucide-react';

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
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center mb-6 text-zinc-400">
          <CupSoda className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 mb-2 tracking-tight">Nenhum evento ativo</h2>
        <p className="text-zinc-500 font-medium mb-8">Inicie o painel do bar através da área de Administração.</p>
        <button 
          onClick={() => navigate('/admin')} 
          className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform"
        >
          Voltar ao Admin
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 p-6 font-sans pb-24">
      
      <header className="mb-10 flex flex-col sm:flex-row justify-between sm:items-end gap-6 border-b border-zinc-200 pb-6 max-w-7xl mx-auto">
        <div>
          <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Acompanhamento ao vivo
          </p>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
            Painel do Bar
          </h1>
        </div>
        <button 
          onClick={() => navigate('/admin')} 
          className="bg-white border border-zinc-200 text-zinc-600 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-zinc-50 transition-colors text-sm w-fit active:scale-95 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Sair do Bar
        </button>
      </header>

      <div className="max-w-7xl mx-auto">
        {pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-dashed border-zinc-300 shadow-sm">
            <Inbox className="w-16 h-16 text-zinc-300 mb-6" />
            <p className="text-xl font-black text-zinc-800 mb-2">Nenhum pedido pendente</p>
            <p className="text-zinc-500 font-medium">O balcão está tranquilo no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="bg-white rounded-[2rem] p-6 sm:p-8 border border-zinc-100 shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex flex-col relative overflow-hidden"
              >
                {/* Linha indicadora de status no topo do card */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${pedido.status === 'preparando' ? 'bg-indigo-500' : 'bg-amber-400'}`}></div>

                <div className="flex justify-between items-start mb-6 border-b border-zinc-100 pb-6">
                  <div>
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-1">Cliente</p>
                    <h2 className="text-2xl font-black text-zinc-900 leading-tight">{pedido.clienteNome}</h2>
                  </div>
                  <span
                    className={`text-[10px] px-3 py-1.5 rounded-md font-black uppercase tracking-widest flex items-center gap-1.5 ${
                      pedido.status === 'preparando'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {pedido.status === 'preparando' ? <ChefHat className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {pedido.status === 'preparando' ? 'Na Coqueteleira' : 'Aguardando'}
                  </span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {pedido.itens.map((item, index) => (
                    <li key={index} className="flex items-center gap-4 text-zinc-800 bg-zinc-50 p-3 rounded-2xl border border-zinc-100">
                      <span className="text-2xl bg-white p-2 rounded-xl shadow-sm text-zinc-400 flex items-center justify-center w-12 h-12">
                        {item.img || <CupSoda className="w-6 h-6" />}
                      </span>
                      <span className="font-black text-lg">{item.nome}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => avancarStatus(pedido.id, pedido.status)}
                  className={`w-full font-black py-4 rounded-2xl transition-transform active:scale-95 text-white shadow-md text-sm uppercase tracking-widest flex justify-center items-center gap-2 ${
                    pedido.status === 'preparando'
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_4px_15px_rgba(16,185,129,0.3)]'
                      : 'bg-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  {pedido.status === 'preparando' ? (
                    <><CheckCircle2 className="w-5 h-5" /> Entregue / Pronto</>
                  ) : (
                    'Aceitar Pedido'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}