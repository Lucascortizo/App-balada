import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { Wine, Unlock, PieChart, CheckCircle2, ShoppingBag, QrCode, CreditCard, Clock, Receipt } from 'lucide-react';

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
  
  // Controle de Abas (Ativas vs Histórico)
  const [abaComanda, setAbaComanda] = useState('ativas');

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

  // ================= LÓGICA DE STATUS DAS COMANDAS =================
  const eventosProcessados = IDsEventos.map(eventoId => {
    const festa = eventosGlobais.find(e => e.id === eventoId);
    if (!festa) return null;

    const espacoVIP = reservas.find(r => r.eventoId === eventoId);
    
    const consumacaoVIP = espacoVIP ? (Number(espacoVIP.consumacao) || 0) : 0;
    const consumacaoIngressos = ingressos.filter(i => i.eventoId === eventoId).reduce((a, i) => a + (Number(i.consumacao)||0), 0);
    const totalConsumacao = consumacaoVIP + consumacaoIngressos;

    const meusPedidosNaFesta = pedidos.filter(p => p.eventoId === eventoId).sort((a,b) => new Date(b.data) - new Date(a.data));
    const totalBar = meusPedidosNaFesta.reduce((a, p) => a + (Number(p.total)||0), 0);
    const totalPago = pagamentos.filter(p => p.eventoId === eventoId).reduce((a, p) => a + (Number(p.valorPago)||0), 0);
    
    const splitsDescontados = splitsEnviados.filter(s => s.eventoId === eventoId && s.status === 'aceito').reduce((a, s) => a + (Number(s.valor)||0), 0);
    const splitsAssumidos = splitsRecebidos.filter(s => s.eventoId === eventoId && s.status === 'aceito').reduce((a, s) => a + (Number(s.valor)||0), 0);
    
    const gastoExtra = Math.max(0, totalBar - totalConsumacao);
    const saldoDevedor = Math.max(0, gastoExtra + splitsAssumidos - totalPago - splitsDescontados);
    const isPago = saldoDevedor === 0;

    // REGRA 1: SÓ APARECE SE ELE ENTROU (Ingresso usado, Checkin VIP, ou Pedido lançado)
    const bipouIngresso = ingressos.some(i => i.eventoId === eventoId && i.status === 'usado');
    const fezCheckinVIP = espacoVIP?.checkinFeito === true;
    const temPedidoOuPagamento = meusPedidosNaFesta.length > 0 || totalPago > 0;
    const isEntrou = bipouIngresso || fezCheckinVIP || temPedidoOuPagamento;

    // REGRA 2: VAI PRO HISTÓRICO SE (Bipou Saída na Portaria) OU (Evento acabou há mais de 24h)
    const eventoPassou = (Date.now() - new Date(festa.data).getTime()) > (24 * 60 * 60 * 1000);
    const bipouSaida = ingressos.some(i => i.eventoId === eventoId && (i.status === 'saiu' || i.status === 'encerrado' || i.status === 'finalizado'));
    const isHistorico = bipouSaida || eventoPassou;

    return {
      eventoId, festa, espacoVIP, totalConsumacao, totalBar, totalPago, 
      splitsDescontados, splitsAssumidos, gastoExtra, saldoDevedor, 
      isPago, isEntrou, isHistorico, meusPedidosNaFesta
    };
  }).filter(e => e !== null && e.isEntrou); // Aplica a Regra 1 na hora de listar

  const comandasFiltradas = eventosProcessados.filter(e => abaComanda === 'ativas' ? !e.isHistorico : e.isHistorico);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto">
        <h1 className="text-3xl font-black tracking-tight !text-zinc-900">Comanda & Bar</h1>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        
        {/* ================= ABAS DE NAVEGAÇÃO ================= */}
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner">
          <button 
            onClick={() => setAbaComanda('ativas')} 
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaComanda === 'ativas' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}
          >
            Em Aberto
          </button>
          <button 
            onClick={() => setAbaComanda('historico')} 
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${abaComanda === 'historico' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}
          >
            <Receipt className="w-3.5 h-3.5" /> Histórico
          </button>
        </div>

        {cobrancasPendentes.length > 0 && abaComanda === 'ativas' && (
          <div className="bg-amber-100 text-amber-900 rounded-[2rem] p-6 shadow-md mb-8">
            <h3 className="font-black text-xl mb-4 flex items-center gap-2"><PieChart className="w-5 h-5"/> Convites de Racha</h3>
            <div className="space-y-3">
              {cobrancasPendentes.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-2xl border border-amber-200">
                  <p className="text-xs mb-3 font-medium"><b>{c.deNome}</b> te convidou para rachar a conta. Valor: <b>R$ {(Number(c.valor)||0).toFixed(2)}</b>.</p>
                  <div className="flex gap-2">
                    <button onClick={() => responderSplit(c, true)} disabled={isProcessando} className="flex-[2] bg-amber-500 text-white font-black py-2.5 rounded-xl text-xs">Aceitar Racha</button>
                    <button onClick={() => responderSplit(c, false)} disabled={isProcessando} className="flex-[1] bg-zinc-100 font-black py-2.5 rounded-xl text-xs">Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= ESTADO VAZIO ================= */}
        {comandasFiltradas.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-zinc-300 rounded-[2rem] shadow-sm">
            {abaComanda === 'ativas' ? (
              <>
                <ShoppingBag className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Sua comanda está limpa</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">A comanda só abrirá após o seu ingresso ser validado na entrada.</p>
              </>
            ) : (
              <>
                <Clock className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Sem histórico</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Nenhuma festa anterior encontrada.</p>
              </>
            )}
          </div>
        ) : (
          
          /* ================= LISTA DE COMANDAS ================= */
          comandasFiltradas.map(dados => {
            const { eventoId, festa, espacoVIP, totalConsumacao, totalBar, totalPago, splitsDescontados, splitsAssumidos, gastoExtra, saldoDevedor, isPago, isHistorico, meusPedidosNaFesta } = dados;

            const valorUsadoDaConsumacao = Math.min(totalBar, totalConsumacao);
            const consumacaoRestante = Math.max(0, totalConsumacao - totalBar);
            const percentualUsado = totalConsumacao > 0 ? (valorUsadoDaConsumacao / totalConsumacao) * 100 : 0;

            return (
              <div key={eventoId} className={`rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col ${isHistorico ? 'bg-zinc-50 opacity-90 grayscale-[0.3]' : 'bg-white'}`}>
                
                {/* Header do Evento */}
                <div className={`p-6 text-white relative ${isHistorico ? 'bg-zinc-700' : 'bg-zinc-900'}`}>
                  {isHistorico && <span className="absolute top-6 right-6 bg-zinc-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded text-zinc-400 border border-zinc-600">Fechada</span>}
                  
                  <h3 className="text-2xl font-black mb-1 pr-16">{festa?.nome || 'Evento'}</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{new Date(festa?.data).toLocaleDateString()}</p>
                  
                  {!isHistorico && (
                    <button onClick={() => navigate('/cardapio', { state: { eventoId } })} className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-4 rounded-2xl text-sm font-black flex items-center justify-center gap-2 w-full transition-colors active:scale-95 shadow-md">
                      <Wine className="w-5 h-5" /> Fazer Novo Pedido
                    </button>
                  )}
                </div>

                {/* ================= PAINEL DE CONSUMAÇÃO (COM BARRINHA INTELIGENTE) ================= */}
                <div className="bg-zinc-50 border-b border-zinc-100 p-6">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5"/> Resumo da Conta</h4>
                  
                  {totalConsumacao > 0 ? (
                    <div className="space-y-3">
                      {/* Card da Consumação */}
                      <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-end mb-3">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-zinc-400">Consumação Total</p>
                            <p className="font-black text-xl !text-zinc-900">R$ {totalConsumacao.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-emerald-500">Disponível</p>
                            <p className="font-black text-lg text-emerald-600">R$ {consumacaoRestante.toFixed(2)}</p>
                          </div>
                        </div>
                        
                        {/* Barra de Progresso */}
                        <div className="w-full bg-zinc-100 rounded-full h-2.5 mb-2.5 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${consumacaoRestante === 0 ? 'bg-zinc-800' : 'bg-emerald-500'}`}
                            style={{ width: `${percentualUsado}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          <span>Usado: R$ {valorUsadoDaConsumacao.toFixed(2)}</span>
                          <span>{percentualUsado.toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Card da Comanda Extra (Só aparece se estourar a consumação) */}
                      {gastoExtra > 0 && (
                        <div className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl animate-fade-in">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                              <ShoppingBag className="h-3 w-3" />
                            </span>
                            <p className="font-black text-[11px] uppercase tracking-widest text-zinc-600">Comanda Extra</p>
                          </div>
                          <p className="font-black text-lg text-indigo-700">R$ {gastoExtra.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Cliente sem consumação (Mostra só a comanda normal)
                    <div className="flex items-center justify-between bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                          <ShoppingBag className="h-4 w-4" />
                        </span>
                        <p className="font-black text-sm uppercase tracking-widest text-zinc-500">Meus Gastos</p>
                      </div>
                      <p className="font-black text-2xl !text-zinc-900">R$ {totalBar.toFixed(2)}</p>
                    </div>
                  )}
                </div>

                {/* ================= EXTRATO DE PEDIDOS ================= */}
                {meusPedidosNaFesta.length > 0 && (
                  <div className="bg-white p-6 pb-2">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5"/> Extrato de Pedidos</h4>
                    <div className="space-y-3">
                      {meusPedidosNaFesta.map(pedido => {
                        let statusConfig = { text: 'Pendente', color: 'bg-zinc-100 text-zinc-600', ping: false };
                        if (pedido.status === 'preparando') statusConfig = { text: 'No Bar', color: 'bg-amber-100 text-amber-700', ping: true };
                        else if (pedido.status === 'pronto') statusConfig = { text: pedido.tipoEntrega === 'balcao' ? 'Pronto no Bar' : 'A Caminho', color: 'bg-indigo-100 text-indigo-700', ping: true };
                        else if (pedido.status === 'entregue') statusConfig = { text: 'Entregue', color: 'text-emerald-600 bg-transparent', ping: false };

                        return (
                          <div key={pedido.id} className="bg-white border border-zinc-100 p-4 rounded-2xl">
                            <div className="flex justify-between items-start mb-3 border-b border-dashed pb-3">
                              <div>
                                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded flex items-center gap-1.5 w-fit mb-1 ${statusConfig.color}`}>
                                  {!isHistorico && statusConfig.ping && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current"></span></span>}
                                  {statusConfig.text}
                                </span>
                                {pedido.data && <span className="text-[10px] font-bold text-zinc-400">{new Date(pedido.data).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>}
                              </div>
                              <span className="font-black !text-zinc-900">R$ {(Number(pedido.total)||0).toFixed(2)}</span>
                            </div>
                            
                            <ul className="space-y-1.5">
                              {pedido.itens?.map((item, i) => (
                                <li key={i} className="text-xs font-bold text-zinc-500 flex justify-between">
                                  <span><span className="text-zinc-400 mr-1">{item.quantidade}x</span>{item.nome}</span>
                                </li>
                              ))}
                            </ul>
                            
                            {/* QR CODE DE RETIRADA (SÓ MOSTRA SE A COMANDA NÃO ESTIVER NO HISTÓRICO) */}
                            {!isHistorico && pedido.tipoEntrega === 'balcao' && pedido.status !== 'entregue' && (
                              <button onClick={() => setTicketModal({ tipo: 'retirada', id: pedido.id, status: 'valido', nome: 'Ficha do Bar' })} className="w-full mt-4 bg-zinc-900 text-white font-black py-3 rounded-xl text-xs uppercase animate-pulse flex items-center justify-center gap-2">
                                <QrCode className="w-4 h-4"/> Mostrar QR Code no Bar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ================= SALDO FINAL E PAGAMENTO ================= */}
                <div className="bg-zinc-50 p-6 border-t mt-4">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-xs uppercase font-bold text-zinc-500">{isHistorico ? 'Total Pago' : 'Saldo a Pagar'}</p>
                    <p className={`text-3xl font-black ${isPago ? 'text-emerald-500' : '!text-zinc-900'}`}>R$ {isHistorico ? totalPago.toFixed(2) : saldoDevedor.toFixed(2)}</p>
                  </div>
                  
                  {(splitsAssumidos > 0 || splitsDescontados > 0) && (
                    <div className="flex justify-between items-center mb-4 pt-2 border-t border-zinc-200">
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Rachas c/ Amigos</p>
                      <p className="text-[10px] font-bold text-indigo-600">
                        {splitsAssumidos > 0 && `+ R$ ${splitsAssumidos.toFixed(2)} `}
                        {splitsDescontados > 0 && `- R$ ${splitsDescontados.toFixed(2)}`}
                      </p>
                    </div>
                  )}
                  
                  {!isHistorico && (
                    isPago ? (
                      <button onClick={() => setTicketModal({ tipo: 'saida', id: `${eventoId}|${user.uid}`, status: 'valido', nome: 'Passe de Saída' })} className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors active:scale-95">
                        <Unlock className="w-5 h-5" /> Gerar Passe de Saída
                      </button>
                    ) : (
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => realizarPagamento(eventoId, saldoDevedor)} disabled={isProcessando} className="flex-[2] bg-zinc-900 hover:bg-black text-white font-black py-4 rounded-xl shadow-md transition-colors active:scale-95 disabled:opacity-50">
                          Pagar Agora
                        </button>
                        {espacoVIP && (
                          <button onClick={() => abrirModalSplit(eventoId, saldoDevedor, espacoVIP)} className="flex-[1] bg-white border border-zinc-200 text-indigo-600 font-bold py-4 rounded-xl flex flex-col items-center justify-center hover:bg-indigo-50 transition-colors">
                            <PieChart className="w-5 h-5 mb-1" /> <span className="text-[10px] uppercase font-black">Rachar</span>
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* ================= MODAIS ================= */}
      {modalSplit.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
            <h3 className="text-xl font-black mb-6">Rachar a Conta</h3>
            <div className="flex bg-zinc-100 p-1.5 rounded-2xl mb-6">
              <button onClick={() => setSplitModo('tudo')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${splitModo === 'tudo' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}>Tudo</button>
              <button onClick={() => setSplitModo('custom')} className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${splitModo === 'custom' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500'}`}>Outro Valor</button>
            </div>
            {splitModo === 'custom' && <input type="number" placeholder="Digite o valor (R$)" value={splitValorCustom} onChange={e => setSplitValorCustom(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 outline-none focus:border-indigo-500 rounded-2xl py-4 px-4 font-black mb-6 text-center text-lg" />}
            
            <div className="text-left space-y-2 mb-8">
              <p className="text-[10px] font-black uppercase text-zinc-400 mb-3 tracking-widest pl-2">Quem vai pagar com você?</p>
              <div className="flex items-center gap-3 bg-indigo-50 p-4 rounded-2xl opacity-70">
                <CheckCircle2 className="w-5 h-5 text-indigo-600"/>
                <p className="font-bold text-sm">{user.nome} (Você)</p>
              </div>
              
              {modalSplit.espaco.convidados?.map(c => {
                const isChecked = splitSelecionados.includes(c.uid);
                return (
                  <button key={c.uid} onClick={() => { if (isChecked) setSplitSelecionados(splitSelecionados.filter(id => id !== c.uid)); else setSplitSelecionados([...splitSelecionados, c.uid]); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${isChecked ? 'border-indigo-500 bg-white shadow-sm' : 'bg-zinc-50 border-zinc-200'}`}>
                    <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isChecked ? 'text-indigo-600' : 'text-zinc-300'}`}/>
                    <p className={`font-bold text-sm truncate ${isChecked ? 'text-zinc-900' : 'text-zinc-500'}`}>{c.nome}</p>
                  </button>
                )
              })}
            </div>
            <button onClick={enviarCobrancasSplit} disabled={isProcessando || splitSelecionados.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50">Cobrar Amigos</button>
            <button onClick={() => setModalSplit({aberto:false, eventoId:null, total:0, espaco:null})} className="w-full mt-3 font-bold text-zinc-500 py-3 hover:bg-zinc-50 rounded-2xl transition-colors">Cancelar</button>
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl text-center">
            <h2 className="text-2xl font-black mb-8 !text-zinc-900">{ticketModal.nome}</h2>
            <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 flex justify-center mb-8">
              <QRCode value={`${ticketModal.tipo}|${ticketModal.id}|${user.uid}`} size={200} />
            </div>
            <button onClick={() => setTicketModal(null)} className="w-full bg-zinc-100 hover:bg-zinc-200 font-black uppercase tracking-widest py-4 rounded-2xl text-sm text-zinc-600 transition-colors">Fechar Ingresso</button>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}