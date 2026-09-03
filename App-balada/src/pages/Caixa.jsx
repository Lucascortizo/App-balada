import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';
import { Scanner } from '@yudiel/react-qr-scanner';
import BottomNav from '../components/BottomNav';
import { Wallet, Search, ScanLine, CreditCard, Banknote, CheckCircle2 } from 'lucide-react';

export default function Caixa() {
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('busca'); 
  
  const [termoBusca, setTermoBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [dadosFinanceiros, setDadosFinanceiros] = useState(null);
  const [isProcessando, setIsProcessando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "eventos"), snap => setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const buscarCliente = async (e) => {
    e.preventDefault();
    if (!termoBusca) return;
    const tId = toast.loading('Buscando cliente...');
    try {
      const q = query(collection(db, "usuarios"), where("email", "==", termoBusca.toLowerCase().trim()));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        toast.error("Cliente não encontrado.", { id: tId });
      } else {
        const cliente = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setClienteSelecionado(cliente);
        await calcularDivida(cliente.id);
        toast.success("Cliente localizado!", { id: tId });
      }
    } catch (error) { 
      toast.error("Erro na busca.", { id: tId }); 
      console.error(error);
    }
  };

  const calcularDivida = async (clienteId) => {
    try {
      const evId = eventoSelecionado.id;
      
      // ======== INÍCIO DA LÓGICA OTMIZADA DE ESCALABILIDADE ========
      // Agora o Firebase faz o trabalho pesado e traz SÓ o que é do cliente
      // (Isso exige os Índices Compostos no Firestore que combinem eventoId + donoId/clienteId)
      
      const espacosSnap = await getDocs(query(collection(db, "espacos"), where("eventoId", "==", evId), where("donoId", "==", clienteId)));
      const pedidosSnap = await getDocs(query(collection(db, "pedidos"), where("eventoId", "==", evId), where("clienteId", "==", clienteId)));
      const pagamentosSnap = await getDocs(query(collection(db, "pagamentos_comanda"), where("eventoId", "==", evId), where("clienteId", "==", clienteId)));
      
      // As splits continuam buscando "deId" e "paraId"
      const descSplitsSnap = await getDocs(query(collection(db, "cobrancas_split"), where("eventoId", "==", evId), where("deId", "==", clienteId), where("status", "==", "aceito")));
      const adcSplitsSnap = await getDocs(query(collection(db, "cobrancas_split"), where("eventoId", "==", evId), where("paraId", "==", clienteId), where("status", "==", "aceito")));

      // O cálculo no celular agora é ultra leve, pois os arrays têm no máximo 10 ou 20 itens, não milhares.
      const tVIP = espacosSnap.docs.reduce((a, d) => a + (d.data().consumacao || 0), 0);
      const tBar = pedidosSnap.docs.reduce((a, d) => a + (d.data().total || 0), 0);
      const tPago = pagamentosSnap.docs.reduce((a, d) => a + (d.data().valorPago || 0), 0);
      const descSplits = descSplitsSnap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);
      const adcSplits = adcSplitsSnap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);

      // ======== FIM DA LÓGICA OTIMIZADA ========

      const saldoDevedor = Math.max(0, tBar + adcSplits - tVIP - tPago - descSplits);
      
      setDadosFinanceiros({ tBar, tVIP, tPago, adcSplits, descSplits, saldoDevedor });
    } catch (error) {
      console.error("Erro ao puxar dados da comanda:", error);
      toast.error("Erro ao carregar o extrato.");
    }
  };

  const processarScan = async (textoQrCode) => {
    const partes = textoQrCode.split('|');
    if (partes[0] === 'saida' && partes[1] === eventoSelecionado.id) {
      const clienteId = partes[2];
      const docSnap = await getDocs(query(collection(db, "usuarios"), where("__name__", "==", clienteId)));
      if (!docSnap.empty) {
        const cliente = { id: docSnap.docs[0].id, ...docSnap.docs[0].data() };
        setClienteSelecionado(cliente);
        await calcularDivida(cliente.id);
        toast.success("QR Code lido com sucesso!");
        setAbaAtiva('busca');
      }
    } else {
      toast.error('QR Code inválido para o caixa.');
    }
  };

  const registrarPagamentoManual = async (metodo) => {
    if (dadosFinanceiros.saldoDevedor <= 0) return toast.error("Comanda já está zerada!");
    setIsProcessando(true);
    const tId = toast.loading(`Registrando pagamento em ${metodo}...`);
    try {
      await addDoc(collection(db, "pagamentos_comanda"), { 
        eventoId: eventoSelecionado.id, 
        clienteId: clienteSelecionado.id, 
        valorPago: dadosFinanceiros.saldoDevedor, 
        dataPagamento: new Date().toISOString(),
        metodo: metodo,
        operadorCaixa: true
      });
      toast.success("Pagamento registrado! Comanda zerada.", { id: tId });
      await calcularDivida(clienteSelecionado.id);
    } catch (error) { 
      toast.error("Erro ao registrar pagamento.", { id: tId }); 
    }
    setIsProcessando(false);
  };

  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
        <header className="bg-white px-6 py-8 rounded-b-[2rem] shadow-sm border-b border-zinc-200">
          <h1 className="text-3xl font-black flex items-center gap-2 tracking-tight text-zinc-900"><Wallet className="text-indigo-600 w-8 h-8"/> Operação Caixa</h1>
          <p className="text-zinc-500 text-sm mt-1 font-bold">Cobrança Física e Fechamento</p>
        </header>
        <main className="max-w-md mx-auto p-6 mt-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-2">Selecione o Evento</h2>
          {eventosGlobais.map(e => (
            <button key={e.id} onClick={() => setEventoSelecionado(e)} className="w-full bg-white border border-zinc-200 p-6 rounded-3xl text-left hover:border-indigo-500 transition-all shadow-sm active:scale-95 mb-3">
              <h3 className="text-xl font-black text-zinc-900">{e.nome}</h3>
              <p className="text-indigo-600 text-xs mt-2 font-bold uppercase tracking-widest flex items-center gap-2"><Wallet className="w-4 h-4"/> Abrir PDV</p>
            </button>
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 shadow-sm px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="font-black text-zinc-900 flex items-center gap-1.5"><Wallet className="w-4 h-4 text-indigo-600"/> Caixa</h1>
          <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest">{eventoSelecionado.nome}</p>
        </div>
        <button onClick={() => { setEventoSelecionado(null); setClienteSelecionado(null); }} className="bg-zinc-100 text-zinc-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-zinc-200">Sair</button>
      </header>

      <div className="flex gap-2 px-6 mt-4 max-w-xl mx-auto w-full">
        <button onClick={() => setAbaAtiva('busca')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'busca' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'}`}><Search className="w-4 h-4"/> E-mail</button>
        <button onClick={() => setAbaAtiva('scanner')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${abaAtiva === 'scanner' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-zinc-500 border border-zinc-200'}`}><ScanLine className="w-4 h-4"/> Bipar Saída</button>
      </div>

      <main className="max-w-xl mx-auto w-full p-6 animate-fade-in flex-1">
        {abaAtiva === 'scanner' && (
          <div className="w-full rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative bg-black aspect-square flex items-center justify-center">
            <Scanner onScan={(r) => processarScan(r[0].rawValue)} formats={['qr_code']} components={{ audio: false, finder: false }} styles={{ video: { objectFit: 'cover' } }} />
            <div className="absolute inset-0 border-[40px] border-zinc-900/60 pointer-events-none flex items-center justify-center"><div className="w-full h-full border-2 border-indigo-500/50 rounded-xl"></div></div>
            <p className="absolute bottom-4 bg-white/90 px-4 py-2 rounded-full text-xs font-black text-zinc-900 z-10 shadow-sm">Bipar QR Code de Saída</p>
          </div>
        )}

        {abaAtiva === 'busca' && !clienteSelecionado && (
          <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm">
            <h2 className="text-xl font-black mb-2">Busca de Comanda</h2>
            <p className="text-sm text-zinc-500 font-medium mb-6">Peça o e-mail cadastrado no aplicativo do cliente.</p>
            <form onSubmit={buscarCliente} className="flex gap-2">
              <input type="email" required placeholder="E-mail do cliente" value={termoBusca} onChange={e => setTermoBusca(e.target.value)} className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl px-4 py-3 font-bold text-zinc-900" />
              <button type="submit" className="bg-indigo-600 text-white px-5 rounded-xl font-black flex items-center justify-center transition"><Search className="w-5 h-5"/></button>
            </form>
          </div>
        )}

        {abaAtiva === 'busca' && clienteSelecionado && dadosFinanceiros && (
          <div className="space-y-4">
            <div className="bg-zinc-900 text-white p-6 rounded-[2rem] shadow-lg flex justify-between items-center">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">Cliente Localizado</p>
                <h3 className="font-black text-xl leading-none">{clienteSelecionado.nome}</h3>
                <p className="text-indigo-400 font-bold text-xs mt-1">{clienteSelecionado.email}</p>
              </div>
              <button onClick={() => { setClienteSelecionado(null); setDadosFinanceiros(null); setTermoBusca(''); }} className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-white/20 transition-colors">Limpar</button>
            </div>

            <div className="bg-white border border-zinc-200 p-6 rounded-[2rem] shadow-sm">
              <h4 className="font-black text-zinc-400 uppercase tracking-widest text-[10px] mb-4">Extrato da Comanda</h4>
              <div className="space-y-3 mb-6 border-b border-zinc-100 pb-6">
                <div className="flex justify-between font-bold text-sm"><span className="text-zinc-500">Bebidas (Bar)</span><span>R$ {dadosFinanceiros.tBar.toFixed(2)}</span></div>
                {dadosFinanceiros.adcSplits > 0 && <div className="flex justify-between font-bold text-sm"><span className="text-orange-500">Rachas Assumidos</span><span className="text-orange-600">+ R$ {dadosFinanceiros.adcSplits.toFixed(2)}</span></div>}
                {dadosFinanceiros.descSplits > 0 && <div className="flex justify-between font-bold text-sm"><span className="text-emerald-500">Rachas Enviados</span><span className="text-emerald-600">- R$ {dadosFinanceiros.descSplits.toFixed(2)}</span></div>}
                {dadosFinanceiros.tVIP > 0 && <div className="flex justify-between font-bold text-sm"><span className="text-emerald-500">Consumação VIP</span><span className="text-emerald-600">- R$ {dadosFinanceiros.tVIP.toFixed(2)}</span></div>}
                {dadosFinanceiros.tPago > 0 && <div className="flex justify-between font-bold text-sm"><span className="text-indigo-500">Pagamentos Anteriores</span><span className="text-indigo-600">- R$ {dadosFinanceiros.tPago.toFixed(2)}</span></div>}
              </div>
              
              <div className="flex justify-between items-center mb-6">
                <span className="font-black text-zinc-900 uppercase tracking-widest text-xs">Saldo Devedor</span>
                <span className={`font-black text-4xl ${dadosFinanceiros.saldoDevedor > 0 ? 'text-red-500' : 'text-emerald-500'}`}>R$ {dadosFinanceiros.saldoDevedor.toFixed(2)}</span>
              </div>

              {dadosFinanceiros.saldoDevedor > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => registrarPagamentoManual('Cartão Físico')} disabled={isProcessando} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-transform"><CreditCard className="w-5 h-5"/> Maquininha</button>
                  <button onClick={() => registrarPagamentoManual('Dinheiro Físico')} disabled={isProcessando} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-transform"><Banknote className="w-5 h-5"/> Dinheiro</button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-xl text-center font-black flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5"/> Comanda Zerada. Cliente liberado!
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}