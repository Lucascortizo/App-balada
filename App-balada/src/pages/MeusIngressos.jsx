import { useState, useEffect, useContext } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { Ticket, Send, User, Users, Plus, Trash2, CheckCircle2, Link, Star, XCircle, Clock, X, Crown } from 'lucide-react';

export default function MeusIngressos() {
  const { user } = useContext(AuthContext);
  
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [ingressos, setIngressos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [espacosComoConvidado, setEspacosComoConvidado] = useState([]); 
  const [ingressosRecebidos, setIngressosRecebidos] = useState([]);
  const [espacosRecebidos, setEspacosRecebidos] = useState([]);
  
  const [abaAtiva, setAbaAtiva] = useState('ativos'); 
  
  const [ticketModal, setTicketModal] = useState(null);
  const [modalTransferencia, setModalTransferencia] = useState({ aberto: false, id: null, tipo: '' });
  const [modalConvidados, setModalConvidados] = useState({ aberto: false, espaco: null });
  const [emailInput, setEmailInput] = useState('');
  const [isProcessando, setIsProcessando] = useState(false);

  useEffect(() => {
    if (!user?.uid) return; 
    
    const unsubEventos = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubIngressos = onSnapshot(query(collection(db, "ingressos_vendidos"), where("donoId", "==", user.uid)), snap => setIngressos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubReservas = onSnapshot(query(collection(db, "espacos"), where("donoId", "==", user.uid)), snap => setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubConvidados = onSnapshot(query(collection(db, "espacos"), where("convidadosIds", "array-contains", user.uid)), snap => setEspacosComoConvidado(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubIngressosIn = onSnapshot(query(collection(db, "ingressos_vendidos"), where("transferencia.paraId", "==", user.uid)), snap => setIngressosRecebidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEspacosIn = onSnapshot(query(collection(db, "espacos"), where("transferencia.paraId", "==", user.uid)), snap => setEspacosRecebidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubEventos(); unsubIngressos(); unsubReservas(); unsubConvidados(); unsubIngressosIn(); unsubEspacosIn(); };
  }, [user]);

  const solicitarTransferencia = async () => {
    if (!emailInput) return toast.error("Digite o e-mail.");
    setIsProcessando(true);
    const toastId = toast.loading('Enviando...');
    try {
      const qUsuario = query(collection(db, "usuarios"), where("email", "==", emailInput.toLowerCase().trim()));
      const snapUsuario = await getDocs(qUsuario);
      if (snapUsuario.empty) {
        toast.error("Usuário não encontrado no aplicativo.", { id: toastId });
        setIsProcessando(false);
        return;
      }
      const colecao = modalTransferencia.tipo === 'ingresso' ? 'ingressos_vendidos' : 'espacos';
      await updateDoc(doc(db, colecao, modalTransferencia.id), {
        transferencia: { status: 'pendente', paraId: snapUsuario.docs[0].id, paraEmail: emailInput.toLowerCase().trim() }
      });
      toast.success("Convite de transferência enviado!", { id: toastId });
      setModalTransferencia({ aberto: false, id: null, tipo: '' });
      setEmailInput('');
    } catch (e) { toast.error("Erro ao transferir.", { id: toastId }); } 
    setIsProcessando(false);
  };

  const cancelarTransferencia = async (id, col) => {
    await updateDoc(doc(db, col, id), { transferencia: null });
    toast.success("Transferência cancelada.");
  };

  const responderTransferencia = async (item, col, aceitar) => {
    if (aceitar) { 
      await updateDoc(doc(db, col, item.id), { donoId: user.uid, donoNome: user?.nome || user?.email, transferencia: null }); 
      toast.success("Convite aceito!"); 
    } else {
      await updateDoc(doc(db, col, item.id), { transferencia: null });
    }
  };

  const adicionarConvidado = async (espaco) => {
    if (!emailInput) return toast.error("Digite o e-mail.");
    setIsProcessando(true);
    try {
      const qUsuario = query(collection(db, "usuarios"), where("email", "==", emailInput.toLowerCase().trim()));
      const snapUsuario = await getDocs(qUsuario);
      if (snapUsuario.empty) { 
        toast.error("O amigo precisa criar uma conta no app primeiro."); 
        setIsProcessando(false);
        return; 
      }
      const novoConvidado = { uid: snapUsuario.docs[0].id, nome: snapUsuario.docs[0].data().nome || emailInput, email: emailInput };
      const novaLista = [...(espaco.convidados || []), novoConvidado];
      const novaListaIds = novaLista.map(c => c.uid);
      await updateDoc(doc(db, "espacos", espaco.id), { convidados: novaLista, convidadosIds: novaListaIds });
      setModalConvidados({ aberto: true, espaco: { ...espaco, convidados: novaLista, convidadosIds: novaListaIds } });
      setEmailInput('');
      toast.success("Amigo adicionado!");
    } catch (e) { toast.error("Erro ao adicionar amigo."); } 
    setIsProcessando(false);
  };

  const removerConvidado = async (espaco, idx) => {
    const novaLista = espaco.convidados?.filter((_, i) => i !== idx) || [];
    const novaListaIds = novaLista.map(c => c.uid);
    await updateDoc(doc(db, "espacos", espaco.id), { convidados: novaLista, convidadosIds: novaListaIds });
    setModalConvidados({ aberto: true, espaco: { ...espaco, convidados: novaLista, convidadosIds: novaListaIds } });
  };

  const gerarLinkConvite = (espacoId) => { 
    navigator.clipboard.writeText(`https://app.neonclub.com/vip-invite/${espacoId}`); 
    toast.success("Link copiado para o WhatsApp!"); 
  };

  // Coleta IDs únicos em segurança
  const IDsTodosEventos = Array.from(new Set([
    ...ingressos.map(i => i.eventoId), 
    ...reservas.map(r => r.eventoId), 
    ...espacosComoConvidado.map(c => c.eventoId)
  ])).filter(Boolean);

  const eventosProcessados = IDsTodosEventos.map(eventoId => {
    const festa = eventosGlobais.find(e => e.id === eventoId);
    if (!festa) return null; // Prevenção de Tela Branca se a festa for deletada

    // Verifica se a festa já rolou no calendário (> 24h)
    const dataFestaTime = festa.data ? new Date(festa.data).getTime() : 0;
    const eventoPassou = dataFestaTime > 0 ? (Date.now() - dataFestaTime) > (24 * 60 * 60 * 1000) : false;

    // Filtra ingressos do evento
    const ingressosEvento = ingressos.filter(i => i.eventoId === eventoId);
    const reservasEvento = reservas.filter(r => r.eventoId === eventoId);
    const convitesEvento = espacosComoConvidado.filter(c => c.eventoId === eventoId);

    // Vê se ainda tem algo válido pendente
    const ingressosPendentes = ingressosEvento.filter(i => i.status !== 'saiu' && i.status !== 'encerrado' && i.status !== 'usado');
    const reservasPendentes = reservasEvento.filter(r => !r.checkinFeito);
    
    // Se ele tiver zerado todos os ingressos, vai pro histórico
    const totalAcessos = ingressosEvento.length + reservasEvento.length;
    const totalPendentes = ingressosPendentes.length + reservasPendentes.length;
    
    const isHistorico = eventoPassou || (totalAcessos > 0 && totalPendentes === 0);

    return { eventoId, festa, isHistorico, ingressosEvento, reservasEvento, convitesEvento };
  }).filter(e => e !== null);

  const eventosExibidos = eventosProcessados.filter(e => abaAtiva === 'ativos' ? !e.isHistorico : e.isHistorico);

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Meus Ingressos</h1>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner">
          <button onClick={() => setAbaAtiva('ativos')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'ativos' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
            Disponíveis
          </button>
          <button onClick={() => setAbaAtiva('historico')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${abaAtiva === 'historico' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
            <Clock className="w-3.5 h-3.5" /> Histórico
          </button>
        </div>

        {abaAtiva === 'ativos' && (ingressosRecebidos.length > 0 || espacosRecebidos.length > 0) && (
          <div className="bg-indigo-600 text-white rounded-[2rem] p-6 shadow-xl mb-8 animate-fade-in">
            <h3 className="font-black text-xl mb-4 flex items-center gap-2"><Send className="w-5 h-5"/> Convites Recebidos</h3>
            <div className="space-y-3">
              {ingressosRecebidos.map(i => (
                <div key={i.id} className="bg-white/10 p-4 rounded-2xl border border-indigo-400/30">
                  <p className="font-bold text-sm mb-3 text-indigo-100">1 Ingresso Pista recebido de <br/><b className="text-white">{i.donoNome}</b></p>
                  <div className="flex gap-2">
                    <button onClick={() => responderTransferencia(i, 'ingressos_vendidos', true)} className="flex-[2] bg-white text-indigo-600 font-black py-2.5 rounded-xl shadow-sm hover:bg-indigo-50 transition">Aceitar</button>
                    <button onClick={() => responderTransferencia(i, 'ingressos_vendidos', false)} className="flex-[1] border border-indigo-400 font-black py-2.5 rounded-xl hover:bg-indigo-700 transition">Recusar</button>
                  </div>
                </div>
              ))}
              {espacosRecebidos.map(r => (
                <div key={r.id} className="bg-white/10 p-4 rounded-2xl border border-indigo-400/30">
                  <p className="font-bold text-sm mb-3 text-indigo-100">Titular VIP (<b className="text-white">{r.sigla}</b>) de <br/><b className="text-white">{r.donoNome}</b></p>
                  <div className="flex gap-2">
                    <button onClick={() => responderTransferencia(r, 'espacos', true)} className="flex-[2] bg-white text-indigo-600 font-black py-2.5 rounded-xl shadow-sm hover:bg-indigo-50 transition">Aceitar</button>
                    <button onClick={() => responderTransferencia(r, 'espacos', false)} className="flex-[1] border border-indigo-400 font-black py-2.5 rounded-xl hover:bg-indigo-700 transition">Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {eventosExibidos.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-zinc-300 rounded-[2rem] shadow-sm animate-fade-in">
            {abaAtiva === 'ativos' ? (
              <>
                <Ticket className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Sem Ingressos</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Explore os próximos eventos e garanta o seu.</p>
              </>
            ) : (
              <>
                <Clock className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Sem histórico</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Nenhum evento anterior encontrado.</p>
              </>
            )}
          </div>
        ) : (
          eventosExibidos.map(dadosEvento => {
            const { eventoId, festa, isHistorico, ingressosEvento, reservasEvento, convitesEvento } = dadosEvento;

            return (
              <div key={eventoId} className={`rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col transition-all ${isHistorico ? 'bg-zinc-50 opacity-90 grayscale-[0.3]' : 'bg-white'}`}>
                <div className={`p-6 text-white relative ${isHistorico ? 'bg-zinc-700' : 'bg-zinc-900'}`}>
                  {isHistorico && <span className="absolute top-6 right-6 bg-zinc-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded text-zinc-400 border border-zinc-600">Expirado</span>}
                  <h3 className="text-2xl font-black mb-1 pr-16">{festa?.nome || 'Evento'}</h3>
                  <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> Controle de Acesso</p>
                </div>
                
                <div className="p-6 space-y-4">
                  {ingressosEvento.map((i, idx) => {
                    const jaUsou = i.status === 'usado' || i.status === 'saiu' || i.status === 'encerrado';
                    return (
                      <div key={i.id} className="py-3 border-b border-zinc-100 last:border-0">
                        <div className="flex justify-between items-center mb-3">
                          <div><p className="font-black !text-zinc-900 flex items-center gap-1.5">Pista <span className="text-[10px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-md">#{idx + 1}</span></p></div>
                          <button onClick={() => setTicketModal({ tipo: 'ingresso', id: i.id, status: i.status, nome: festa?.nome })} disabled={i.transferencia?.status === 'pendente' || isHistorico} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${jaUsou || isHistorico ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                            {jaUsou ? 'Usado' : 'Mostrar QR'}
                          </button>
                        </div>
                        {!isHistorico && !i.transferencia && !jaUsou && (
                          <button onClick={() => setModalTransferencia({ aberto: true, id: i.id, tipo: 'ingresso' })} className="text-[10px] uppercase font-bold text-zinc-400 hover:text-indigo-600 transition flex items-center gap-1 w-fit mt-1">
                            <Send className="w-3 h-3"/> Transferir Titularidade
                          </button>
                        )}
                        {i.transferencia?.status === 'pendente' && (
                          <div className="flex justify-between items-center mt-2 bg-amber-50 border border-amber-100 p-2 rounded-lg">
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3"/> Enviado para: {i.transferencia.paraEmail}</span>
                            <button onClick={() => cancelarTransferencia(i.id, 'ingressos_vendidos')} className="text-[10px] font-black uppercase text-red-500 hover:underline">Cancelar</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  
                  {reservasEvento.map((r) => {
                    const jaEntrou = r.checkinFeito;
                    return (
                      <div key={r.id} className="py-3 border-b border-zinc-100 last:border-0">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <p className="font-black !text-zinc-900 flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-indigo-500"/> {r.sigla}</p>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Titular do Camarote</p>
                          </div>
                          <button onClick={() => setTicketModal({ tipo: 'espaco', id: r.id, status: jaEntrou ? 'usado' : 'valido', nome: festa?.nome })} disabled={r.transferencia?.status === 'pendente' || isHistorico} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${jaEntrou || isHistorico ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                            {jaEntrou ? 'Na Casa' : 'Mostrar QR'}
                          </button>
                        </div>
                        {!isHistorico && !jaEntrou && !r.transferencia && (
                          <div className="flex gap-4 mt-2">
                            <button onClick={() => setModalConvidados({ aberto: true, espaco: r })} className="text-[10px] uppercase font-bold text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition"><Users className="w-3 h-3" /> Gerenciar Lista VIP</button>
                            <button onClick={() => setModalTransferencia({ aberto: true, id: r.id, tipo: 'espaco' })} className="text-[10px] uppercase font-bold text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition"><Send className="w-3 h-3" /> Transferir</button>
                          </div>
                        )}
                        {r.transferencia?.status === 'pendente' && (
                          <div className="flex justify-between items-center mt-2 bg-amber-50 border border-amber-100 p-2 rounded-lg">
                            <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3"/> Transferindo para: {r.transferencia.paraEmail}</span>
                            <button onClick={() => cancelarTransferencia(r.id, 'espacos')} className="text-[10px] font-black uppercase text-red-500 hover:underline">Cancelar</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  
                  {convitesEvento.map((c) => (
                    <div key={c.id} className="py-3 border-b border-zinc-100 last:border-0 flex justify-between items-center">
                      <div>
                        <p className="font-black flex items-center gap-1 !text-zinc-900"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400"/> Convidado VIP</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Camarote {c.sigla}</p>
                      </div>
                      <button onClick={() => setTicketModal({ tipo: 'convidado', id: c.id, status: 'valido', nome: festa?.nome })} disabled={isHistorico} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${isHistorico ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                        Mostrar QR
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* MODAL: LISTA VIP E CONVITES */}
      {modalConvidados.aberto && modalConvidados.espaco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 bg-zinc-900 text-white relative">
              <button onClick={() => { setModalConvidados({ aberto: false, espaco: null }); setEmailInput(''); }} className="absolute top-6 right-6 text-zinc-400 hover:text-white transition"><X className="w-5 h-5"/></button>
              <h3 className="text-xl font-black mb-1">Lista VIP • {modalConvidados.espaco.sigla}</h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Capacidade: {modalConvidados.espaco.capacidade} Pessoas</p>
            </div>
            <div className="p-6 bg-zinc-50 border-b border-zinc-200 space-y-3">
              <button onClick={() => gerarLinkConvite(modalConvidados.espaco.id)} className="w-full bg-white border border-zinc-200 text-zinc-700 py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-black shadow-sm active:scale-95 transition"><Link className="w-4 h-4" /> Link de Convite (WhatsApp)</button>
              <div className="flex items-center gap-4 my-2"><div className="h-px bg-zinc-200 flex-1"></div><span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">OU ADCIONE ABAIXO</span><div className="h-px bg-zinc-200 flex-1"></div></div>
              <div className="flex gap-2">
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="E-mail do amigo cadastrado..." className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition"/>
                <button onClick={() => adicionarConvidado(modalConvidados.espaco)} disabled={isProcessando} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl font-bold flex items-center justify-center transition disabled:opacity-50"><Plus className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-black text-sm">TI</div>
                  <div><p className="font-black text-sm text-zinc-900">{user?.nome || 'Você'}</p><p className="text-[10px] text-indigo-600 font-black tracking-widest uppercase">Titular</p></div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-indigo-600 mr-2" />
              </div>
              
              {modalConvidados.espaco.convidados?.map((c, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-100 text-zinc-500 rounded-full flex items-center justify-center font-black text-sm"><User className="w-4 h-4"/></div>
                    <div><p className="font-black text-sm text-zinc-900">{c.nome}</p></div>
                  </div>
                  <button onClick={() => removerConvidado(modalConvidados.espaco, idx)} className="text-red-500 bg-red-50 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t border-zinc-200">
              <button onClick={() => { setModalConvidados({ aberto: false, espaco: null }); setEmailInput(''); }} className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black uppercase tracking-widest py-4 rounded-xl text-xs transition">
                Fechar Lista
              </button>
            </div>
          </div>
        </div>
      )}

      {modalTransferencia.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4"><Send className="w-8 h-8 text-indigo-600"/></div>
            <h3 className="text-xl font-black mb-2 text-zinc-900">Transferir Ingresso</h3>
            <p className="text-sm font-bold text-zinc-500 mb-6">Digite o e-mail do destinatário. Ele precisa ter conta criada no aplicativo.</p>
            <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="amigo@email.com" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-4 px-4 font-black mb-6 outline-none focus:border-indigo-500 transition text-center"/>
            <div className="flex gap-3 flex-col-reverse sm:flex-row">
              <button onClick={() => { setModalTransferencia({ aberto: false, id: null, tipo: '' }); setEmailInput(''); }} className="w-full bg-zinc-100 hover:bg-zinc-200 font-black py-4 rounded-2xl text-sm transition">Cancelar</button>
              <button onClick={solicitarTransferencia} disabled={isProcessando} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md">Enviar Convite</button>
            </div>
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-0 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl relative flex flex-col">
            <div className={`pt-10 p-8 text-center border-b border-dashed border-zinc-200 ${ticketModal.status === 'usado' ? 'bg-zinc-200 text-zinc-500' : 'bg-indigo-600 text-white'}`}>
              <button onClick={() => setTicketModal(null)} className="absolute top-5 right-5 text-white/70 hover:text-white transition"><X className="w-5 h-5"/></button>
              <h2 className="text-3xl font-black mb-1">{ticketModal.tipo === 'ingresso' ? 'Pista' : (ticketModal.tipo === 'convidado' ? 'Lista VIP' : 'Camarote Titular')}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{ticketModal.nome}</p>
            </div>
            
            <div className="p-8 flex flex-col items-center bg-zinc-50 relative">
              {ticketModal.status === 'usado' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[2px]">
                  <span className="text-3xl font-black text-zinc-300 border-4 px-6 py-2 rounded-2xl -rotate-12 flex items-center gap-2"><XCircle className="w-8 h-8" /> USADO</span>
                </div>
              )}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200 mb-6">
                <QRCode value={`${ticketModal.tipo}|${ticketModal.id}|${user.uid}`} size={200} level="H" />
              </div>
              
              {ticketModal.status !== 'usado' && (
                <div className="w-full bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0"><User className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">{ticketModal.tipo === 'convidado' ? 'Convidado VIP' : 'Titular do Ingresso'}</p>
                    <p className="text-sm font-black text-zinc-900 truncate">{user?.nome || user?.email}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-white border-t border-zinc-200">
              <button onClick={() => setTicketModal(null)} className="w-full bg-zinc-100 hover:bg-zinc-200 font-black uppercase tracking-widest py-4 rounded-2xl text-xs text-zinc-600 transition">Fechar QR Code</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}