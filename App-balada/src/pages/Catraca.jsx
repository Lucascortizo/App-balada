import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import BottomNav from '../components/BottomNav';
import { eventosOperacionaisDeHoje } from '../utils/eventosOperacionais';
import { ScanLine, CheckCircle2, XCircle, ShieldCheck, RefreshCw, Search, LogIn, LogOut, UserRound } from 'lucide-react';

const TEMPO_EXPIRACAO_PASSE_MS = 30 * 60 * 1000;

export default function Catraca() {
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [modo, setModo] = useState('entrada');
  const [aba, setAba] = useState('scanner');
  const [termoBusca, setTermoBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  const [statusLeitura, setStatusLeitura] = useState('aguardando');
  const [resultado, setResultado] = useState(null);
  const [isBuscando, setIsBuscando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'eventos'), (snap) => {
      setEventosGlobais(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const lancarResultado = (status, mensagem) => {
    setResultado(mensagem);
    setStatusLeitura(status);
  };

  const resetarScanner = () => {
    setStatusLeitura('aguardando');
    setResultado(null);
  };

  const garantirComanda = async (evento, clienteId, clienteNome) => {
    const snap = await getDocs(query(
      collection(db, 'comandas_ativas'),
      where('eventoId', '==', evento.id),
      where('clienteId', '==', clienteId)
    ));

    const ativa = snap.docs.find((d) => ['aberta', 'paga'].includes(d.data().status));
    if (ativa) return ativa.id;

    const ref = doc(collection(db, 'comandas_ativas'));
    await runTransaction(db, async (transaction) => {
      transaction.set(ref, {
        eventoId: evento.id,
        eventoNome: evento.nome,
        clienteId,
        clienteNome,
        tipoComanda: 'digital',
        origemComanda: 'entrada',
        status: 'aberta',
        abertaEm: new Date().toISOString(),
      });
    });
    return ref.id;
  };

  const validarEntrada = async (partes) => {
    const tipo = partes[0];
    const idItem = partes[1];
    const idUsuario = partes[2];

    if (tipo === 'ingresso') {
      const ingressoRef = doc(db, 'ingressos_vendidos', idItem);
      const ingressoSnap = await getDoc(ingressoRef);
      if (!ingressoSnap.exists()) return lancarResultado('erro', 'Ingresso não encontrado.');
      const ingresso = ingressoSnap.data();

      if (ingresso.eventoId !== eventoSelecionado.id) return lancarResultado('erro', 'Ingresso pertence a outro evento.');
      if (['cancelado', 'estornado', 'usado', 'saiu', 'encerrado'].includes(ingresso.status)) {
        return lancarResultado('erro', 'Ingresso inválido ou já utilizado.');
      }

      const comandaId = await garantirComanda(eventoSelecionado, ingresso.donoId, ingresso.donoNome);
      await runTransaction(db, async (transaction) => {
        const atual = await transaction.get(ingressoRef);
        if (!atual.exists()) throw new Error('Ingresso não encontrado.');
        if (['cancelado', 'estornado', 'usado', 'saiu', 'encerrado'].includes(atual.data().status)) {
          throw new Error('Ingresso já utilizado.');
        }
        transaction.update(ingressoRef, {
          status: 'usado',
          dataUso: new Date().toISOString(),
          comandaId,
        });
      });

      return lancarResultado('sucesso', `Entrada liberada para ${ingresso.donoNome}. Comanda digital ativada.`);
    }

    if (tipo === 'espaco') {
      const espacoRef = doc(db, 'espacos', idItem);
      const espacoSnap = await getDoc(espacoRef);
      if (!espacoSnap.exists()) return lancarResultado('erro', 'Camarote não encontrado.');
      const espaco = espacoSnap.data();
      if (espaco.eventoId !== eventoSelecionado.id) return lancarResultado('erro', 'Camarote pertence a outro evento.');
      if (espaco.checkinFeito) return lancarResultado('erro', `O titular ${espaco.donoNome} já está na casa.`);

      await garantirComanda(eventoSelecionado, espaco.donoId, espaco.donoNome);
      await runTransaction(db, async (transaction) => {
        const atual = await transaction.get(espacoRef);
        if (!atual.exists() || atual.data().checkinFeito) throw new Error('Camarote já utilizado.');
        transaction.update(espacoRef, { checkinFeito: true, checkinEm: new Date().toISOString() });
      });

      return lancarResultado('sucesso', `Entrada VIP liberada: ${espaco.sigla} — ${espaco.donoNome}.`);
    }

    if (tipo === 'convidado') {
      const espacoSnap = await getDoc(doc(db, 'espacos', idItem));
      if (!espacoSnap.exists()) return lancarResultado('erro', 'Camarote não encontrado.');
      const espaco = espacoSnap.data();
      if (espaco.eventoId !== eventoSelecionado.id) {
        return lancarResultado('erro', 'Este convite VIP pertence a outro evento.');
      }

      if (!espaco.checkinFeito) {
        return lancarResultado('erro', 'O titular do camarote ainda não entrou na casa.');
      }

      const convidados = Array.isArray(espaco.convidados) ? espaco.convidados : [];
      const indiceConvidado = convidados.findIndex((item) => item.uid === idUsuario);
      if (indiceConvidado === -1) {
        return lancarResultado('erro', 'Convidado não autorizado neste camarote.');
      }

      const convidado = convidados[indiceConvidado];
      if (convidado.saiu === true) {
        return lancarResultado('erro', 'Este convidado já encerrou a entrada nesta festa.');
      }
      if (convidado.entrou === true) {
        return lancarResultado('erro', 'Este convidado já está dentro da festa.');
      }

      const agora = new Date().toISOString();
      const convidadosAtualizados = convidados.map((item, index) =>
        index === indiceConvidado
          ? { ...item, entrou: true, saiu: false, entradaEm: agora, saidaEm: null }
          : item
      );

      await garantirComanda(
        eventoSelecionado,
        idUsuario,
        convidado.nome || 'Convidado VIP'
      );

      await runTransaction(db, async (transaction) => {
        const atual = await transaction.get(doc(db, 'espacos', idItem));
        if (!atual.exists()) throw new Error('Camarote não encontrado.');
        if (atual.data().eventoId !== eventoSelecionado.id) throw new Error('Camarote pertence a outro evento.');

        const convidadosAtuais = Array.isArray(atual.data().convidados)
          ? atual.data().convidados
          : [];
        const jaEntrou = convidadosAtuais.find((item) => item.uid === idUsuario)?.entrou === true;
        if (jaEntrou) throw new Error('Este convidado já registrou entrada.');

        transaction.update(doc(db, 'espacos', idItem), {
          convidados: convidadosAtualizados,
          convidadosIds: convidadosAtualizados.map((item) => item.uid),
        });
      });

      return lancarResultado('sucesso', `Convidado VIP liberado: ${convidado.nome}. Comanda digital ativada.`);
    }

    return lancarResultado('erro', 'QR de entrada inválido.');
  };

  const validarSaida = async (partes) => {
    const token = partes[1];
    if (!token) return lancarResultado('erro', 'Passe de saída inválido.');

    const passeRef = doc(db, 'passes_saida', token);
    const passeSnap = await getDoc(passeRef);
    if (!passeSnap.exists()) return lancarResultado('erro', 'Passe de saída não encontrado.');

    const passe = passeSnap.data();
    if (passe.eventoId !== eventoSelecionado.id) return lancarResultado('erro', 'Passe pertence a outro evento.');
    if (passe.status !== 'disponivel') return lancarResultado('erro', 'Passe de saída já utilizado ou cancelado.');

    const criadoEm = new Date(passe.criadoEm || 0).getTime();
    if (!criadoEm || Date.now() - criadoEm > TEMPO_EXPIRACAO_PASSE_MS) {
      await runTransaction(db, async (transaction) => {
        transaction.update(passeRef, { status: 'expirado', expiradoEm: new Date().toISOString() });
      });
      return lancarResultado('erro', 'Passe de saída expirado. Gere um novo passe no aplicativo.');
    }

    const comandaRef = doc(db, 'comandas_ativas', passe.comandaId);
    const comandaSnap = await getDoc(comandaRef);
    if (!comandaSnap.exists()) return lancarResultado('erro', 'Comanda não encontrada.');
    const comanda = comandaSnap.data();
    if (comanda.status !== 'paga') return lancarResultado('erro', 'Pagamento ainda não está confirmado.');

    const agora = new Date().toISOString();

    const passeAtualData = passe;

    if (passeAtualData.tipoAcesso === 'convidado') {
      if (!passeAtualData.espacoId || !passeAtualData.convidadoId) {
        return lancarResultado('erro', 'Passe de saída de convidado inválido.');
      }

      const espacoRef = doc(db, 'espacos', passeAtualData.espacoId);
      const espacoSnap = await getDoc(espacoRef);
      if (!espacoSnap.exists()) return lancarResultado('erro', 'Camarote do convidado não encontrado.');

      const espaco = espacoSnap.data();
      if (espaco.eventoId !== eventoSelecionado.id) {
        return lancarResultado('erro', 'Camarote pertence a outro evento.');
      }

      const convidadoAtual = (espaco.convidados || []).find((item) => item.uid === passeAtualData.convidadoId);
      if (!convidadoAtual) return lancarResultado('erro', 'Convidado não está mais na lista deste camarote.');
      if (convidadoAtual.entrou !== true || convidadoAtual.saiu === true) {
        return lancarResultado('erro', 'Este convidado não está com entrada ativa.');
      }

      await runTransaction(db, async (transaction) => {
        const passeAtual = await transaction.get(passeRef);
        const comandaAtual = await transaction.get(comandaRef);
        const espacoAtual = await transaction.get(espacoRef);
        if (!passeAtual.exists() || passeAtual.data().status !== 'disponivel') throw new Error('Passe já utilizado.');
        if (!comandaAtual.exists() || comandaAtual.data().status !== 'paga') throw new Error('Comanda não está paga.');
        if (!espacoAtual.exists()) throw new Error('Camarote não encontrado.');

        const convidados = Array.isArray(espacoAtual.data().convidados) ? espacoAtual.data().convidados : [];
        const indice = convidados.findIndex((item) => item.uid === passeAtual.data().convidadoId);
        if (indice === -1) throw new Error('Convidado não está mais na lista.');
        if (convidados[indice].entrou !== true || convidados[indice].saiu === true) {
          throw new Error('Este convidado não está com entrada ativa.');
        }

        const convidadosAtualizados = convidados.map((item, index) =>
          index === indice
            ? { ...item, entrou: false, saiu: true, saidaEm: agora }
            : item
        );

        transaction.update(passeRef, {
          status: 'utilizado',
          utilizadoEm: agora,
          utilizadoPor: 'seguranca',
        });

        transaction.update(comandaRef, {
          status: 'encerrada',
          encerradaEm: agora,
          motivoEncerramento: 'saida_validada',
        });

        transaction.update(espacoRef, {
          convidados: convidadosAtualizados,
          convidadosIds: convidadosAtualizados.map((item) => item.uid),
        });
      });

      return lancarResultado('sucesso', `Saída liberada para ${passe.clienteNome}.`);
    }

    await runTransaction(db, async (transaction) => {
      const passeAtual = await transaction.get(passeRef);
      const comandaAtual = await transaction.get(comandaRef);
      if (!passeAtual.exists() || passeAtual.data().status !== 'disponivel') throw new Error('Passe já utilizado.');
      if (!comandaAtual.exists() || comandaAtual.data().status !== 'paga') throw new Error('Comanda não está paga.');

      transaction.update(passeRef, {
        status: 'utilizado',
        utilizadoEm: agora,
        utilizadoPor: 'seguranca',
      });

      transaction.update(comandaRef, {
        status: 'encerrada',
        encerradaEm: agora,
        motivoEncerramento: 'saida_validada',
      });
    });

    const ingressosSnap = await getDocs(query(
      collection(db, 'ingressos_vendidos'),
      where('eventoId', '==', eventoSelecionado.id),
      where('donoId', '==', passe.clienteId)
    ));

    const espacosSnap = await getDocs(query(
      collection(db, 'espacos'),
      where('eventoId', '==', eventoSelecionado.id),
      where('donoId', '==', passe.clienteId)
    ));

    await Promise.all(ingressosSnap.docs.map((item) =>
      runTransaction(db, async (transaction) => {
        const ref = doc(db, 'ingressos_vendidos', item.id);
        const snap = await transaction.get(ref);
        if (snap.exists() && !['cancelado', 'estornado', 'saiu'].includes(snap.data().status)) {
          transaction.update(ref, { status: 'saiu', dataSaida: agora });
        }
      })
    ));

    await Promise.all(espacosSnap.docs.map((item) =>
      runTransaction(db, async (transaction) => {
        const ref = doc(db, 'espacos', item.id);
        const snap = await transaction.get(ref);
        if (snap.exists()) {
          transaction.update(ref, {
            checkinFeito: false,
            status: 'disponivel',
            donoId: null,
            donoNome: null,
            dataLiberacao: agora,
          });
        }
      })
    ));

    return lancarResultado('sucesso', `Saída liberada para ${passe.clienteNome}. Pagamento confirmado.`);
  };

  const validarQRCode = async (texto) => {
    if (statusLeitura !== 'aguardando') return;
    setStatusLeitura('processando');

    try {
      const partes = String(texto || '').split('|');
      if (modo === 'saida') {
        if (partes[0] !== 'saida') return lancarResultado('erro', 'Este QR não é um passe de saída.');
        await validarSaida(partes);
      } else {
        await validarEntrada(partes);
      }
    } catch (error) {
      console.error(error);
      lancarResultado('erro', error.message || 'Não foi possível validar o QR.');
    }
  };

  const buscarManualmente = async (e) => {
    e.preventDefault();
    if (!termoBusca.trim()) return;
    setIsBuscando(true);
    try {
      const ingressoSnap = await getDocs(query(collection(db, 'ingressos_vendidos'), where('eventoId', '==', eventoSelecionado.id)));
      const termo = termoBusca.trim().toLowerCase();
      const encontrados = ingressoSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) =>
          (item.donoNome || '').toLowerCase().includes(termo) ||
          String(item.donoCpf || item.cpf || '').replace(/\D/g, '').includes(termo.replace(/\D/g, '')) ||
          item.codigoIngresso === termoBusca.trim()
        );
      setResultados(encontrados);
      if (encontrados.length === 0) toast.error('Nenhum ingresso encontrado.');
    } catch (error) {
      console.error(error);
      toast.error('Erro na busca.');
    } finally {
      setIsBuscando(false);
    }
  };

  const liberarEntradaManualmente = async (item) => {
    if (modo !== 'entrada') return;
    if (!window.confirm(`Confirmar entrada manual de ${item.donoNome}?`)) return;
    try {
      const comandaId = await garantirComanda(eventoSelecionado, item.donoId, item.donoNome);
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, 'ingressos_vendidos', item.id);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error('Ingresso não encontrado.');
        if (['cancelado', 'estornado', 'usado', 'saiu', 'encerrado'].includes(snap.data().status)) throw new Error('Ingresso não está disponível.');
        transaction.update(ref, { status: 'usado', dataUso: new Date().toISOString(), comandaId });
      });
      toast.success('Entrada liberada manualmente.');
      setResultados((prev) => prev.map((r) => r.id === item.id ? { ...r, status: 'usado' } : r));
    } catch (error) {
      toast.error(error.message || 'Não foi possível liberar.');
    }
  };

  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
        <header className="bg-white p-8 border-b border-zinc-200 shadow-sm rounded-b-[2rem]">
          <h1 className="text-3xl font-black flex items-center gap-2"><ShieldCheck className="text-indigo-600" /> Segurança</h1>
          <p className="text-zinc-500 text-sm mt-1 font-bold">Controle de entrada e saída</p>
        </header>
        <main className="max-w-md mx-auto p-6 space-y-4 mt-4">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Eventos de hoje</h2>
          {eventosOperacionaisDeHoje(eventosGlobais).map((evento) => (
            <button key={evento.id} onClick={() => setEventoSelecionado(evento)} className="w-full bg-white border border-zinc-200 p-6 rounded-3xl text-left hover:border-indigo-500 transition shadow-sm">
              <h3 className="text-xl font-black">{evento.nome}</h3>
              <p className="text-indigo-600 text-xs mt-2 font-bold uppercase">Abrir portaria</p>
            </button>
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="bg-white p-5 border-b border-zinc-200 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center gap-4 max-w-xl mx-auto">
          <div>
            <h1 className="text-xl font-black flex items-center gap-2"><ScanLine className="text-indigo-600" /> Portaria</h1>
            <p className="text-indigo-600 font-bold text-[10px] uppercase tracking-widest">{eventoSelecionado.nome}</p>
          </div>
          <button onClick={() => setEventoSelecionado(null)} className="bg-zinc-100 px-4 py-2 rounded-xl text-xs font-black">Trocar evento</button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-5 space-y-5">
        <div className="grid grid-cols-2 gap-2 bg-zinc-100 p-1.5 rounded-2xl">
          <button onClick={() => { setModo('entrada'); setAba('scanner'); resetarScanner(); }} className={`py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 ${modo === 'entrada' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'}`}><LogIn size={16}/> Entrada</button>
          <button onClick={() => { setModo('saida'); setAba('scanner'); resetarScanner(); }} className={`py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 ${modo === 'saida' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'}`}><LogOut size={16}/> Saída</button>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-sm font-black text-indigo-900">{modo === 'entrada' ? 'Entrada' : 'Saída'}</p>
          <p className="text-xs text-indigo-700 mt-1">{modo === 'entrada' ? 'Leia o QR do ingresso. O cliente passa e a comanda digital é ativada.' : 'Leia o Passe de Saída gerado após o pagamento. O passe é de uso único.'}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => { setAba('scanner'); resetarScanner(); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 ${aba === 'scanner' ? 'bg-indigo-600 text-white' : 'bg-white border text-zinc-500'}`}><ScanLine size={16}/> Leitor QR</button>
          <button onClick={() => { setAba('manual'); resetarScanner(); }} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 ${aba === 'manual' ? 'bg-indigo-600 text-white' : 'bg-white border text-zinc-500'}`}><Search size={16}/> Contingência</button>
        </div>

        {aba === 'scanner' && statusLeitura === 'aguardando' && (
          <div className="rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl bg-black aspect-square max-w-md mx-auto relative">
            <Scanner onScan={(result) => validarQRCode(result?.[0]?.rawValue)} formats={['qr_code']} components={{ audio: false, finder: false }} styles={{ video: { objectFit: 'cover' } }} />
            <div className="absolute inset-0 border-[30px] border-black/50 pointer-events-none"><div className="w-full h-full border-2 border-indigo-400 rounded-2xl" /></div>
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full text-xs font-black whitespace-nowrap">Aponte para o QR</p>
          </div>
        )}

        {aba === 'scanner' && statusLeitura === 'processando' && (
          <div className="bg-white rounded-[2rem] p-12 text-center shadow-sm border">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-black">Validando...</p>
          </div>
        )}

        {aba === 'scanner' && ['sucesso', 'erro'].includes(statusLeitura) && (
          <div className={`rounded-[2rem] p-8 text-center border shadow-sm ${statusLeitura === 'sucesso' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
            {statusLeitura === 'sucesso' ? <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={68}/> : <XCircle className="mx-auto text-red-500 mb-4" size={68}/>} 
            <h2 className={`text-3xl font-black ${statusLeitura === 'sucesso' ? 'text-emerald-600' : 'text-red-600'}`}>{statusLeitura === 'sucesso' ? 'Liberado!' : 'Barrado!'}</h2>
            <p className="mt-3 bg-white rounded-2xl border p-4 font-bold text-sm">{resultado}</p>
            <button onClick={resetarScanner} className="w-full mt-6 bg-zinc-900 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2"><RefreshCw size={18}/> Ler próximo</button>
          </div>
        )}

        {aba === 'manual' && (
          <div className="bg-white rounded-[2rem] p-6 border shadow-sm">
            <div className="flex gap-3 items-start mb-5">
              <UserRound className="text-indigo-600 mt-1" />
              <div><h2 className="text-lg font-black">Busca de contingência</h2><p className="text-xs text-zinc-500 mt-1">Use apenas se o QR não puder ser lido.</p></div>
            </div>
            <form onSubmit={buscarManualmente} className="flex gap-2">
              <input value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} placeholder="Nome, CPF ou código" className="flex-1 bg-zinc-50 border rounded-xl px-4 py-3 font-bold outline-none focus:border-indigo-500" />
              <button disabled={isBuscando} className="bg-indigo-600 text-white px-5 rounded-xl"><Search size={18}/></button>
            </form>
            <div className="space-y-3 mt-5">
              {resultados.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-zinc-50 border flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="font-black truncate">{item.donoNome || 'Cliente'}</p><p className="text-[10px] text-zinc-400 font-bold uppercase">{item.tipo || 'Ingresso'}</p></div>
                  {modo === 'entrada' ? (
                    ['usado','saiu','encerrado'].includes(item.status) ? <span className="text-xs font-black text-zinc-400">Já entrou</span> : <button onClick={() => liberarEntradaManualmente(item)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black">Liberar</button>
                  ) : (
                    <span className="text-[10px] font-bold text-zinc-400">Saída: QR obrigatório</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
