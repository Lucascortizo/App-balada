import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, ScanLine } from 'lucide-react';

export default function Catraca() {
  const [status, setStatus] = useState('aguardando'); 
  const [mensagem, setMensagem] = useState('');
  const [modo, setModo] = useState('entrada'); // 'entrada' ou 'saida'

  const location = useLocation();
  const navigate = useNavigate();
  const eventoId = location.state?.eventoId;

  if (!eventoId) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 mb-2 tracking-tight">Acesso Negado</h2>
        <p className="text-zinc-500 font-medium mb-8 max-w-xs mx-auto">
          Inicie a catraca através do painel de Administração para vincular a um evento ativo.
        </p>
        <button 
          onClick={() => navigate('/admin')} 
          className="bg-zinc-900 text-white px-8 py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-transform"
        >
          Voltar ao Admin
        </button>
      </div>
    );
  }

  const resetar = (delay = 3000) => {
    setTimeout(() => {
      setStatus('aguardando');
      setMensagem('');
    }, delay);
  };

  const aoLerCodigo = async (codigos) => {
    if (status !== 'aguardando') return;
    
    const qrBruto = codigos[0]?.rawValue;
    if (!qrBruto || !qrBruto.includes('|')) {
      setMensagem('QR Code Inválido.');
      setStatus('erro');
      return resetar();
    }

    setStatus('validando');
    const [tipoItem, idDocumento, idClienteSaida] = qrBruto.split('|');

    try {
      if (modo === 'saida') {
        if (tipoItem !== 'saida') {
          setMensagem('Use o Passe Verde de Saída.');
          setStatus('erro'); return resetar();
        }

        if (idDocumento !== eventoId) {
          setMensagem('Passe de outra festa!');
          setStatus('erro'); return resetar();
        }

        const qSaidaRegistrada = await getDocs(query(collection(db, "saidas_realizadas"), where("clienteId", "==", idClienteSaida), where("eventoId", "==", eventoId)));
        if (!qSaidaRegistrada.empty) {
          setMensagem('PASSE JÁ UTILIZADO!');
          setStatus('erro'); return resetar(4000);
        }

        const qPedidos = await getDocs(query(collection(db, "pedidos"), where("clienteId", "==", idClienteSaida), where("eventoId", "==", eventoId)));
        const qEspacos = await getDocs(query(collection(db, "espacos"), where("donoId", "==", idClienteSaida), where("eventoId", "==", eventoId)));
        const qPagamentos = await getDocs(query(collection(db, "pagamentos_comanda"), where("clienteId", "==", idClienteSaida), where("eventoId", "==", eventoId)));

        const totalBar = qPedidos.docs.reduce((acc, doc) => acc + (Number(doc.data().total) || 0), 0);
        const totalVIP = qEspacos.docs.reduce((acc, doc) => acc + (Number(doc.data().consumacao) || 0), 0);
        const aPagar = Math.max(0, totalBar - totalVIP);

        if (aPagar > 0 && qPagamentos.empty) {
          setMensagem(`CALOTE! Devendo: R$ ${aPagar.toFixed(2)}`);
          setStatus('erro'); return resetar(5000);
        }

        await addDoc(collection(db, "saidas_realizadas"), {
          clienteId: idClienteSaida, eventoId: eventoId, dataSaida: new Date().toISOString()
        });

        setMensagem('SAÍDA LIBERADA');
        setStatus('sucesso'); return resetar();
      }

      if (modo === 'entrada') {
        if (tipoItem === 'saida') {
          setMensagem('Passe de saída negado. Use ingresso.');
          setStatus('erro'); return resetar();
        }

        if (tipoItem === 'ingresso') {
          const ingressoRef = doc(db, 'ingressos_vendidos', idDocumento);
          const snap = await getDoc(ingressoRef);
          
          if (!snap.exists()) throw new Error("Não encontrado");
          
          const dados = snap.data();
          if (dados.eventoId !== eventoId) { setMensagem('Ingresso de OUTRA festa!'); setStatus('erro'); return resetar(); }
          if (dados.status === 'usado') { setMensagem('INGRESSO JÁ UTILIZADO!'); setStatus('erro'); return resetar(); }

          await updateDoc(ingressoRef, { status: 'usado', checkinEm: new Date().toISOString() });
          setMensagem('ACESSO LIBERADO');
          setStatus('sucesso'); return resetar();
        }

        if (tipoItem === 'espaco') {
          const espacoRef = doc(db, 'espacos', idDocumento);
          const snap = await getDoc(espacoRef);
          
          if (!snap.exists()) throw new Error("Não encontrado");
          
          const dados = snap.data();
          if (dados.eventoId !== eventoId) { setMensagem('Reserva de OUTRA festa!'); setStatus('erro'); return resetar(); }
          if (dados.checkinFeito) { setMensagem(`${dados.tipo} JÁ ENTROU!`); setStatus('erro'); return resetar(); }

          await updateDoc(espacoRef, { checkinFeito: true, checkinEm: new Date().toISOString() });
          setMensagem(`VIP LIBERADO`);
          setStatus('sucesso'); return resetar();
        }
      }
    } catch (error) {
      setMensagem('Ingresso não localizado.');
      setStatus('erro'); resetar();
    }
  };

  const statusColors = {
    aguardando: 'bg-[#FAFAFA]',
    validando: 'bg-amber-500',
    sucesso: 'bg-emerald-500',
    erro: 'bg-rose-500'
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-0 sm:p-6 font-sans transition-colors duration-500 ${statusColors[status]}`}>
      
      <div className="w-full h-screen sm:h-auto max-w-md bg-white sm:rounded-[2.5rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-zinc-100 flex flex-col">
        
        <header className="p-6 bg-white flex flex-col gap-6 z-10 shadow-sm relative">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => navigate('/admin')} 
              className="text-zinc-500 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest bg-zinc-100 px-4 py-2.5 rounded-full hover:bg-zinc-200 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-3 h-3" /> Admin
            </button>
            <h1 className="text-xl font-black text-zinc-900 tracking-tight">Catraca</h1>
          </div>
          
          <div className="flex bg-zinc-100 p-1.5 rounded-2xl w-full">
            <button 
              onClick={() => { setModo('entrada'); setStatus('aguardando'); }} 
              className={`flex-1 py-4 text-xs font-black tracking-widest uppercase rounded-xl transition-all ${modo === 'entrada' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Entrada
            </button>
            <button 
              onClick={() => { setModo('saida'); setStatus('aguardando'); }} 
              className={`flex-1 py-4 text-xs font-black tracking-widest uppercase rounded-xl transition-all ${modo === 'saida' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              Saída
            </button>
          </div>
        </header>

        <div className="relative bg-zinc-900 aspect-square w-full">
          {status === 'aguardando' ? (
            <Scanner
              onScan={aoLerCodigo}
              formats={['qr_code']}
              components={{ audio: false, finder: false }}
              styles={{ container: { width: '100%', height: '100%' } }}
            />
          ) : (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 text-white ${status === 'validando' ? 'bg-amber-500' : status === 'sucesso' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
              {status === 'validando' ? <ScanLine className="w-24 h-24 animate-pulse drop-shadow-md" /> : 
               status === 'sucesso' ? <CheckCircle2 className="w-24 h-24 drop-shadow-md" /> : 
               <XCircle className="w-24 h-24 drop-shadow-md" />}
            </div>
          )}
          
          {status === 'aguardando' && (
            <div className="absolute inset-0 border-[40px] border-black/40 flex items-center justify-center pointer-events-none">
              <div className={`w-full h-full border-[4px] rounded-3xl ${modo === 'entrada' ? 'border-indigo-500/80' : 'border-green-500/80'}`}></div>
            </div>
          )}
        </div>

        <div className="flex-1 p-8 text-center flex flex-col items-center justify-center bg-white min-h-[160px]">
          <p className="text-[10px] uppercase tracking-widest mb-3 font-black text-zinc-400">
            {modo === 'entrada' ? 'Validador de Acesso' : 'Verificador de Comanda'}
          </p>
          
          {status === 'aguardando' ? (
            <p className="text-zinc-900 font-bold text-base flex flex-col items-center gap-2">
              <ScanLine className="w-6 h-6 text-zinc-300" />
              Posicione o QR Code<br/>no centro da tela
            </p>
          ) : (
            <p className={`text-4xl font-black tracking-tight leading-none ${status === 'sucesso' ? 'text-emerald-600' : status === 'validando' ? 'text-amber-600' : 'text-rose-600'}`}>
              {mensagem}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}