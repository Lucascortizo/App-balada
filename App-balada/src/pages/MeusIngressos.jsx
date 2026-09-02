import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import BottomNav from '../components/BottomNav';
import { Ticket, Send, User, Users, Plus, Trash2, CheckCircle2, Link, Star, XCircle } from 'lucide-react';

export default function MeusIngressos() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [ingressos, setIngressos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [espacosComoConvidado, setEspacosComoConvidado] = useState([]); 
  const [ingressosRecebidos, setIngressosRecebidos] = useState([]);
  const [espacosRecebidos, setEspacosRecebidos] = useState([]);
  
  const [ticketModal, setTicketModal] = useState(null);
  const [modalTransferencia, setModalTransferencia] = useState({ aberto: false, id: null, tipo: '' });
  const [modalConvidados, setModalConvidados] = useState({ aberto: false, espaco: null });
  const [emailInput, setEmailInput] = useState('');
  const [isProcessando, setIsProcessando] = useState(false);

  useEffect(() => {
    if (!user) return; 
    const unsubEventos = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubIngressos = onSnapshot(query(collection(db, "ingressos_vendidos"), where("donoId", "==", user.uid)), snap => setIngressos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubReservas = onSnapshot(query(collection(db, "espacos"), where("donoId", "==", user.uid)), snap => setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubConvidados = onSnapshot(query(collection(db, "espacos"), where("convidadosIds", "array-contains", user.uid)), snap => setEspacosComoConvidado(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // Convites e transferências pendentes
    const unsubIngressosIn = onSnapshot(query(collection(db, "ingressos_vendidos"), where("transferencia.paraId", "==", user.uid)), snap => setIngressosRecebidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEspacosIn = onSnapshot(query(collection(db, "espacos"), where("transferencia.paraId", "==", user.uid)), snap => setEspacosRecebidos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubEventos(); unsubIngressos(); unsubReservas(); unsubConvidados(); unsubIngressosIn(); unsubEspacosIn(); };
  }, [user]);

  // ================= FUNÇÕES DE TRANSFERÊNCIA =================
  const solicitarTransferencia = async () => {
    if (!emailInput) return alert("Digite o e-mail.");
    setIsProcessando(true);
    try {
      const qUsuario = query(collection(db, "usuarios"), where("email", "==", emailInput.toLowerCase().trim()));
      const snapUsuario = await getDocs(qUsuario);
      
      if (snapUsuario.empty) {
        alert("Usuário não encontrado no aplicativo.");
        setIsProcessando(false);
        return;
      }
      
      const colecao = modalTransferencia.tipo === 'ingresso' ? 'ingressos_vendidos' : 'espacos';
      await updateDoc(doc(db, colecao, modalTransferencia.id), {
        transferencia: { status: 'pendente', paraId: snapUsuario.docs[0].id, paraEmail: emailInput.toLowerCase().trim() }
      });
      alert("Convite de transferência enviado!");
      setModalTransferencia({ aberto: false, id: null, tipo: '' });
      setEmailInput('');
    } catch (e) { alert("Erro ao transferir."); } 
    setIsProcessando(false);
  };

  const cancelarTransferencia = async (id, col) => {
    await updateDoc(doc(db, col, id), { transferencia: null });
  };

  const responderTransferencia = async (item, col, aceitar) => {
    if (aceitar) { 
      await updateDoc(doc(db, col, item.id), { donoId: user.uid, donoNome: user.nome || user.email, transferencia: null }); 
      alert("Convite aceito!"); 
    } else {
      await updateDoc(doc(db, col, item.id), { transferencia: null });
    }
  };

  // ================= FUNÇÕES DE LISTA VIP =================
  const adicionarConvidado = async (espaco) => {
    if (!emailInput) return alert("Digite o e-mail.");
    setIsProcessando(true);
    try {
      const qUsuario = query(collection(db, "usuarios"), where("email", "==", emailInput.toLowerCase().trim()));
      const snapUsuario = await getDocs(qUsuario);
      
      if (snapUsuario.empty) { 
        alert("O amigo precisa criar uma conta no app primeiro."); 
        setIsProcessando(false);
        return; 
      }
      
      const novoConvidado = { uid: snapUsuario.docs[0].id, nome: snapUsuario.docs[0].data().nome || emailInput, email: emailInput };
      const novaLista = [...(espaco.convidados || []), novoConvidado];
      const novaListaIds = novaLista.map(c => c.uid);
      
      await updateDoc(doc(db, "espacos", espaco.id), { convidados: novaLista, convidadosIds: novaListaIds });
      setModalConvidados({ aberto: true, espaco: { ...espaco, convidados: novaLista, convidadosIds: novaListaIds } });
      setEmailInput('');
    } catch (e) { alert("Erro ao adicionar amigo."); } 
    setIsProcessando(false);
  };

  const removerConvidado = async (espaco, idx) => {
    const novaLista = espaco.convidados.filter((_, i) => i !== idx);
    const novaListaIds = novaLista.map(c => c.uid);
    await updateDoc(doc(db, "espacos", espaco.id), { convidados: novaLista, convidadosIds: novaListaIds });
    setModalConvidados({ aberto: true, espaco: { ...espaco, convidados: novaLista, convidadosIds: novaListaIds } });
  };

  const gerarLinkConvite = (espacoId) => { 
    navigator.clipboard.writeText(`https://app.neonclub.com/vip-invite/${espacoId}`); 
    alert("Link de convite copiado!"); 
  };

  const IDsEventos = Array.from(new Set([
    ...ingressos.map(i=>i.eventoId), 
    ...reservas.map(r=>r.eventoId), 
    ...espacosComoConvidado.map(c=>c.eventoId)
  ])).filter(Boolean);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto">
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Meus Ingressos</h1>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        
        {/* CAIXA DE ENTRADA (CONVITES) */}
        {(ingressosRecebidos.length > 0 || espacosRecebidos.length > 0) && (
          <div className="bg-indigo-600 text-white rounded-[2rem] p-6 shadow-xl mb-8">
            <h3 className="font-black text-xl mb-4 flex items-center gap-2"><Send className="w-5 h-5"/> Convites Recebidos</h3>
            <div className="space-y-3">
              {ingressosRecebidos.map(i => (
                <div key={i.id} className="bg-white/10 p-4 rounded-2xl">
                  <p className="font-bold text-sm mb-3">1 Ingresso Pista recebido</p>
                  <div className="flex gap-2">
                    <button onClick={() => responderTransferencia(i, 'ingressos_vendidos', true)} className="flex-[2] bg-white text-indigo-600 font-black py-2 rounded-xl">Aceitar</button>
                    <button onClick={() => responderTransferencia(i, 'ingressos_vendidos', false)} className="flex-[1] border font-black py-2 rounded-xl">Recusar</button>
                  </div>
                </div>
              ))}
              {espacosRecebidos.map(r => (
                <div key={r.id} className="bg-white/10 p-4 rounded-2xl">
                  <p className="font-bold text-sm mb-3">Titularidade VIP ({r.sigla})</p>
                  <div className="flex gap-2">
                    <button onClick={() => responderTransferencia(r, 'espacos', true)} className="flex-[2] bg-white text-indigo-600 font-black py-2 rounded-xl">Aceitar</button>
                    <button onClick={() => responderTransferencia(r, 'espacos', false)} className="flex-[1] border font-black py-2 rounded-xl">Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LISTAGEM DOS INGRESSOS */}
        {IDsEventos.length === 0 ? (
          <div className="text-center py-16 bg-white border rounded-[2rem]">
            <Ticket className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
            <h3 className="text-lg font-black text-zinc-800">Sem Ingressos</h3>
          </div>
        ) : (
          IDsEventos.map(eventoId => {
            const festa = eventosGlobais.find(e => e.id === eventoId);
            return (
              <div key={eventoId} className="bg-white rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 bg-zinc-900 text-white">
                  <h3 className="text-2xl font-black mb-1">{festa?.nome || 'Evento'}</h3>
                  <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Acesso à Portaria</p>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* INGRESSOS PISTA */}
                  {ingressos.filter(i => i.eventoId === eventoId).map((i, idx) => (
                    <div key={i.id} className="py-3 border-b border-zinc-100 last:border-0">
                      <div className="flex justify-between items-center mb-3">
                        <div><p className="font-black">Pista #{idx + 1}</p></div>
                        <button onClick={() => setTicketModal({ tipo: 'ingresso', id: i.id, status: i.status, nome: festa?.nome })} disabled={i.transferencia?.status === 'pendente'} className={`px-4 py-2 rounded-xl text-xs font-bold ${i.status === 'usado' ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 text-indigo-600'}`}>
                          {i.status === 'usado' ? 'Usado' : 'Mostrar QR'}
                        </button>
                      </div>
                      {!i.transferencia && i.status !== 'usado' && (
                        <button onClick={() => setModalTransferencia({ aberto: true, id: i.id, tipo: 'ingresso' })} className="text-[10px] uppercase font-bold text-zinc-400">
                          <Send className="w-3 h-3 inline mr-1"/> Transferir Titularidade
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {/* CAMAROTES DO TITULAR */}
                  {reservas.filter(r => r.eventoId === eventoId).map((r) => (
                    <div key={r.id} className="py-3 border-b border-zinc-100 last:border-0">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="font-black">{r.sigla}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase">Titular do Camarote</p>
                        </div>
                        <button onClick={() => setTicketModal({ tipo: 'espaco', id: r.id, status: r.checkinFeito ? 'usado' : 'valido', nome: festa?.nome })} disabled={r.transferencia?.status === 'pendente'} className={`px-4 py-2 rounded-xl text-xs font-bold ${r.checkinFeito ? 'bg-zinc-100 text-zinc-400' : 'bg-indigo-50 text-indigo-600'}`}>
                          Mostrar QR
                        </button>
                      </div>
                      {!r.checkinFeito && !r.transferencia && (
                        <div className="flex gap-4">
                          <button onClick={() => setModalConvidados({ aberto: true, espaco: r })} className="text-[10px] uppercase font-bold text-indigo-600">
                            <Users className="w-3 h-3 inline mr-1" /> Gerenciar Lista VIP
                          </button>
                          <button onClick={() => setModalTransferencia({ aberto: true, id: r.id, tipo: 'espaco' })} className="text-[10px] uppercase font-bold text-zinc-400">
                            <Send className="w-3 h-3 inline mr-1" /> Transferir
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* CAMAROTES COMO CONVIDADO DA LISTA VIP */}
                  {espacosComoConvidado.filter(c => c.eventoId === eventoId).map((c) => (
                    <div key={c.id} className="py-3 border-b border-zinc-100 last:border-0 flex justify-between items-center">
                      <div>
                        <p className="font-black flex items-center gap-1"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/> Convidado VIP</p>
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">{c.sigla}</p>
                      </div>
                      <button onClick={() => setTicketModal({ tipo: 'convidado', id: c.id, status: 'valido', nome: festa?.nome })} className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-6 bg-zinc-900 text-white">
              <h3 className="text-xl font-black mb-1">Lista VIP • {modalConvidados.espaco.sigla}</h3>
            </div>
            <div className="p-6 bg-zinc-50 border-b border-zinc-200 space-y-3">
              <button onClick={() => gerarLinkConvite(modalConvidados.espaco.id)} className="w-full bg-white border border-zinc-200 text-zinc-700 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-black shadow-sm">
                <Link className="w-4 h-4" /> Link de Convite (WhatsApp)
              </button>
              <div className="flex items-center gap-4 my-2"><div className="h-px bg-zinc-200 flex-1"></div><span className="text-[10px] font-black uppercase text-zinc-400">OU</span><div className="h-px bg-zinc-200 flex-1"></div></div>
              <div className="flex gap-2">
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="E-mail do amigo" className="flex-1 bg-white border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500"/>
                <button onClick={() => adicionarConvidado(modalConvidados.espaco)} disabled={isProcessando} className="bg-indigo-600 text-white px-4 rounded-xl font-bold flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-200 text-indigo-700 rounded-full flex items-center justify-center font-black text-xs">TI</div>
                  <div>
                    <p className="font-black text-sm text-zinc-900">{user.nome}</p>
                    <p className="text-[10px] text-indigo-600 font-bold uppercase">Titular</p>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              </div>
              {modalConvidados.espaco.convidados?.map((c, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-zinc-200 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-100 text-zinc-500 rounded-full flex items-center justify-center font-black text-xs"><User className="w-4 h-4"/></div>
                    <div><p className="font-black text-sm text-zinc-900">{c.nome}</p></div>
                  </div>
                  <button onClick={() => removerConvidado(modalConvidados.espaco, idx)} className="text-red-400 bg-red-50 p-2 rounded-lg">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t border-zinc-200">
              <button onClick={() => { setModalConvidados({ aberto: false, espaco: null }); setEmailInput(''); }} className="w-full bg-zinc-100 text-zinc-800 font-black uppercase tracking-widest py-4 rounded-xl text-xs">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFERÊNCIA */}
      {modalTransferencia.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl">
            <h3 className="text-xl font-black mb-2">Transferir Ingresso</h3>
            <p className="text-sm text-zinc-500 mb-6">Digite o e-mail do destinatário. Ele precisa ter conta no app.</p>
            <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="E-mail do novo dono" className="w-full bg-zinc-50 border rounded-xl py-4 px-4 font-bold mb-4 outline-none focus:border-indigo-500"/>
            <div className="flex gap-3">
              <button onClick={() => { setModalTransferencia({ aberto: false, id: null, tipo: '' }); setEmailInput(''); }} className="flex-1 bg-zinc-100 font-bold py-4 rounded-xl">Cancelar</button>
              <button onClick={solicitarTransferencia} disabled={isProcessando} className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl">Enviar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE DE CATRACA */}
      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-0 sm:p-6">
          <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-3xl overflow-hidden shadow-2xl relative">
            <div className={`pt-12 p-8 text-center border-b border-dashed border-zinc-200 ${ticketModal.status === 'usado' ? 'bg-zinc-200 text-zinc-500' : 'bg-indigo-600 text-white'}`}>
              <h2 className="text-3xl font-black mb-1">{ticketModal.tipo === 'ingresso' ? 'Pista' : (ticketModal.tipo === 'convidado' ? 'Lista VIP' : 'Camarote Titular')}</h2>
              <p className="text-xs font-bold uppercase opacity-80">{ticketModal.nome}</p>
            </div>
            <div className="p-8 flex flex-col items-center bg-zinc-50 relative">
              {ticketModal.status === 'usado' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                  <span className="text-3xl font-black text-zinc-300 border-4 px-6 py-2 rounded-2xl -rotate-12 flex items-center gap-2"><XCircle className="w-8 h-8" /> USADO</span>
                </div>
              )}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-zinc-200">
                <QRCode value={`${ticketModal.tipo}|${ticketModal.id}|${user.uid}`} size={200} />
              </div>
              {ticketModal.status !== 'usado' && (
                <div className="mt-6 w-full bg-white p-4 rounded-2xl border shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><User className="w-5 h-5" /></div>
                  <div>
                    <p className="text-[10px] text-zinc-400 font-black uppercase mb-0.5">{ticketModal.tipo === 'convidado' ? 'Convidado VIP' : 'Titular'}</p>
                    <p className="text-sm font-black text-zinc-900 truncate">{user.nome || user.email}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-white">
              <button onClick={() => setTicketModal(null)} className="w-full bg-zinc-100 font-black uppercase py-4 rounded-xl text-sm">Fechar</button>
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}