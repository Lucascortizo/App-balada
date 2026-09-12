import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, doc, updateDoc, setDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import { useComanda } from '../hooks/useComanda'; // NOSSO NOVO HOOK!
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { criarPasseSaidaRef } from '../services/passesSaida';
import BottomNav from '../components/BottomNav';
import { Wine, Unlock, PieChart, CheckCircle2, ShoppingBag, QrCode, CreditCard, Clock, Receipt, X } from 'lucide-react';

export default function MinhaConta() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // Todo aquele bloco gigante de useEffect e cálculos complexos virou 1 linha mágica:
  const { comandasProcessadas, cobrancasPendentes, carregando } = useComanda(user);
  
  const [abaComanda, setAbaComanda] = useState('ativas');
  const [ticketModal, setTicketModal] = useState(null);
  const [modalSplit, setModalSplit] = useState({ aberto: false, eventoId: null, total: 0, espaco: null });
  const [splitModo, setSplitModo] = useState('tudo'); 
  const [splitValorCustom, setSplitValorCustom] = useState('');
  const [splitSelecionados, setSplitSelecionados] = useState([]); 
  const [isProcessando, setIsProcessando] = useState(false);

  // ================= AÇÕES E TRANSAÇÕES =================
  const abrirModalSplit = (eventoId, total, espacoVIP, isNoEvento) => {
    if (!isNoEvento || !espacoVIP?.checkinFeito) {
      return toast.error('O racha só pode ser iniciado depois que o titular entrar na festa.');
    }

    const convidadosDentro = (espacoVIP.convidados || []).filter((c) => c.entrou === true);
    if (!convidadosDentro.length) {
      return toast.error('Nenhum convidado elegível entrou na festa ainda.');
    }

    setModalSplit({ aberto: true, eventoId, total, espaco: espacoVIP });
    setSplitModo('tudo'); 
    setSplitValorCustom(''); 
    setSplitSelecionados(convidadosDentro.map(c => c.uid)); 
  };

  const enviarCobrancasSplit = async () => {
    const valorBase = splitModo === 'tudo' ? modalSplit.total : parseFloat(splitValorCustom);
    if (!valorBase || valorBase <= 0 || splitSelecionados.length === 0) return toast.error("Dados inválidos para rachar a conta.");
    
    setIsProcessando(true);
    const toastId = toast.loading('Enviando convites de racha...');

    try {
      const espacosSnap = await getDocs(query(
        collection(db, 'espacos'),
        where('eventoId', '==', modalSplit.eventoId),
        where('donoId', '==', user.uid)
      ));

      const espacoAtual = espacosSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((espaco) => espaco.checkinFeito === true);

      if (!espacoAtual) {
        throw new Error('O titular ainda não está dentro da festa.');
      }

      const convidadosDentro = Array.isArray(espacoAtual.convidados)
        ? espacoAtual.convidados.filter((c) => c.entrou === true)
        : [];

      const convidadosSelecionados = splitSelecionados
        .map((uid) => convidadosDentro.find((c) => c.uid === uid))
        .filter(Boolean);

      if (convidadosSelecionados.length !== splitSelecionados.length) {
        throw new Error('Só é possível rachar com convidados que já entraram na festa.');
      }

      const valor = valorBase / (convidadosSelecionados.length + 1);
      await Promise.all(convidadosSelecionados.map((amigo) => {
        const amigoId = amigo.uid;
        return addDoc(collection(db, "cobrancas_split"), {
          eventoId: modalSplit.eventoId, deId: user.uid, deNome: user.nome || user.email, 
          paraId: amigoId, paraNome: amigo.nome, valor, status: 'pendente', criadoEm: new Date().toISOString()
        });
      }));
      toast.success("Racha enviado aos amigos!", { id: toastId }); 
      setModalSplit({ aberto: false, eventoId: null, total: 0, espaco: null });
    } catch (e) { 
      toast.error("Erro ao enviar cobranças.", { id: toastId }); 
    } finally {
      setIsProcessando(false);
    }
  };

  const responderSplit = async (cobranca, aceitar) => {
    if (!aceitar) {
      await updateDoc(doc(db, "cobrancas_split", cobranca.id), { status: 'recusado' });
      return toast.success('Racha recusado.');
    }
    
    setIsProcessando(true);
    const toastId = toast.loading('Processando aceite...');
    try { 
      const espacosSnap = await getDocs(query(
        collection(db, 'espacos'),
        where('eventoId', '==', cobranca.eventoId),
        where('convidadosIds', 'array-contains', user.uid)
      ));

      const convidadoDentro = espacosSnap.docs
        .map((d) => d.data())
        .some((espaco) => espaco.checkinFeito === true && (espaco.convidados || []).some((c) => c.uid === user.uid && c.entrou === true));

      if (!convidadoDentro) {
        throw new Error('Você precisa entrar na festa antes de aceitar o racha.');
      }

      await updateDoc(doc(db, "cobrancas_split", cobranca.id), { status: 'aceito' }); 
      toast.success("Racha aceito! Valor adicionado na sua comanda.", { id: toastId }); 
    } catch (e) { 
      toast.error("Erro ao aceitar.", { id: toastId }); 
    } finally { 
      setIsProcessando(false); 
    }
  };

  // Função já refatorada e blindada contra falhas de internet
  const realizarPagamento = async (eventoId, valor) => {
    setIsProcessando(true);
    const toastId = toast.loading('Processando pagamento...');

    try {
      const comandasSnap = await getDocs(query(
        collection(db, 'comandas_ativas'),
        where('eventoId', '==', eventoId),
        where('clienteId', '==', user.uid)
      ));

      const comandaAberta = comandasSnap.docs.find((d) => d.data().status === 'aberta');

      if (!comandaAberta) throw new Error('Comanda ativa não encontrada.');

      const agora = new Date().toISOString();
      const pagamentoRef = doc(collection(db, 'pagamentos_comanda'));
      const passeRef = criarPasseSaidaRef();
      const batch = writeBatch(db);

      const espacosConvidadoSnap = await getDocs(query(
        collection(db, 'espacos'),
        where('eventoId', '==', eventoId),
        where('convidadosIds', 'array-contains', user.uid)
      ));

      const espacoConvidado = espacosConvidadoSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((espaco) =>
          espaco.checkinFeito === true &&
          (espaco.convidados || []).some((convidado) =>
            convidado.uid === user.uid &&
            convidado.entrou === true &&
            convidado.saiu !== true
          )
        );

      batch.set(pagamentoRef, {
        eventoId,
        clienteId: user.uid,
        clienteNome: user.nome || user.email,
        valorPago: Number(valor) || 0,
        dataPagamento: agora,
        metodo: 'app',
        operadorCaixa: false,
        status: 'confirmado',
        comandaId: comandaAberta.id,
      });

      batch.update(comandaAberta.ref, {
        status: 'paga',
        pagoEm: agora,
        valorPago: Number(valor) || 0,
        formaPagamentoFechamento: 'app',
        pagamentoId: pagamentoRef.id,
        ultimaAtualizacaoEm: agora,
      });

      batch.set(passeRef, {
        eventoId,
        clienteId: user.uid,
        clienteNome: user.nome || user.email,
        comandaId: comandaAberta.id,
        pagamentoId: pagamentoRef.id,
        tipoAcesso: espacoConvidado ? 'convidado' : 'cliente',
        espacoId: espacoConvidado?.id || null,
        convidadoId: espacoConvidado ? user.uid : null,
        status: 'disponivel',
        criadoEm: agora,
        origem: 'app',
      });

      await batch.commit();

      toast.success('Pagamento confirmado! Passe de saída liberado.', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Falha ao processar o pagamento.', { id: toastId });
    } finally {
      setIsProcessando(false);
    }
  };


  const criarPasseDepoisDoPagamento = async (eventoId, comanda, passeSaidaAtivo) => {
    if (passeSaidaAtivo) {
      setTicketModal({ tipo: 'saida', id: passeSaidaAtivo.id, nome: 'Passe de Saída' });
      return;
    }
    if (!comanda || !['aberta', 'paga'].includes(comanda.status)) {
      toast.error('A comanda não está disponível para saída.');
      return;
    }

    setIsProcessando(true);
    try {
      const agora = new Date().toISOString();
      const ref = criarPasseSaidaRef();
      const batch = writeBatch(db);

      const espacosConvidadoSnap = await getDocs(query(
        collection(db, 'espacos'),
        where('eventoId', '==', eventoId),
        where('convidadosIds', 'array-contains', user.uid)
      ));

      const espacoConvidado = espacosConvidadoSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .find((espaco) =>
          espaco.checkinFeito === true &&
          (espaco.convidados || []).some((convidado) =>
            convidado.uid === user.uid &&
            convidado.entrou === true &&
            convidado.saiu !== true
          )
        );

      if (comanda.status === 'aberta') {
        const valorFechamento = 0;
        batch.update(doc(db, 'comandas_ativas', comanda.id), {
          status: 'paga',
          pagoEm: agora,
          valorPago: valorFechamento,
          formaPagamentoFechamento: 'sem_cobranca',
          ultimaAtualizacaoEm: agora,
        });
      }

      batch.set(ref, {
        eventoId,
        clienteId: user.uid,
        clienteNome: user.nome || user.email,
        comandaId: comanda.id,
        pagamentoId: comanda.pagamentoId || null,
        tipoAcesso: espacoConvidado ? 'convidado' : 'cliente',
        espacoId: espacoConvidado?.id || null,
        convidadoId: espacoConvidado ? user.uid : null,
        status: 'disponivel',
        criadoEm: agora,
        origem: 'app_reemissao',
      });

      await batch.commit();
      setTicketModal({ tipo: 'saida', id: ref.id, nome: 'Passe de Saída' });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível gerar o passe de saída.');
    } finally {
      setIsProcessando(false);
    }
  };

  // ================= RENDERIZAÇÃO =================
  if (!user || carregando) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  const comandasFiltradas = comandasProcessadas.filter(e => abaComanda === 'ativas' ? !e.isHistorico : e.isHistorico);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto">
        <h1 className="text-3xl font-black tracking-tight !text-zinc-900">Comanda & Bar</h1>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        
        {/* ================= ABAS DE NAVEGAÇÃO ================= */}
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner">
          <button onClick={() => setAbaComanda('ativas')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaComanda === 'ativas' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
            Em Aberto
          </button>
          <button onClick={() => setAbaComanda('historico')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${abaComanda === 'historico' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}>
            <Receipt className="w-3.5 h-3.5" /> Histórico
          </button>
        </div>

        {cobrancasPendentes.length > 0 && abaComanda === 'ativas' && (
          <div className="bg-amber-100 text-amber-900 rounded-[2rem] p-6 shadow-md mb-8 animate-fade-in">
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
          <div className="text-center py-16 bg-white border border-dashed border-zinc-300 rounded-[2rem] shadow-sm animate-fade-in">
            {abaComanda === 'ativas' ? (
              <>
                <ShoppingBag className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Sua comanda está limpa</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Compre um ingresso ou reserve um espaço para abrir sua comanda.</p>
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
          comandasFiltradas.map((dados) => {
            const {
              eventoId,
              festa,
              espacoVIP,
              isNoEvento,
              totalConsumacao,
              totalBar,
              totalPago,
              splitsDescontados,
              splitsAssumidos,
              gastoExtra,
              saldoDevedor,
              isPago,
              isHistorico,
              meusPedidosNaFesta,
              passeSaidaAtivo,
              comandaAtiva,
            } = dados;

            const valorUsadoDaConsumacao = Math.min(totalBar, totalConsumacao);
            const consumacaoRestante = Math.max(0, totalConsumacao - totalBar);
            const percentualUsado = totalConsumacao > 0 ? (valorUsadoDaConsumacao / totalConsumacao) * 100 : 0;

            return (
              <div key={eventoId} className={`rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col animate-fade-in ${isHistorico ? 'bg-zinc-50 opacity-90 grayscale-[0.3]' : 'bg-white'}`}>
                
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

                {/* ================= PAINEL DE CONSUMAÇÃO ================= */}
                <div className="bg-zinc-50 border-b border-zinc-100 p-6">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5"/> Resumo da Conta</h4>
                  
                  {totalConsumacao > 0 ? (
                    <div className="space-y-3">
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
                        
                        <div className="w-full bg-zinc-100 rounded-full h-2.5 mb-2.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${consumacaoRestante === 0 ? 'bg-zinc-800' : 'bg-emerald-500'}`} style={{ width: `${percentualUsado}%` }}></div>
                        </div>
                        
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          <span>Usado: R$ {valorUsadoDaConsumacao.toFixed(2)}</span>
                          <span>{percentualUsado.toFixed(0)}%</span>
                        </div>
                      </div>

                      {gastoExtra > 0 && (
                        <div className="flex items-center justify-between bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl animate-fade-in">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"><ShoppingBag className="h-3 w-3" /></span>
                            <p className="font-black text-[11px] uppercase tracking-widest text-zinc-600">Comanda Extra</p>
                          </div>
                          <p className="font-black text-lg text-indigo-700">R$ {gastoExtra.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><ShoppingBag className="h-4 w-4" /></span>
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
                      <button
                        onClick={() => {
                          criarPasseDepoisDoPagamento(eventoId, comandaAtiva, passeSaidaAtivo);
                        }}
                        className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-colors active:scale-95"
                      >
                        <Unlock className="w-5 h-5" /> {passeSaidaAtivo ? 'Mostrar Passe de Saída' : 'Gerar Passe de Saída'}
                      </button>
                    ) : (
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => realizarPagamento(eventoId, saldoDevedor)} disabled={isProcessando} className="flex-[2] bg-zinc-900 hover:bg-black text-white font-black py-4 rounded-xl shadow-md transition-colors active:scale-95 disabled:opacity-50">
                          Pagar Agora
                        </button>
                        {espacoVIP && isNoEvento && (
                          <button onClick={() => abrirModalSplit(eventoId, saldoDevedor, espacoVIP, isNoEvento)} className="flex-[1] bg-white border border-zinc-200 text-indigo-600 font-bold py-4 rounded-xl flex flex-col items-center justify-center hover:bg-indigo-50 transition-colors">
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
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center relative">
            <button onClick={() => setModalSplit({aberto:false, eventoId:null, total:0, espaco:null})} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 transition"><X className="w-5 h-5"/></button>
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
                const isDentro = c.entrou === true;
                const isChecked = splitSelecionados.includes(c.uid);
                return (
                  <button key={c.uid} disabled={!isDentro} onClick={() => { if (!isDentro) return; if (isChecked) setSplitSelecionados(splitSelecionados.filter(id => id !== c.uid)); else setSplitSelecionados([...splitSelecionados, c.uid]); }} className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${isChecked ? 'border-indigo-500 bg-white shadow-sm' : 'bg-zinc-50 border-zinc-200'} ${!isDentro ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${isChecked ? 'text-indigo-600' : 'text-zinc-300'}`}/>
                    <div className="min-w-0"><p className={`font-bold text-sm truncate ${isChecked ? 'text-zinc-900' : 'text-zinc-500'}`}>{c.nome}</p>{!isDentro && <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mt-0.5">Aguardando entrada</p>}</div>
                  </button>
                )
              })}
            </div>
            <button onClick={enviarCobrancasSplit} disabled={isProcessando || splitSelecionados.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50">Cobrar Amigos</button>
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm p-8 rounded-[2.5rem] shadow-2xl text-center relative">
            <button onClick={() => setTicketModal(null)} className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-900 transition"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-8 !text-zinc-900">{ticketModal.nome}</h2>
            <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 flex justify-center mb-8">
              <QRCode value={ticketModal.tipo === 'saida' ? `saida|${ticketModal.id}` : `${ticketModal.tipo}|${ticketModal.id}|${user.uid}`} size={200} />
            </div>
            <button onClick={() => setTicketModal(null)} className="w-full bg-zinc-100 hover:bg-zinc-200 font-black uppercase tracking-widest py-4 rounded-2xl text-sm text-zinc-600 transition-colors">Fechar Ingresso</button>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}