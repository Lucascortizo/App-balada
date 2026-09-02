import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { Wine, Unlock, PieChart, CheckCircle2, ShoppingBag, QrCode } from 'lucide-react';

export default function MinhaConta() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [ingressos, setIngressos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [pedidos, setPedidos] = useState([]); 
  const [pagamentos, setPagamentos] = useState([]);
  const [splitsEnviados, setSplitsEnviados] = useState([]);   
  const [splitsRecebidos, setSplitsRecebidos] = useState([]); 
  
  const [ticketModal, setTicketModal] = useState(null);
  const [modalSplit, setModalSplit] = useState({ aberto: false, eventoId: null, total: 0, espaco: null });
  const [splitModo, setSplitModo] = useState('tudo'); 
  const [splitValorCustom, setSplitValorCustom] = useState('');
  const [splitSelecionados, setSplitSelecionados] = useState([]); 
  const [isProcessando, setIsProcessando] = useState(false);

  useEffect(() => {
    if (!user) return; 
    const unsubEv = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubIn = onSnapshot(query(collection(db, "ingressos_vendidos"), where("donoId", "==", user.uid)), snap => setIngressos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRe = onSnapshot(query(collection(db, "espacos"), where("donoId", "==", user.uid)), snap => setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPe = onSnapshot(query(collection(db, "pedidos"), where("clienteId", "==", user.uid)), snap => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPa = onSnapshot(query(collection(db, "pagamentos_comanda"), where("clienteId", "==", user.uid)), snap => setPagamentos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSe = onSnapshot(query(collection(db, "cobrancas_split"), where("deId", "==", user.uid)), snap => setSplitsEnviados(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSr = onSnapshot(query(collection(db, "cobrancas_split"), where("paraId", "==", user.uid)), snap => setSplitsRecebidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubEv(); unsubIn(); unsubRe(); unsubPe(); unsubPa(); unsubSe(); unsubSr(); };
  }, [user]);

  const abrirModalSplit = (eventoId, total, espacoVIP) => { 
    setModalSplit({ aberto: true, eventoId, total, espaco: espacoVIP }); 
    setSplitModo('tudo'); 
    setSplitValorCustom(''); 
    setSplitSelecionados(espacoVIP.convidados?.map(c => c.uid) || []); 
  };

  const enviarCobrancasSplit = async () => {
    const valorBase = splitModo === 'tudo' ? modalSplit.total : parseFloat(splitValorCustom);
    if (!valorBase || valorBase <= 0 || splitSelecionados.length === 0) return toast.error("Dados inválidos para rachar a conta.");
    
    setIsProcessando(true);
    const toastId = toast.loading('Enviando convites de racha...');

    try {
      const valor = valorBase / (splitSelecionados.length + 1); 
      await Promise.all(splitSelecionados.map(amigoId => {
        const amigo = modalSplit.espaco.convidados.find(c => c.uid === amigoId);
        return addDoc(collection(db, "cobrancas_split"), {
          eventoId: modalSplit.eventoId, deId: user.uid, deNome: user.nome || user.email, 
          paraId: amigoId, paraNome: amigo.nome, valor, status: 'pendente', criadoEm: new Date().toISOString()
        });
      }));
      toast.success("Racha enviado aos amigos!", { id: toastId }); 
      setModalSplit({ aberto: false, eventoId: null, total: 0, espaco: null });
    } catch (e) { 
      toast.error("Erro ao enviar cobranças.", { id: toastId }); 
    } 
    setIsProcessando(false);
  };

  const responderSplit = async (cobranca, aceitar) => {
    if (!aceitar) {
      await updateDoc(doc(db, "cobrancas_split", cobranca.id), { status: 'recusado' });
      return toast.success('Racha recusado.');
    }
    
    setIsProcessando(true);
    const toastId = toast.loading('Processando aceite...');
    try { 
      await updateDoc(doc(db, "cobrancas_split", cobranca.id), { status: 'aceito' }); 
      toast.success("Racha aceito! Valor adicionado na sua comanda.", { id: toastId }); 
    } catch (e) { 
      toast.error("Erro ao aceitar.", { id: toastId }); 
    } finally { 
      setIsProcessando(false); 
    }
  };

  const realizarPagamento = async (eventoId, valor) => {
    setIsProcessando(true);
    const toastId = toast.loading('Processando pagamento...');
    setTimeout(async () => {
      await addDoc(collection(db, "pagamentos_comanda"), { 
        eventoId, clienteId: user.uid, valorPago: valor, dataPagamento: new Date().toISOString() 
      });
      toast.success("Pagamento confirmado! Passe de saída liberado.", { id: toastId }); 
      setIsProcessando(false);
    }, 1500);
  };

  const IDsEventos = Array.from(new Set([...ingressos.map(i=>i.eventoId), ...reservas.map(r=>r.eventoId), ...pedidos.map(p=>p.eventoId), ...splitsRecebidos.map(s=>s.eventoId)])).filter(Boolean);
  const cobrancasPendentes = splitsRecebidos.filter(s => s.status === 'pendente');

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto"><h1 className="text-3xl font-black tracking-tight">Comanda & Bar</h1></header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        {cobrancasPendentes.length > 0 && (
          <div className="bg-amber-100 text-amber-900 rounded-[2rem] p-6 shadow-md mb-8">
            <h3 className="font-black text-xl mb-4 flex items-center gap-2"><PieChart className="w-5 h-5"/> Convites de Racha</h3>
            <div className="space-y-3">
              {cobrancasPendentes.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-2xl border border-amber-200">
                  <p className="text-xs mb-3 font-medium"><b>{c.deNome}</b> te convidou para rachar a conta. Valor: <b>R$ {(Number(c.valor)||0).toFixed(2)}</b>.</p>
                  <div className="flex gap-2"><button onClick={() => responderSplit(c, true)} disabled={isProcessando} className="flex-[2] bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs">Aceitar Racha</button><button onClick={() => responderSplit(c, false)} disabled={isProcessando} className="flex-[1] bg-zinc-100 font-black py-2.5 rounded-xl text-xs">Recusar</button></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {IDsEventos.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-[2rem]"><ShoppingBag className="w-10 h-10 mx-auto mb-4 text-zinc-300" /><h3 className="text-lg font-black text-zinc-800">Comanda Vazia</h3></div>
        ) : (
          IDsEventos.map(eventoId => {
            const festa = eventosGlobais.find(e => e.id === eventoId);
            const totalVIP = reservas.filter(r => r.eventoId === eventoId).reduce((a, r) => a + (r.consumacao||0), 0);
            const totalBar = pedidos.filter(p => p.eventoId === eventoId).reduce((a, p) => a + (Number(p.total)||0), 0);
            const totalPago = pagamentos.filter(p => p.eventoId === eventoId).reduce((a, p) => a + (Number(p.valorPago)||0), 0);
            const splitsDescontados = splitsEnviados.filter(s => s.eventoId === eventoId && s.status === 'aceito').reduce((a, s) => a + (Number(s.valor)||0), 0);
            const splitsAssumidos = splitsRecebidos.filter(s => s.eventoId === eventoId && s.status === 'aceito').reduce((a, s) => a + (Number(s.valor)||0), 0);
            const saldoDevedor = Math.max(0, totalBar + splitsAssumidos - totalVIP - totalPago - splitsDescontados);
            const isPago = saldoDevedor === 0;
            const espacoVIP = reservas.find(r => r.eventoId === eventoId);
            const meusPedidosNaFesta = pedidos.filter(p => p.eventoId === eventoId).sort((a,b) => new Date(b.data) - new Date(a.data));

            return (
              <div key={eventoId} className="bg-white rounded-[2rem] border shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 bg-zinc-900 text-white relative">
                  <h3 className="text-2xl font-black mb-1">{festa?.nome || 'Evento'}</h3>
                  <button onClick={() => navigate('/cardapio', { state: { eventoId } })} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 w-full transition-colors">
                    <Wine className="w-4 h-4" /> Abrir Cardápio de Bebidas
                  </button>
                </div>
                
                {meusPedidosNaFesta.length > 0 && (
                  <div className="bg-zinc-50/50 p-6">
                    <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2"><ShoppingBag className="w-4 h-4"/> Meus Pedidos</h4>
                    <div className="space-y-4">
                      {meusPedidosNaFesta.map(pedido => {
                        let statusConfig = { text: 'Pendente', color: 'bg-zinc-200 text-zinc-600', ping: false };
                        if (pedido.status === 'preparando') statusConfig = { text: 'No Bar', color: 'bg-amber-200 text-amber-800', ping: true };
                        else if (pedido.status === 'pronto') statusConfig = { text: pedido.tipoEntrega === 'balcao' ? 'Pronto no Bar' : 'A Caminho', color: 'bg-blue-200 text-blue-800', ping: true };
                        else if (pedido.status === 'entregue') statusConfig = { text: 'Entregue', color: 'bg-green-100 text-green-700', ping: false };

                        return (
                          <div key={pedido.id} className="bg-white border p-4 rounded-2xl shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md flex items-center gap-1.5 ${statusConfig.color}`}>{statusConfig.ping && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span></span>}{statusConfig.text}</span>
                              {pedido.data && <span className="text-[10px] font-bold text-zinc-400">{new Date(pedido.data).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                            </div>
                            <ul className="space-y-1 mb-3">
                              {pedido.itens?.map((item, i) => (
                                <li key={i} className="text-sm font-bold flex justify-between"><span><span className="text-zinc-400 mr-1">{item.quantidade}x</span>{item.nome}</span><span className="text-zinc-500">R$ {((Number(item.precoUnitario)||0) * Number(item.quantidade||1)).toFixed(2)}</span></li>
                              ))}
                            </ul>
                            <div className="flex justify-between items-center pt-3 border-t"><span className="text-[10px] font-black uppercase text-zinc-400">Total do Pedido</span><span className="font-black text-indigo-600 text-sm">R$ {(Number(pedido.total)||0).toFixed(2)}</span></div>
                            
                            {/* QR CODE SEMPRE DISPONÍVEL SE FOI PEDIDO NO BALCÃO E AINDA NÃO FOI ENTREGUE */}
                            {pedido.tipoEntrega === 'balcao' && pedido.status !== 'entregue' && (
                              <button onClick={() => setTicketModal({ tipo: 'retirada', id: pedido.id, status: 'valido', nome: 'Retirar Bebida no Bar' })} className="w-full mt-4 bg-indigo-600 text-white font-black py-3 rounded-xl text-xs uppercase animate-pulse flex items-center justify-center gap-2">
                                <QrCode className="w-4 h-4"/> Mostrar QR Code no Bar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-zinc-50 p-6 border-t border-dashed">
                  <div className="flex justify-between items-end mb-2"><p className="text-xs uppercase font-bold text-zinc-400">Saldo Devedor</p><p className={`text-2xl font-black ${isPago ? 'text-green-500' : 'text-zinc-900'}`}>R$ {saldoDevedor.toFixed(2)}</p></div>
                  {(splitsAssumidos > 0 || splitsDescontados > 0) && (
                    <div className="flex justify-between items-center mb-4 pt-1 border-t"><p className="text-[10px] uppercase font-bold text-zinc-400">Rachas Aceitos</p><p className="text-[10px] font-bold text-indigo-600">{splitsAssumidos > 0 && `+ R$ ${splitsAssumidos.toFixed(2)} `}{splitsDescontados > 0 && `- R$ ${splitsDescontados.toFixed(2)}`}</p></div>
                  )}
                  {isPago ? (
                    <button onClick={() => setTicketModal({ tipo: 'saida', id: `${eventoId}|${user.uid}`, status: 'valido', nome: 'Passe de Saída' })} className="w-full mt-2 bg-green-500 text-white font-bold py-4 rounded-xl shadow-md flex items-center justify-center gap-2"><Unlock className="w-5 h-5" /> Gerar Passe de Saída</button>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => realizarPagamento(eventoId, saldoDevedor)} disabled={isProcessando} className="flex-[2] bg-zinc-900 text-white font-bold py-4 rounded-xl shadow-md">Pagar Comanda</button>
                      {espacoVIP && <button onClick={() => abrirModalSplit(eventoId, saldoDevedor, espacoVIP)} className="flex-[1] bg-white border text-indigo-600 font-bold py-4 rounded-xl flex flex-col items-center justify-center"><PieChart className="w-5 h-5 mb-1" /> <span className="text-[10px] uppercase">Rachar</span></button>}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {modalSplit.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl text-center">
            <h3 className="text-xl font-black mb-4">Rachar a Conta</h3>
            <div className="flex bg-zinc-100 p-1 rounded-xl mb-4"><button onClick={() => setSplitModo('tudo')} className={`flex-1 py-2 rounded-lg text-xs font-black ${splitModo === 'tudo' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}>Tudo</button><button onClick={() => setSplitModo('custom')} className={`flex-1 py-2 rounded-lg text-xs font-black ${splitModo === 'custom' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}>Outro Valor</button></div>
            {splitModo === 'custom' && <input type="number" placeholder="Digite o valor" value={splitValorCustom} onChange={e => setSplitValorCustom(e.target.value)} className="w-full bg-zinc-50 border rounded-xl py-3 px-4 font-black mb-4 text-center" />}
            <div className="text-left space-y-2 mb-4">
              <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Com quem?</p>
              <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl opacity-70"><CheckCircle2 className="w-4 h-4 text-indigo-600"/><div><p className="font-bold text-sm">{user.nome} (Você)</p></div></div>
              {modalSplit.espaco.convidados?.map(c => {
                const isChecked = splitSelecionados.includes(c.uid);
                return (
                  <div key={c.uid} onClick={() => { if (isChecked) setSplitSelecionados(splitSelecionados.filter(id => id !== c.uid)); else setSplitSelecionados([...splitSelecionados, c.uid]); }} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${isChecked ? 'border-indigo-500 bg-white' : 'bg-zinc-50'}`}><CheckCircle2 className={`w-4 h-4 ${isChecked ? 'text-indigo-600' : 'text-zinc-300'}`}/><div><p className={`font-bold text-sm ${isChecked ? 'text-zinc-900' : 'text-zinc-500'}`}>{c.nome}</p></div></div>
                )
              })}
            </div>
            <button onClick={enviarCobrancasSplit} disabled={isProcessando || splitSelecionados.length === 0} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl">Cobrar Amigos</button>
            <button onClick={() => setModalSplit({aberto:false})} className="w-full mt-2 font-bold text-zinc-500 py-2">Cancelar</button>
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center"><h2 className="text-2xl font-black mb-6">{ticketModal.tipo === 'retirada' ? 'Ficha do Bar' : 'Passe de Saída'}</h2><QRCode value={`${ticketModal.tipo}|${ticketModal.id}|${user.uid}`} size={200} /><button onClick={() => setTicketModal(null)} className="w-full mt-8 bg-zinc-100 font-black uppercase py-4 rounded-xl text-sm">Fechar Ficha</button></div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}