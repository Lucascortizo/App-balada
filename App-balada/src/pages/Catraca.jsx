import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { ScanLine, CheckCircle2, XCircle, ShieldCheck, RefreshCw, Search } from 'lucide-react';

export default function Catraca() {
  const navigate = useNavigate();
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  
  // ======== INÍCIO DAS VARIÁVEIS INJETADAS PARA A BUSCA MANUAL ========
  const [abaAtiva, setAbaAtiva] = useState('scanner'); // 'scanner' ou 'busca'
  const [termoBusca, setTermoBusca] = useState('');
  const [ingressosBusca, setIngressosBusca] = useState([]);
  const [isBuscando, setIsBuscando] = useState(false);
  // ======== FIM DAS VARIÁVEIS INJETADAS ========

  // Controle do Scanner
  const [statusLeitura, setStatusLeitura] = useState('aguardando'); // 'aguardando', 'processando', 'sucesso', 'erro'
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "eventos"), snap => {
      setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const validarQRCode = async (textoQrCode) => {
    if (statusLeitura !== 'aguardando') return; 
    setStatusLeitura('processando');

    try {
      const partes = textoQrCode.split('|');
      const tipo = partes[0]; 
      const idItem = partes[1];
      const idUsuario = partes[2];

      if (!tipo || !idItem) {
        toast.error('QR Code Inválido ou Ilegível.');
        lancarResultado('erro', 'QR Code não reconhecido pelo sistema.');
        return;
      }

      // 1. LÓGICA DE ENTRADA (PISTA)
      if (tipo === 'ingresso') {
        const docRef = doc(db, 'ingressos_vendidos', idItem);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) return lancarResultado('erro', 'Ingresso não encontrado no banco.');
        
        const ingresso = snap.data();
        if (ingresso.status === 'usado') {
          toast.error('Ingresso já foi utilizado!');
          return lancarResultado('erro', `Barrado! Já utilizado por ${ingresso.donoNome}.`);
        }
        
        await updateDoc(docRef, { status: 'usado', dataUso: new Date().toISOString() });
        toast.success('Entrada Liberada!');
        return lancarResultado('sucesso', `Entrada Pista liberada para ${ingresso.donoNome}.`);
      }

      // 2. LÓGICA DE ENTRADA (TITULAR CAMAROTE)
      if (tipo === 'espaco') {
        const docRef = doc(db, 'espacos', idItem);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) return lancarResultado('erro', 'Camarote não encontrado.');
        
        const espaco = snap.data();
        if (espaco.checkinFeito) {
          toast.error('Check-in já realizado.');
          return lancarResultado('erro', `O titular (${espaco.donoNome}) já está na casa.`);
        }
        
        await updateDoc(docRef, { checkinFeito: true, checkinEm: new Date().toISOString() });
        toast.success('Titularidade Confirmada!');
        return lancarResultado('sucesso', `Acesso VIP Liberado: ${espaco.sigla} - Titular: ${espaco.donoNome}`);
      }

      // 3. LÓGICA DE ENTRADA (CONVIDADO VIP)
      if (tipo === 'convidado') {
        const docRef = doc(db, 'espacos', idItem);
        const snap = await getDoc(docRef);
        const espaco = snap.data();
        
        const amigo = espaco.convidados?.find(c => c.uid === idUsuario);
        if (!amigo) {
          toast.error('Não está na lista VIP.');
          return lancarResultado('erro', 'Barrado! Convidado não consta na lista deste camarote.');
        }

        toast.success('Lista VIP Confirmada!');
        return lancarResultado('sucesso', `Convidado VIP Liberado: ${amigo.nome} (${espaco.sigla})`);
      }

      // 4. LÓGICA DO BAR (RETIRADA DE BEBIDA)
      if (tipo === 'retirada') {
        const docRef = doc(db, 'pedidos', idItem);
        const snap = await getDoc(docRef);
        const pedido = snap.data();

        if (pedido.status === 'entregue') {
          toast.error('Bebida já retirada!');
          return lancarResultado('erro', 'Atenção! Esta bebida já foi entregue.');
        }

        await updateDoc(docRef, { status: 'entregue' });
        toast.success('Bebida Entregue!');
        return lancarResultado('sucesso', `Ficha Baixada! Pedido de ${pedido.clienteNome} concluído.`);
      }

      // 5. LÓGICA DE SAÍDA (PAGAMENTO DA COMANDA)
      if (tipo === 'saida') {
        const eventoId = partes[1];
        const clienteId = partes[2];

        const espacosSnap = await getDocs(query(collection(db, "espacos"), where("eventoId", "==", eventoId), where("donoId", "==", clienteId)));
        const pedidosSnap = await getDocs(query(collection(db, "pedidos"), where("eventoId", "==", eventoId), where("clienteId", "==", clienteId)));
        const pagamentosSnap = await getDocs(query(collection(db, "pagamentos_comanda"), where("eventoId", "==", eventoId), where("clienteId", "==", clienteId)));
        const splitsEnviadosSnap = await getDocs(query(collection(db, "cobrancas_split"), where("eventoId", "==", eventoId), where("deId", "==", clienteId), where("status", "==", "aceito")));
        const splitsRecebidosSnap = await getDocs(query(collection(db, "cobrancas_split"), where("eventoId", "==", eventoId), where("paraId", "==", clienteId), where("status", "==", "aceito")));

        const totalVIP = espacosSnap.docs.reduce((a, d) => a + (d.data().consumacao || 0), 0);
        const totalBar = pedidosSnap.docs.reduce((a, d) => a + (d.data().total || 0), 0);
        const totalPago = pagamentosSnap.docs.reduce((a, d) => a + (d.data().valorPago || 0), 0);
        const descSplits = splitsEnviadosSnap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);
        const adcSplits = splitsRecebidosSnap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);

        const saldoDevedor = Math.max(0, totalBar + adcSplits - totalVIP - totalPago - descSplits);

        if (saldoDevedor > 0) {
          toast.error('Comanda em aberto!');
          return lancarResultado('erro', `BARRADO! Cliente possui R$ ${saldoDevedor.toFixed(2)} em aberto.`);
        }

        toast.success('Saída Liberada!');
        return lancarResultado('sucesso', 'Comanda Zerada. Pode liberar a catraca de saída!');
      }

      toast.error('Formato não reconhecido');
      lancarResultado('erro', 'Código QR inválido para a operação atual.');

    } catch (error) {
      toast.error('Erro de conexão');
      lancarResultado('erro', 'Erro ao validar o ingresso com o banco de dados.');
    }
  };

  const lancarResultado = (status, mensagem) => {
    setResultado(mensagem);
    setStatusLeitura(status);
  };

  const resetarScanner = () => {
    setStatusLeitura('aguardando');
    setResultado(null);
  };

  // ======== INÍCIO DA LÓGICA INJETADA (FUNÇÕES DE BUSCA DA HOSTESS) ========
  const buscarIngressoManual = async (e) => {
    e.preventDefault();
    if (!termoBusca) return;
    setIsBuscando(true);
    
    try {
      // Como você não tinha índice pra donoNome, puxamos os da festa e filtramos no app
      const q = query(collection(db, "ingressos_vendidos"), where("eventoId", "==", eventoSelecionado.id));
      const snap = await getDocs(q);
      
      const resultados = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(ing => 
        ing.donoNome.toLowerCase().includes(termoBusca.toLowerCase())
      );

      if (resultados.length === 0) {
        toast.error("Nenhum ingresso encontrado para esse nome nesta festa.");
      }
      setIngressosBusca(resultados);
    } catch (error) {
      toast.error("Erro ao buscar a lista.");
    }
    setIsBuscando(false);
  };

  const darBaixaManual = async (ingressoId) => {
    if(!window.confirm("Liberar a entrada deste cliente manualmente? Ele não poderá usar o QR Code depois.")) return;
    try {
      await updateDoc(doc(db, "ingressos_vendidos", ingressoId), { status: 'usado', dataUso: new Date().toISOString() });
      toast.success("ENTRADA LIBERADA!", { style: { background: '#10b981', color: '#fff' } });
      
      // Atualiza a listinha na tela pra ficar verdinha
      setIngressosBusca(ingressosBusca.map(ing => ing.id === ingressoId ? { ...ing, status: 'usado' } : ing));
    } catch (error) {
      toast.error("Erro ao liberar cliente.");
    }
  };
  // ======== FIM DA LÓGICA INJETADA ========

  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
        <header className="bg-white p-8 border-b border-zinc-200 shadow-sm rounded-b-[2rem]">
          <h1 className="text-3xl font-black flex items-center gap-2 tracking-tight text-zinc-900">
            <ShieldCheck className="text-indigo-600 w-8 h-8"/> Segurança
          </h1>
          <p className="text-zinc-500 text-sm mt-1 font-bold">Controle de Acesso e Catraca</p>
        </header>
        
        <main className="max-w-md mx-auto p-6 space-y-4 mt-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Selecione o Evento Operante</h2>
          {eventosGlobais.map(evento => (
            <button key={evento.id} onClick={() => setEventoSelecionado(evento)} className="w-full bg-white border border-zinc-200 p-6 rounded-3xl text-left hover:border-indigo-500 transition-all active:scale-95 shadow-sm">
              <h3 className="text-xl font-black text-zinc-900">{evento.nome}</h3>
              <p className="text-indigo-600 text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2"><ScanLine className="w-4 h-4"/> Abrir Câmera</p>
            </button>
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32 flex flex-col">
      <header className="flex justify-between items-center bg-white p-4 border-b border-zinc-200 shadow-sm z-10 rounded-b-2xl">
        <div>
          <h1 className="text-lg font-black tracking-tight text-zinc-900 flex items-center gap-2"><ScanLine className="w-4 h-4 text-indigo-600"/> Portaria</h1>
          <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest mt-0.5">{eventoSelecionado.nome}</p>
        </div>
        <button onClick={() => { setEventoSelecionado(null); setIngressosBusca([]); }} className="bg-zinc-100 text-zinc-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-zinc-200 transition">Sair</button>
      </header>

      {/* ======== INÍCIO DA INJEÇÃO DOS BOTÕES DE ABAS ======== */}
      <div className="flex gap-2 px-6 mt-4 max-w-md mx-auto w-full">
        <button onClick={() => { setAbaAtiva('scanner'); resetarScanner(); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'scanner' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'}`}><ScanLine className="w-4 h-4"/> Leitor QR</button>
        <button onClick={() => setAbaAtiva('busca')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'busca' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'}`}><Search className="w-4 h-4"/> Lista Manual</button>
      </div>
      {/* ======== FIM DA INJEÇÃO DOS BOTÕES ======== */}

      <main className="flex-1 flex flex-col items-center justify-start p-6 max-w-md mx-auto w-full animate-fade-in">
        
        {abaAtiva === 'scanner' && statusLeitura === 'aguardando' && (
          <div className="w-full max-w-sm mt-4 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative bg-black aspect-square flex items-center justify-center">
            <Scanner 
              onScan={(result) => validarQRCode(result[0].rawValue)} 
              formats={['qr_code']}
              components={{ audio: false, finder: false }}
              styles={{ video: { objectFit: 'cover' } }}
            />
            {/* Máscara de foco escurecida por cima da câmera */}
            <div className="absolute inset-0 border-[40px] border-zinc-900/60 pointer-events-none flex items-center justify-center">
              <div className="w-full h-full border-2 border-indigo-500/50 rounded-xl"></div>
            </div>
            <p className="absolute bottom-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-xs font-black text-zinc-900 z-10 shadow-sm">Aponte para o QR Code</p>
          </div>
        )}

        {abaAtiva === 'scanner' && statusLeitura === 'processando' && (
          <div className="text-center animate-pulse mt-20">
            <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-black text-zinc-400 uppercase tracking-widest">Validando Servidor...</p>
          </div>
        )}

        {abaAtiva === 'scanner' && statusLeitura === 'sucesso' && (
          <div className="text-center w-full max-w-sm mt-10 animate-slide-up">
            <div className="w-32 h-32 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <h2 className="text-3xl font-black text-emerald-600 mb-2 tracking-tight">Liberado!</h2>
            <p className="text-zinc-700 font-bold bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">{resultado}</p>
            <button onClick={resetarScanner} className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-2 transition active:scale-95 shadow-md">
              <RefreshCw className="w-5 h-5"/> Ler Próximo
            </button>
          </div>
        )}

        {abaAtiva === 'scanner' && statusLeitura === 'erro' && (
          <div className="text-center w-full max-w-sm mt-10 animate-slide-up">
            <div className="w-32 h-32 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 shadow-[0_10px_30px_rgba(239,68,68,0.15)]">
              <XCircle className="w-16 h-16 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-red-500 mb-2 tracking-tight">Barrado!</h2>
            <p className="text-zinc-700 font-bold bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">{resultado}</p>
            <button onClick={resetarScanner} className="w-full mt-8 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black py-5 rounded-2xl uppercase tracking-widest flex items-center justify-center gap-2 transition active:scale-95">
              <RefreshCw className="w-5 h-5"/> Tentar Novamente
            </button>
          </div>
        )}

        {/* ======== INÍCIO DA INJEÇÃO DA TELA DE BUSCA DA HOSTESS ======== */}
        {abaAtiva === 'busca' && (
          <div className="w-full bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm mt-4 animate-fade-in">
            <h2 className="text-xl font-black mb-1">Lista Hostess</h2>
            <p className="text-sm text-zinc-500 font-medium mb-6">Busque clientes que estão sem celular ou bateria.</p>
            
            <form onSubmit={buscarIngressoManual} className="flex gap-2 mb-6">
              <input type="text" required placeholder="Nome do cliente..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl px-4 py-3 font-bold text-zinc-900 transition" />
              <button type="submit" disabled={isBuscando} className="bg-indigo-600 text-white px-5 rounded-xl font-black flex items-center justify-center transition disabled:opacity-50"><Search className="w-5 h-5"/></button>
            </form>

            <div className="space-y-3">
              {ingressosBusca.map(ing => (
                <div key={ing.id} className="flex justify-between items-center bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
                  <div>
                    <p className="font-black text-sm text-zinc-900 truncate max-w-[150px]">{ing.donoNome}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{ing.tipo}</p>
                  </div>
                  {ing.status === 'usado' ? (
                    <span className="flex items-center gap-1 text-xs font-black text-zinc-400 bg-zinc-200/50 px-3 py-1.5 rounded-lg"><CheckCircle2 className="w-4 h-4"/> Entrou</span>
                  ) : (
                    <button onClick={() => darBaixaManual(ing.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition active:scale-95">Liberar</button>
                  )}
                </div>
              ))}
              {ingressosBusca.length === 0 && !isBuscando && termoBusca && (
                 <p className="text-center text-xs text-zinc-500 font-bold py-4">Nenhum resultado para "{termoBusca}".</p>
              )}
            </div>
          </div>
        )}
        {/* ======== FIM DA INJEÇÃO DA TELA ======== */}

      </main>
      <BottomNav />
    </div>
  );
}