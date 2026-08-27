import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import BottomNav from '../components/BottomNav';
import { Ticket, Wine, Unlock, XCircle } from 'lucide-react';

export default function MinhaConta() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [ingressos, setIngressos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [pedidos, setPedidos] = useState([]); 
  const [pagamentos, setPagamentos] = useState([]);
  const [ticketModal, setTicketModal] = useState(null);
  const [isProcessandoPagamento, setIsProcessandoPagamento] = useState(false);

  useEffect(() => {
    if (!user) return; 
    const unsubEventos = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubIngressos = onSnapshot(query(collection(db, "ingressos_vendidos"), where("donoId", "==", user.uid)), snap => setIngressos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubReservas = onSnapshot(query(collection(db, "espacos"), where("donoId", "==", user.uid)), snap => setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("clienteId", "==", user.uid)), snap => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPagamentos = onSnapshot(query(collection(db, "pagamentos_comanda"), where("clienteId", "==", user.uid)), snap => setPagamentos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubEventos(); unsubIngressos(); unsubReservas(); unsubPedidos(); unsubPagamentos(); };
  }, [user]);

  const realizarPagamento = async (eventoId, valor) => {
    setIsProcessandoPagamento(true);
    setTimeout(async () => {
      try {
        await addDoc(collection(db, "pagamentos_comanda"), { eventoId, clienteId: user.uid, valorPago: valor, dataPagamento: new Date().toISOString() });
        alert("Pagamento confirmado! Sua saída está liberada.");
      } catch (error) { alert("Erro no pagamento."); } finally { setIsProcessandoPagamento(false); }
    }, 1500);
  };

  const IDsEventos = Array.from(new Set([...ingressos.map(i=>i.eventoId), ...reservas.map(r=>r.eventoId), ...pedidos.map(p=>p.eventoId)])).filter(Boolean);

  if (!user) return <div className="min-h-screen bg-[#FAFAFA] flex justify-center items-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Sua Carteira</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="bg-zinc-200 hover:bg-zinc-300 text-zinc-600 px-4 py-2 rounded-full text-xs font-bold active:scale-95 transition-colors">Sair</button>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        {IDsEventos.length === 0 ? (
          <div className="text-center py-16 bg-white border border-zinc-200 rounded-[2rem] shadow-sm">
            <div className="w-20 h-20 bg-zinc-50 text-zinc-300 rounded-full flex items-center justify-center mx-auto mb-6">
              <Ticket className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-zinc-800 mb-2">Carteira Vazia</h3>
            <p className="text-sm text-zinc-500 mb-8 font-medium">Você ainda não possui ingressos ou comandas ativas.</p>
            <button onClick={() => navigate('/home')} className="bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-black shadow-md active:scale-95 transition-transform">Explorar Festas</button>
          </div>
        ) : (
          IDsEventos.map(eventoId => {
            const festa = eventosGlobais.find(e => e.id === eventoId);
            const aPagar = Math.max(0, pedidos.filter(p => p.eventoId === eventoId).reduce((a, p) => a + (p.total||0), 0) - reservas.filter(r => r.eventoId === eventoId).reduce((a, r) => a + (r.consumacao||0), 0));
            const isPago = pagamentos.find(p => p.eventoId === eventoId) || aPagar === 0;

            return (
              <div key={eventoId} className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 bg-zinc-900 text-white relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl"></div>
                  <h3 className="text-2xl font-black tracking-tight mb-1 relative z-10">{festa?.nome || 'Evento Ativo'}</h3>
                  <button onClick={() => navigate('/cardapio', { state: { eventoId } })} className="mt-4 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all flex items-center gap-2 w-fit relative z-10">
                    <Wine className="w-4 h-4" /> Acessar Bar
                  </button>
                </div>
                
                <div className="p-6 space-y-4 relative">
                  <div className="absolute -top-3 -left-3 w-6 h-6 bg-[#FAFAFA] rounded-full border-r border-b border-zinc-200"></div>
                  <div className="absolute -top-3 -right-3 w-6 h-6 bg-[#FAFAFA] rounded-full border-l border-b border-zinc-200"></div>
                  
                  {ingressos.filter(i => i.eventoId === eventoId).map((i, idx) => (
                    <div key={i.id} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0">
                      <div><p className="font-black text-zinc-900">Pista #{idx + 1}</p></div>
                      <button onClick={() => setTicketModal({ tipo: 'ingresso', id: i.id, status: i.status, nome: festa?.nome })} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${i.status === 'usado' ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'}`}>{i.status === 'usado' ? 'Usado' : 'Mostrar QR'}</button>
                    </div>
                  ))}
                  
                  {reservas.filter(r => r.eventoId === eventoId).map((r) => (
                    <div key={r.id} className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0">
                      <div><p className="font-black text-zinc-900">{r.sigla}</p></div>
                      <button onClick={() => setTicketModal({ tipo: 'espaco', id: r.id, status: r.checkinFeito?'usado':'valido', nome: festa?.nome })} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${r.checkinFeito ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'}`}>{r.checkinFeito ? 'Usado' : 'Mostrar QR'}</button>
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-50 p-6 border-t border-dashed border-zinc-200">
                  <div className="flex justify-between items-end mb-4">
                    <p className="text-xs uppercase font-bold text-zinc-400 tracking-widest">Saldo Devedor</p>
                    <p className={`text-2xl font-black ${isPago ? 'text-green-500' : 'text-zinc-900'}`}>R$ {aPagar.toFixed(2)}</p>
                  </div>
                  {isPago ? (
                    <button onClick={() => setTicketModal({ tipo: 'saida', id: `${eventoId}|${user.uid}`, status: 'valido', nome: 'Passe de Saída' })} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-[0_4px_15px_rgba(34,197,94,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Unlock className="w-5 h-5" /> Gerar Saída
                    </button>
                  ) : (
                    <button onClick={() => realizarPagamento(eventoId, aPagar)} disabled={isProcessandoPagamento} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-70">
                      {isProcessandoPagamento ? 'Processando...' : 'Pagar Agora'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-0 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl animate-slide-up relative">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/40 rounded-full z-10"></div>
            <div className={`pt-12 p-8 text-center border-b border-dashed border-zinc-200 ${ticketModal.status === 'usado' ? 'bg-zinc-200 text-zinc-500' : (ticketModal.tipo === 'saida' ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white')}`}>
              <h2 className="text-3xl font-black tracking-tight mb-1">{ticketModal.tipo === 'ingresso' ? 'Pista' : (ticketModal.tipo === 'saida' ? 'Saída' : 'VIP')}</h2>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">{ticketModal.nome}</p>
            </div>
            <div className="p-10 flex flex-col items-center bg-zinc-50 relative">
              {ticketModal.status === 'usado' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[2px]">
                  <span className="text-3xl font-black text-zinc-300 border-4 border-zinc-300 px-6 py-2 rounded-2xl -rotate-12 flex items-center gap-2">
                    <XCircle className="w-8 h-8" /> USADO
                  </span>
                </div>
              )}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200"><QRCode value={`${ticketModal.tipo}|${ticketModal.id}|${user.uid}`} size={200} /></div>
              <p className="text-xs font-bold text-zinc-400 mt-6 uppercase tracking-widest">{ticketModal.tipo === 'saida' ? 'Apresente na catraca de saída' : 'Apresente na portaria para entrar'}</p>
            </div>
            <div className="p-6 bg-white">
              <button onClick={() => setTicketModal(null)} className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-black uppercase tracking-widest py-4 rounded-2xl transition-colors text-sm">Fechar Ticket</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}