import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';
import BottomNav from '../components/BottomNav';
import { eventosOperacionaisDeHoje } from '../utils/eventosOperacionais';
import { calcularResumoComanda } from '../domain/comanda';
import { criarPasseSaidaRef } from '../services/passesSaida';

import {
  Wallet,
  Search,
  CreditCard,
  Banknote,
  CheckCircle2,
  UserCheck,
  Ticket,
  CalendarDays,
  ArrowRight,
  QrCode,
  LogIn,
  LogOut,
  RefreshCcw,
} from 'lucide-react';

// ================= MÁSĆARAS =================

const mascaraCPF = (valor = '') => {
  return valor
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const mascaraTel = (valor = '') => {
  const numeros = valor.replace(/\D/g, '').slice(0, 11);

  if (numeros.length <= 10) {
    return numeros
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return numeros
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};

// ================= COMPONENTE =================

export default function Caixa() {
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [modoOperacao, setModoOperacao] = useState('entrada');

  // ================= ESTADOS DO WIZARD =================

  const [etapaAtual, setEtapaAtual] = useState(1);
  const [cpfBusca, setCpfBusca] = useState('');
  const [cliente, setCliente] = useState(null);

  const [novoCliente, setNovoCliente] = useState({
    nome: '',
    telefone: '',
    dataNascimento: '',
  });

  const [isCadastrando, setIsCadastrando] = useState(false);

  const [dadosFinanceiros, setDadosFinanceiros] = useState(null);
  const [loteEscolhido, setLoteEscolhido] = useState(null);
  const [formaPagamento, setFormaPagamento] = useState('comanda');
  const [isProcessando, setIsProcessando] = useState(false);
  const [passeGerado, setPasseGerado] = useState(null);
  const [ingressoGerado, setIngressoGerado] = useState(null);

  // ================= CARREGAR EVENTOS =================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'eventos'),
      (snapshot) => {
        const eventos = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setEventosGlobais(eventos);
      },
      (error) => {
        console.error('Erro ao carregar eventos:', error);
        toast.error('Erro ao carregar eventos.');
      }
    );

    return () => unsubscribe();
  }, []);

  // ================= RESET =================

  const resetarPDV = () => {
    setEtapaAtual(1);
    setCpfBusca('');
    setCliente(null);
    setIsCadastrando(false);

    setNovoCliente({
      nome: '',
      telefone: '',
      dataNascimento: '',
    });

    setLoteEscolhido(null);
    setDadosFinanceiros(null);
    setFormaPagamento('comanda');
    setPasseGerado(null);
    setIngressoGerado(null);
  };

  // ================= BUSCAR CLIENTE =================

  const buscarClientePorCPF = async (e) => {
    e.preventDefault();

    if (cpfBusca.replace(/\D/g, '').length !== 11) {
      toast.error('Digite o CPF completo.');
      return;
    }

    if (!eventoSelecionado) {
      toast.error('Selecione um evento primeiro.');
      return;
    }

    setIsProcessando(true);

    const toastId = toast.loading('Buscando cliente...');

    try {
      const cpfNumerico = cpfBusca.replace(/\D/g, '');

      const q = query(
        collection(db, 'usuarios'),
        where('cpf', '==', cpfBusca)
      );

      let snapshot = await getDocs(q);

      // Fallback para bancos que armazenaram CPF sem máscara
      if (snapshot.empty) {
        const qSemMascara = query(
          collection(db, 'usuarios'),
          where('cpf', '==', cpfNumerico)
        );

        snapshot = await getDocs(qSemMascara);
      }

      if (snapshot.empty) {
        toast.dismiss(toastId);

        setIsCadastrando(true);

        toast.error('Cliente não encontrado. Faça o cadastro.');
      } else {
        const dadosCliente = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        };

        setCliente(dadosCliente);

        toast.success(
          `Cliente: ${dadosCliente.nome?.split(' ')[0] || 'Cliente'}`,
          {
            id: toastId,
          }
        );

        await verificarSituacaoDoCliente(dadosCliente.id);
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);

      toast.error('Erro no sistema.', {
        id: toastId,
      });
    } finally {
      setIsProcessando(false);
    }
  };

  // ================= CADASTRAR NOVO CLIENTE =================

  const salvarNovoCliente = async (e) => {
    e.preventDefault();

    if (!novoCliente.nome.trim()) {
      toast.error('Preencha o nome.');
      return;
    }

    if (!novoCliente.dataNascimento) {
      toast.error('Preencha a data de nascimento.');
      return;
    }

    if (!eventoSelecionado) {
      toast.error('Selecione um evento primeiro.');
      return;
    }

    setIsProcessando(true);

    const toastId = toast.loading('Cadastrando cliente...');

    try {
      const novoId = doc(collection(db, 'usuarios')).id;

      const cpfFormatado = mascaraCPF(cpfBusca);

      const payload = {
        nome: novoCliente.nome.trim(),
        cpf: cpfFormatado,
        telefone: novoCliente.telefone,
        dataNascimento: novoCliente.dataNascimento,
        role: 'cliente',
        criadoEm: new Date().toISOString(),
      };

      await setDoc(doc(db, 'usuarios', novoId), payload);

      const clienteCriado = {
        id: novoId,
        ...payload,
      };

      setCliente(clienteCriado);
      setIsCadastrando(false);

      setNovoCliente({
        nome: '',
        telefone: '',
        dataNascimento: '',
      });

      toast.success('Cliente cadastrado com sucesso!', {
        id: toastId,
      });

      await verificarSituacaoDoCliente(novoId);
    } catch (error) {
      console.error('Erro ao cadastrar cliente:', error);

      toast.error('Erro ao cadastrar cliente.', {
        id: toastId,
      });
    } finally {
      setIsProcessando(false);
    }
  };

  // ================= VERIFICAR SITUAÇÃO =================

  const verificarSituacaoDoCliente = async (clienteId) => {
    try {
      if (!eventoSelecionado?.id) {
        toast.error('Evento não selecionado.');
        return;
      }

      const evId = eventoSelecionado.id;

      const [
        espacosSnap,
        pedidosSnap,
        pagamentosSnap,
        descSplitsSnap,
        adcSplitsSnap,
        ingressosSnap,
        comandasSnap,
        passesSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, 'espacos'),
            where('eventoId', '==', evId),
            where('donoId', '==', clienteId)
          )
        ),

        getDocs(
          query(
            collection(db, 'pedidos'),
            where('eventoId', '==', evId),
            where('clienteId', '==', clienteId)
          )
        ),

        getDocs(
          query(
            collection(db, 'pagamentos_comanda'),
            where('eventoId', '==', evId),
            where('clienteId', '==', clienteId)
          )
        ),

        getDocs(
          query(
            collection(db, 'cobrancas_split'),
            where('eventoId', '==', evId),
            where('deId', '==', clienteId),
            where('status', '==', 'aceito')
          )
        ),

        getDocs(
          query(
            collection(db, 'cobrancas_split'),
            where('eventoId', '==', evId),
            where('paraId', '==', clienteId),
            where('status', '==', 'aceito')
          )
        ),

        getDocs(
          query(
            collection(db, 'ingressos_vendidos'),
            where('eventoId', '==', evId),
            where('donoId', '==', clienteId)
          )
        ),

        getDocs(
          query(
            collection(db, 'comandas_ativas'),
            where('eventoId', '==', evId),
            where('clienteId', '==', clienteId)
          )
        ),

        getDocs(
          query(
            collection(db, 'passes_saida'),
            where('eventoId', '==', evId),
            where('clienteId', '==', clienteId)
          )
        ),
      ]);

      const resumo = calcularResumoComanda({
        ingressos: ingressosSnap.docs.map((docItem) => docItem.data()),
        espacos: espacosSnap.docs.map((docItem) => docItem.data()),
        pedidos: pedidosSnap.docs.map((docItem) => docItem.data()),
        pagamentos: pagamentosSnap.docs.map((docItem) => docItem.data()),
        splitsEnviados: descSplitsSnap.docs.map((docItem) =>
          docItem.data()
        ),
        splitsRecebidos: adcSplitsSnap.docs.map((docItem) =>
          docItem.data()
        ),
      });

      const temEntrada =
        !ingressosSnap.empty || !espacosSnap.empty;

      const comandasEncontradas = comandasSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      const passesDisponiveis = passesSnap.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .filter((pass) => pass.status === 'disponivel');

      setDadosFinanceiros({
        ...resumo,
        temEntrada,
        comandas: comandasEncontradas,
        passesDisponiveis,
      });

      if (modoOperacao === 'entrada') {
        // Se já possui entrada, vai direto para a comanda.
        // Caso contrário, precisa escolher o ingresso.
        setEtapaAtual(temEntrada ? 3 : 2);
      }
    } catch (error) {
      console.error('Erro ao verificar situação:', error);

      toast.error('Erro ao puxar dados do cliente.');
    }
  };

  // ================= FINALIZAR ENTRADA =================

  const finalizarEntrada = async () => {
    if (!cliente) {
      toast.error('Cliente não identificado.');
      return;
    }

    if (!dadosFinanceiros) {
      toast.error('Dados financeiros não carregados.');
      return;
    }

    if (!dadosFinanceiros.temEntrada && !loteEscolhido) {
      toast.error('Selecione um ingresso.');
      return;
    }

    setIsProcessando(true);
    const toastId = toast.loading('Registrando operação...');

    try {
      // O Caixa VENDE. A Segurança é quem efetivamente valida a entrada.
      if (!dadosFinanceiros.temEntrada) {
        const ingressoRef = doc(collection(db, 'ingressos_vendidos'));
        const agora = new Date().toISOString();

        await setDoc(ingressoRef, {
          eventoId: eventoSelecionado.id,
          eventoNome: eventoSelecionado.nome,
          tipo: `Portaria: ${loteEscolhido.nome}`,
          preco: Number(loteEscolhido.precoAplicado) || 0,
          consumacao: Number(loteEscolhido.consumacao) || 0,
          donoId: cliente.id,
          donoNome: cliente.nome,
          donoCpf: cliente.cpf || cpfBusca,
          dataCompra: agora,
          status: 'valido',
          origem: 'portaria',
          pagamentoNaSaida: formaPagamento === 'comanda',
          codigoIngresso: ingressoRef.id,
        });

        if (formaPagamento === 'porta') {
          await addDoc(collection(db, 'pagamentos_ingressos'), {
            eventoId: eventoSelecionado.id,
            eventoNome: eventoSelecionado.nome,
            clienteId: cliente.id,
            ingressoId: ingressoRef.id,
            valorPago: Number(loteEscolhido.precoAplicado) || 0,
            metodo: 'porta',
            operadorCaixa: true,
            status: 'confirmado',
            dataPagamento: agora,
          });
        }

        setIngressoGerado({
          id: ingressoRef.id,
          nome: loteEscolhido.nome,
          eventoId: eventoSelecionado.id,
        });

        toast.success(
          formaPagamento === 'porta'
            ? 'Ingresso vendido e pago. Apresente o QR na Segurança.'
            : 'Ingresso vendido. Apresente o QR na Segurança; o ingresso será cobrado na saída.',
          { id: toastId }
        );

        setEtapaAtual(4);
        return;
      }

      toast.success('Cliente já possui uma entrada. Nenhuma nova entrada foi criada.', {
        id: toastId,
      });
      resetarPDV();
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      toast.error('Erro ao registrar operação.', { id: toastId });
    } finally {
      setIsProcessando(false);
    }
  };

  // ================= PAGAMENTO NA SAÍDA =================

  const registrarPagamentoSaida = async (metodo) => {
    if (!dadosFinanceiros) {
      toast.error('Dados financeiros não carregados.');
      return;
    }

    const valor = Number(dadosFinanceiros.saldoDevedor) || 0;
    if (valor <= 0) {
      toast.error('Comanda já está zerada.');
      return;
    }

    if (!cliente || !eventoSelecionado) {
      toast.error('Cliente ou evento não identificado.');
      return;
    }

    const comandaAtiva = (dadosFinanceiros.comandas || []).find((comanda) =>
      ['aberta', 'paga'].includes(comanda.status)
    );

    if (!comandaAtiva) {
      toast.error('Nenhuma comanda ativa encontrada.');
      return;
    }

    setIsProcessando(true);
    const toastId = toast.loading(`Registrando pagamento via ${metodo}...`);

    try {
      const agora = new Date().toISOString();
      const pagamentoRef = doc(collection(db, 'pagamentos_comanda'));
      const passeRef = criarPasseSaidaRef();
      const batch = writeBatch(db);

      batch.set(pagamentoRef, {
        eventoId: eventoSelecionado.id,
        eventoNome: eventoSelecionado.nome,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        valorPago: valor,
        dataPagamento: agora,
        metodo,
        operadorCaixa: true,
        status: 'confirmado',
        comandaId: comandaAtiva.id,
      });

      batch.update(doc(db, 'comandas_ativas', comandaAtiva.id), {
        status: 'paga',
        pagoEm: agora,
        valorPago: valor,
        formaPagamentoFechamento: metodo,
        pagamentoId: pagamentoRef.id,
        ultimaAtualizacaoEm: agora,
      });

      batch.set(passeRef, {
        eventoId: eventoSelecionado.id,
        eventoNome: eventoSelecionado.nome,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        comandaId: comandaAtiva.id,
        pagamentoId: pagamentoRef.id,
        valorPago: valor,
        criadoEm: agora,
        expiraEm: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: 'disponivel',
        utilizadoEm: null,
        origem: 'caixa',
      });

      await batch.commit();

      toast.success('Pagamento confirmado. Passe de saída liberado.', { id: toastId });
      resetarPDV();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      toast.error('Erro ao registrar pagamento.', { id: toastId });
    } finally {
      setIsProcessando(false);
    }
  };

  // ============================================================
  // TELA: SELEÇÃO DE EVENTOS
  // ============================================================

  if (!eventoSelecionado) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white pb-24">
        <div className="max-w-2xl mx-auto px-4 py-8">

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                <Wallet className="text-indigo-400" size={24} />
              </div>

              <div>
                <h1 className="text-2xl font-black">
                  Portaria e Caixa
                </h1>

                <p className="text-zinc-500 text-sm">
                  Selecione o evento de hoje para iniciar.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {eventosOperacionaisDeHoje(eventosGlobais).length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 text-center">
                <CalendarDays
                  className="mx-auto text-zinc-600 mb-4"
                  size={40}
                />

                <p className="text-zinc-500 font-bold">
                  Nenhum evento disponível.
                </p>
              </div>
            ) : (
              eventosOperacionaisDeHoje(eventosGlobais).map((evento) => (
                <button
                  key={evento.id}
                  onClick={() => {
                    setEventoSelecionado(evento);
                    resetarPDV();
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-[2rem] text-left hover:border-indigo-500 transition-all active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-between gap-4">

                    <div>
                      <h2 className="text-lg font-black text-white mb-2">
                        {evento.nome}
                      </h2>

                      <p className="text-xs font-bold text-zinc-500 uppercase">
                        Abrir operação
                      </p>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                      <ArrowRight size={20} />
                    </div>

                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ============================================================
  // TELA PRINCIPAL DO PDV
  // ============================================================

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* ================= HEADER ================= */}

        <div className="flex items-center justify-between gap-4 mb-6">

          <div>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">
              PDV
            </p>

            <h1 className="text-xl font-black">
              {eventoSelecionado.nome}
            </h1>
          </div>

          <button
            onClick={() => {
              setEventoSelecionado(null);
              resetarPDV();
            }}
            className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-xs font-black"
          >
            Trocar
          </button>

        </div>

        {/* ================= TABS ================= */}

        <div className="flex gap-2 mb-6">

          <button
            onClick={() => {
              setModoOperacao('entrada');
              resetarPDV();
            }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
              modoOperacao === 'entrada'
                ? 'bg-emerald-600 text-white'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}
          >
            <LogIn size={15} />
            1. Entrada
          </button>

          <button
            onClick={() => {
              setModoOperacao('saida');
              resetarPDV();
            }}
            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
              modoOperacao === 'saida'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
            }`}
          >
            <LogOut size={15} />
            2. Saída
          </button>

        </div>

        {/* ======================================================
            MODO ENTRADA
        ====================================================== */}

        {modoOperacao === 'entrada' && etapaAtual === 4 && ingressoGerado ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 text-center space-y-5">
            <CheckCircle2 className="mx-auto text-emerald-400" size={48} />
            <div>
              <h2 className="text-2xl font-black">Ingresso registrado</h2>
              <p className="text-zinc-500 text-sm mt-1">Apresente este QR na Segurança para liberar a entrada.</p>
            </div>
            <div className="bg-white rounded-3xl p-6 inline-flex">
              <QRCode value={`ingresso|${ingressoGerado.id}|${cliente?.id || ''}`} size={220} />
            </div>
            <div className="text-left bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="font-black">{cliente?.nome}</p>
              <p className="text-xs text-zinc-500 mt-1">{ingressoGerado.nome}</p>
            </div>
            <button type="button" onClick={resetarPDV} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase">Nova operação</button>
          </div>
        ) : modoOperacao === 'entrada' && (
          <div className="space-y-4">

            {/* ================= PASSO 1 ================= */}

            <div
              className={`rounded-[2rem] border p-5 ${
                etapaAtual >= 1
                  ? 'border-zinc-800 bg-zinc-900'
                  : 'border-zinc-900 bg-zinc-950'
              }`}
            >
              <div className="flex items-center gap-3 mb-5">

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    etapaAtual > 1
                      ? 'bg-emerald-600'
                      : 'bg-indigo-600'
                  }`}
                >
                  {etapaAtual > 1 ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Search size={20} />
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 font-black uppercase">
                    Passo 1
                  </p>

                  <h2 className="font-black">
                    Identificação
                  </h2>
                </div>

              </div>

              {/* BUSCA CPF */}

              {etapaAtual === 1 && !isCadastrando && (
                <form
                  onSubmit={buscarClientePorCPF}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">
                      CPF do cliente
                    </label>

                    <input
                      type="text"
                      value={cpfBusca}
                      onChange={(e) =>
                        setCpfBusca(mascaraCPF(e.target.value))
                      }
                      placeholder="000.000.000-00"
                      maxLength={14}
                      autoFocus
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 font-black text-white text-center text-xl tracking-widest focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessando}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-xl uppercase flex items-center justify-center gap-2"
                  >
                    <Search size={18} />

                    {isProcessando
                      ? 'Buscando...'
                      : 'Buscar Cliente'}
                  </button>
                </form>
              )}

              {/* CADASTRO */}

              {etapaAtual === 1 && isCadastrando && (
                <form
                  onSubmit={salvarNovoCliente}
                  className="space-y-4"
                >
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                    <p className="text-amber-400 text-sm font-bold">
                      ⚠️ CPF não encontrado.
                    </p>

                    <p className="text-zinc-500 text-xs mt-1">
                      Preencha os dados do cliente para continuar.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">
                      Nome completo
                    </label>

                    <input
                      type="text"
                      value={novoCliente.nome}
                      onChange={(e) =>
                        setNovoCliente({
                          ...novoCliente,
                          nome: e.target.value,
                        })
                      }
                      placeholder="Nome do cliente"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">
                      Data de nascimento
                    </label>

                    <input
                      type="date"
                      value={novoCliente.dataNascimento}
                      onChange={(e) =>
                        setNovoCliente({
                          ...novoCliente,
                          dataNascimento: e.target.value,
                        })
                      }
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-zinc-500 mb-2">
                      Telefone
                    </label>

                    <input
                      type="text"
                      value={novoCliente.telefone}
                      onChange={(e) =>
                        setNovoCliente({
                          ...novoCliente,
                          telefone: mascaraTel(e.target.value),
                        })
                      }
                      placeholder="(11) 99999-9999"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 font-bold text-white outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex gap-2">

                    <button
                      type="button"
                      onClick={() => {
                        setIsCadastrando(false);
                        setNovoCliente({
                          nome: '',
                          telefone: '',
                          dataNascimento: '',
                        });
                      }}
                      className="flex-1 bg-zinc-800 text-white font-black py-4 rounded-xl uppercase"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={isProcessando}
                      className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-xl uppercase disabled:opacity-50"
                    >
                      {isProcessando
                        ? 'Salvando...'
                        : 'Salvar'}
                    </button>

                  </div>
                </form>
              )}

              {/* CLIENTE ENCONTRADO */}

              {cliente && etapaAtual > 1 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center">
                      <UserCheck
                        size={20}
                        className="text-emerald-400"
                      />
                    </div>

                    <div>
                      <p className="font-black">
                        {cliente.nome}
                      </p>

                      <p className="text-xs text-zinc-500">
                        {cliente.cpf}
                      </p>
                    </div>

                  </div>

                </div>
              )}
            </div>

            {/* ================= PASSO 2 ================= */}

            <div
              className={`rounded-[2rem] border p-5 ${
                etapaAtual >= 2
                  ? 'border-zinc-800 bg-zinc-900'
                  : 'border-zinc-900 bg-zinc-950 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-5">

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    etapaAtual > 2
                      ? 'bg-emerald-600'
                      : etapaAtual === 2
                      ? 'bg-indigo-600'
                      : 'bg-zinc-800'
                  }`}
                >
                  {etapaAtual > 2 ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <Ticket size={20} />
                  )}
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 font-black uppercase">
                    Passo 2
                  </p>

                  <h2 className="font-black">
                    Ingresso
                  </h2>
                </div>

              </div>

              {etapaAtual === 2 &&
                dadosFinanceiros?.temEntrada && (
                  <div className="space-y-4">

                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">

                      <CheckCircle2
                        className="mx-auto text-emerald-400 mb-3"
                        size={36}
                      />

                      <p className="font-black text-emerald-400">
                        Cliente já possui ingresso!
                      </p>

                      <p className="text-xs text-zinc-500 mt-1">
                        Comprado pelo app ou área VIP.
                      </p>

                    </div>

                    <button
                      onClick={() => setEtapaAtual(3)}
                      className="w-full bg-emerald-600 text-white px-8 py-4 rounded-xl font-black uppercase"
                    >
                      Avançar
                    </button>

                  </div>
                )}

              {etapaAtual === 2 &&
                !dadosFinanceiros?.temEntrada && (
                  <div className="space-y-5">

                    <p className="text-sm font-bold text-zinc-400">
                      Selecione o lote e o preço:
                    </p>

                    {!eventoSelecionado.ingressos?.length ? (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-center">
                        <Ticket
                          className="mx-auto text-zinc-600 mb-3"
                          size={32}
                        />

                        <p className="text-zinc-500 font-bold text-sm">
                          Nenhum ingresso configurado para este evento.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">

                        {eventoSelecionado.ingressos.map((ingresso) => {

                          if (ingresso.tipoPreco === 'unico') {
                            const selecionado =
                              loteEscolhido?.id === ingresso.id &&
                              loteEscolhido?.sexo === 'unico';

                            return (
                              <button
                                key={`${ingresso.id}-unico`}
                                type="button"
                                onClick={() =>
                                  setLoteEscolhido({
                                    ...ingresso,
                                    sexo: 'unico',
                                    precoAplicado:
                                      Number(ingresso.preco) || 0,
                                  })
                                }
                                className={`w-full p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                                  selecionado
                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-600'
                                }`}
                              >
                                <div>
                                  <p className="font-black">
                                    {ingresso.nome}
                                  </p>

                                  <p className="text-xs text-zinc-500 mt-1">
                                    Lote único
                                  </p>
                                </div>

                                <p className="font-black">
                                  R${' '}
                                  {Number(
                                    ingresso.preco || 0
                                  ).toFixed(2)}
                                </p>
                              </button>
                            );
                          }

                          const nomeFem = `${ingresso.nome} (Fem)`;
                          const nomeMasc = `${ingresso.nome} (Masc)`;

                          const femininoSelecionado =
                            loteEscolhido?.id === ingresso.id &&
                            loteEscolhido?.sexo === 'feminino';

                          const masculinoSelecionado =
                            loteEscolhido?.id === ingresso.id &&
                            loteEscolhido?.sexo === 'masculino';

                          return (
                            <div
                              key={ingresso.id}
                              className="grid grid-cols-2 gap-2"
                            >

                              <button
                                type="button"
                                onClick={() =>
                                  setLoteEscolhido({
                                    ...ingresso,
                                    sexo: 'feminino',
                                    nome: nomeFem,
                                    precoAplicado:
                                      Number(
                                        ingresso.precoFem
                                      ) || 0,
                                  })
                                }
                                className={`p-4 rounded-xl border text-left transition-all ${
                                  femininoSelecionado
                                    ? 'bg-pink-600 border-pink-500 text-white'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-pink-500'
                                }`}
                              >
                                <p className="font-black">
                                  {ingresso.nome} Fem
                                </p>

                                <p className="text-sm font-black mt-2">
                                  R${' '}
                                  {Number(
                                    ingresso.precoFem || 0
                                  ).toFixed(2)}
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setLoteEscolhido({
                                    ...ingresso,
                                    sexo: 'masculino',
                                    nome: nomeMasc,
                                    precoAplicado:
                                      Number(
                                        ingresso.precoMasc
                                      ) || 0,
                                  })
                                }
                                className={`p-4 rounded-xl border text-left transition-all ${
                                  masculinoSelecionado
                                    ? 'bg-blue-600 border-blue-500 text-white'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-blue-500'
                                }`}
                              >
                                <p className="font-black">
                                  {ingresso.nome} Masc
                                </p>

                                <p className="text-sm font-black mt-2">
                                  R${' '}
                                  {Number(
                                    ingresso.precoMasc || 0
                                  ).toFixed(2)}
                                </p>
                              </button>

                            </div>
                          );
                        })}

                      </div>
                    )}

                    {/* PAGAMENTO */}

                    {loteEscolhido && (
                      <div className="pt-3 border-t border-zinc-800">

                        <p className="text-xs font-black uppercase text-zinc-500 mb-3">
                          Cobrança da entrada
                        </p>

                        <div className="grid grid-cols-2 gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              setFormaPagamento('porta')
                            }
                            className={`py-3 rounded-xl border font-black text-xs uppercase ${
                              formaPagamento === 'porta'
                                ? 'bg-emerald-900 border-emerald-500 text-emerald-400'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                            }`}
                          >
                            Cobrar agora
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setFormaPagamento('comanda')
                            }
                            className={`py-3 rounded-xl border font-black text-xs uppercase ${
                              formaPagamento === 'comanda'
                                ? 'bg-indigo-900 border-indigo-500 text-indigo-400'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                            }`}
                          >
                            Pagar na saída
                          </button>

                        </div>

                        <button
                          type="button"
                          onClick={() => setEtapaAtual(3)}
                          className="w-full mt-4 bg-white text-zinc-950 font-black py-4 rounded-xl uppercase"
                        >
                          Confirmar entrada
                        </button>

                      </div>
                    )}

                  </div>
                )}

              {etapaAtual > 2 && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 font-black uppercase mb-1">
                    Entrada selecionada
                  </p>

                  <p className="font-black">
                    {dadosFinanceiros?.temEntrada
                      ? 'Ingresso Online Validado'
                      : loteEscolhido?.nome}
                  </p>

                  {!dadosFinanceiros?.temEntrada &&
                    loteEscolhido && (
                      <p className="text-sm text-indigo-400 font-bold mt-1">
                        R${' '}
                        {Number(
                          loteEscolhido.precoAplicado || 0
                        ).toFixed(2)}
                      </p>
                    )}
                </div>
              )}
            </div>

            {/* ================= PASSO 3 ================= */}

            <div
              className={`rounded-[2rem] border p-5 ${
                etapaAtual >= 3
                  ? 'border-zinc-800 bg-zinc-900'
                  : 'border-zinc-900 bg-zinc-950 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-5">

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    etapaAtual === 3
                      ? 'bg-indigo-600'
                      : 'bg-zinc-800'
                  }`}
                >
                  <QrCode size={20} />
                </div>

                <div>
                  <p className="text-[10px] text-zinc-500 font-black uppercase">
                    Passo 3
                  </p>

                  <h2 className="font-black">
                    Comanda Digital
                  </h2>
                </div>

              </div>

              {etapaAtual === 3 && (
                <div className="space-y-4">

                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
                    <p className="text-indigo-300 text-sm font-bold">
                      A comanda é digital e será criada automaticamente no aplicativo do cliente.
                    </p>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
                        <QrCode size={20} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-black text-white">Comanda pelo aplicativo</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          O cliente usará o próprio app para fazer pedidos e acompanhar a conta.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">

                    <button
                      type="button"
                      onClick={() => {
                        setEtapaAtual(
                          dadosFinanceiros?.temEntrada ? 3 : 2
                        );
                                          }}
                      className="flex-1 bg-zinc-800 text-white font-black py-4 rounded-xl uppercase"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={finalizarEntrada}
                      disabled={isProcessando}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-4 rounded-xl uppercase flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />

                      {isProcessando
                        ? 'Liberando...'
                        : 'Liberar Entrada'}
                    </button>

                  </div>

                </div>
              )}
            </div>

          </div>
        )}

        {/* ======================================================
            MODO SAÍDA
        ====================================================== */}

        {modoOperacao === 'saida' && (
          <div className="space-y-4">

            {!cliente ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5">

                <div className="flex items-center gap-3 mb-6">

                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                    <LogOut size={20} />
                  </div>

                  <div>
                    <p className="text-[10px] text-zinc-500 font-black uppercase">
                      Fechamento
                    </p>

                    <h2 className="font-black">
                      Saída do cliente
                    </h2>
                  </div>

                </div>

                <form
                  onSubmit={buscarClientePorCPF}
                  className="space-y-4"
                >
                  <div>
                    <p className="text-sm text-zinc-500 mb-4">
                      Digite o CPF do cliente que está saindo.
                    </p>

                    <input
                      type="text"
                      value={cpfBusca}
                      onChange={(e) =>
                        setCpfBusca(mascaraCPF(e.target.value))
                      }
                      placeholder="000.000.000-00"
                      maxLength={14}
                      autoFocus
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-4 font-black text-white text-center text-xl outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessando}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-xl uppercase flex items-center justify-center gap-2"
                  >
                    <Search size={18} />

                    {isProcessando
                      ? 'Localizando...'
                      : 'Localizar Comanda'}
                  </button>
                </form>

              </div>
            ) : dadosFinanceiros ? (
              <div className="space-y-4">

                {/* CLIENTE */}

                <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5">

                  <div className="flex items-center justify-between gap-4">

                    <div className="flex items-center gap-3">

                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                        <UserCheck
                          size={22}
                          className="text-indigo-400"
                        />
                      </div>

                      <div>
                        <h2 className="font-black">
                          {cliente.nome}
                        </h2>

                        <p className="text-xs text-zinc-500">
                          {cliente.cpf}
                        </p>
                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={resetarPDV}
                      className="bg-zinc-800 px-3 py-2 rounded-xl text-xs font-black text-zinc-300"
                    >
                      Voltar
                    </button>

                  </div>

                </div>

                {/* EXTRATO */}

                <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-5">

                  <h3 className="text-sm font-black uppercase mb-5">
                    Extrato
                  </h3>

                  <div className="space-y-3">

                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-sm">
                        Consumo do bar
                      </span>

                      <span className="font-black">
                        R${' '}
                        {Number(
                          dadosFinanceiros.totalBar || 0
                        ).toFixed(2)}
                      </span>
                    </div>

                    {Number(
                      dadosFinanceiros.totalEntradaPosPaga || 0
                    ) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 text-sm">
                          Entrada pendente
                        </span>

                        <span className="font-black text-amber-400">
                          + R${' '}
                          {Number(
                            dadosFinanceiros.totalEntradaPosPaga
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {Number(
                      dadosFinanceiros.totalConsumacao || 0
                    ) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 text-sm">
                          Consumação bônus
                        </span>

                        <span className="font-black text-emerald-400">
                          - R${' '}
                          {Number(
                            dadosFinanceiros.totalConsumacao
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {Number(
                      dadosFinanceiros.totalPago || 0
                    ) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 text-sm">
                          Pagamentos anteriores
                        </span>

                        <span className="font-black text-emerald-400">
                          - R${' '}
                          {Number(
                            dadosFinanceiros.totalPago
                          ).toFixed(2)}
                        </span>
                      </div>
                    )}

                  </div>

                  {/* TOTAL */}

                  <div className="border-t border-zinc-800 mt-5 pt-5">

                    <div className="flex items-end justify-between">

                      <div>
                        <p className="text-xs text-zinc-500 font-black uppercase">
                          A pagar
                        </p>

                        <p
                          className={`text-3xl font-black mt-1 ${
                            Number(
                              dadosFinanceiros.saldoDevedor || 0
                            ) > 0
                              ? 'text-red-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          R${' '}
                          {Number(
                            dadosFinanceiros.saldoDevedor || 0
                          ).toFixed(2)}
                        </p>
                      </div>

                      {Number(
                        dadosFinanceiros.saldoDevedor || 0
                      ) <= 0 && (
                        <CheckCircle2
                          className="text-emerald-400"
                          size={32}
                        />
                      )}

                    </div>

                  </div>

                </div>

                {/* PAGAMENTO */}

                {Number(
                  dadosFinanceiros.saldoDevedor || 0
                ) > 0 ? (
                  <div className="grid grid-cols-2 gap-3">

                    <button
                      type="button"
                      onClick={() =>
                        registrarPagamentoSaida('Cartão')
                      }
                      disabled={isProcessando}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2"
                    >
                      <CreditCard size={18} />
                      Cartão
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        registrarPagamentoSaida(
                          'Dinheiro/Pix'
                        )
                      }
                      disabled={isProcessando}
                      className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Banknote size={18} />
                      Dinheiro / Pix
                    </button>

                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-6 text-center">

                    <CheckCircle2
                      className="mx-auto text-emerald-400 mb-3"
                      size={40}
                    />

                    <p className="font-black text-emerald-400 text-lg">
                      Conta zerada!
                    </p>

                    <p className="text-zinc-500 text-sm mt-1">
                      Cliente pode sair.
                    </p>

                  </div>
                )}

              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 text-center">

                <RefreshCcw
                  className="mx-auto text-zinc-600 mb-4"
                  size={36}
                />

                <p className="text-zinc-500 font-bold">
                  Carregando dados...
                </p>

              </div>
            )}

          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}