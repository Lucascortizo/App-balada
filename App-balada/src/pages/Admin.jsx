import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Admin() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [abaAtiva, setAbaAtiva] = useState('eventos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ================= ESTADOS: GERAIS =================
  const [faturamentoGlobal, setFaturamentoGlobal] = useState(0);
  const [pedidos, setPedidos] = useState([]);

  // ================= ESTADOS: CARDÁPIO E ESTOQUE =================
  const [produtos, setProdutos] = useState([]);
  const [novoItem, setNovoItem] = useState({ nome: '', preco: '', categoria: 'Drinks', img: '🍸', estoque: 50 });

  // ================= ESTADOS: EVENTOS =================
  const [eventos, setEventos] = useState([]);
  const [novoEvento, setNovoEvento] = useState({ nome: '', data: '', descricao: '', linkImagem: '', mapaImagem: '', precoPista: '' });
  const [setores, setSetores] = useState([{ id: 1, tipo: 'Camarote', quantidade: 4, preco: 2000, consumacao: 1500, capacidade: 10 }]);

  // ================= ESTADOS: RELATÓRIO DO EVENTO ESPECÍFICO =================
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [espacosRelatorio, setEspacosRelatorio] = useState([]);
  const [ingressosRelatorio, setIngressosRelatorio] = useState([]);

  // ================= ESCUTADORES GLOBAIS =================
  useEffect(() => {
    const unsubPedidos = onSnapshot(collection(db, "pedidos"), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPedidos(lista);
      setFaturamentoGlobal(lista.reduce((acc, p) => acc + (p.total || 0), 0));
    });

    const unsubCardapio = onSnapshot(collection(db, "cardapio"), (snapshot) => {
      setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEventos = onSnapshot(collection(db, "eventos"), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => new Date(b.data) - new Date(a.data));
      setEventos(lista);
    });

    return () => { unsubPedidos(); unsubCardapio(); unsubEventos(); };
  }, []);

  // ================= ESCUTADOR DO RELATÓRIO DO EVENTO =================
  useEffect(() => {
    if (!eventoSelecionado) return;

    const qEspacos = query(collection(db, "espacos"), where("eventoId", "==", eventoSelecionado.id));
    const unsubEspacos = onSnapshot(qEspacos, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => a.sigla.localeCompare(b.sigla));
      setEspacosRelatorio(lista);
    });

    const qIngressos = query(collection(db, "ingressos_vendidos"), where("eventoId", "==", eventoSelecionado.id));
    const unsubIngressos = onSnapshot(qIngressos, (snapshot) => {
      setIngressosRelatorio(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubEspacos(); unsubIngressos(); };
  }, [eventoSelecionado]);


  // ================= FUNÇÕES: CARDÁPIO E ESTOQUE NUMÉRICO =================
  const adicionarProduto = async (e) => {
    e.preventDefault();
    if (!novoItem.nome || !novoItem.preco) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "cardapio"), {
        ...novoItem,
        preco: parseFloat(novoItem.preco),
        estoque: parseInt(novoItem.estoque)
      });
      setNovoItem({ nome: '', preco: '', categoria: 'Drinks', img: '🍸', estoque: 50 });
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const deletarProduto = async (id) => {
    if (window.confirm('Excluir permanentemente?')) await deleteDoc(doc(db, "cardapio", id));
  };

  const ajustarEstoque = async (id, estoqueAtual, variacao) => {
    const novoEstoque = Math.max(0, estoqueAtual + variacao);
    await updateDoc(doc(db, "cardapio", id), { estoque: novoEstoque });
  };


  // ================= FUNÇÕES: EVENTOS =================
  const adicionarSetor = () => setSetores([...setores, { id: Date.now(), tipo: 'Camarote', quantidade: 1, preco: 0, consumacao: 0, capacidade: 10 }]);
  const atualizarSetor = (id, campo, valor) => setSetores(setores.map(s => s.id === id ? { ...s, [campo]: valor } : s));
  const removerSetor = (id) => setSetores(setores.filter(s => s.id !== id));

  const criarEvento = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const eventoRef = await addDoc(collection(db, "eventos"), {
        ...novoEvento, precoPista: parseFloat(novoEvento.precoPista), criadoEm: new Date().toISOString(), status: 'ativo'
      });

      const batch = writeBatch(db);
      const contagemPrefixos = {};

      setores.forEach(setor => {
        const letra = setor.tipo.charAt(0).toUpperCase();
        let numeroAtual = contagemPrefixos[letra] || 0;

        for (let i = 1; i <= parseInt(setor.quantidade); i++) {
          numeroAtual++;
          const espacoRef = doc(collection(db, "espacos"));
          batch.set(espacoRef, {
            eventoId: eventoRef.id,
            nome: `${setor.tipo} ${letra}${numeroAtual}`,
            sigla: `${letra}${numeroAtual}`,
            tipo: setor.tipo,
            preco: parseFloat(setor.preco || 0),
            consumacao: parseFloat(setor.consumacao || 0),
            capacidade: parseInt(setor.capacidade || 1),
            status: "disponivel"
          });
        }
        contagemPrefixos[letra] = numeroAtual;
      });

      await batch.commit();
      setNovoEvento({ nome: '', data: '', descricao: '', linkImagem: '', mapaImagem: '', precoPista: '' });
      setMostrarFormulario(false);
      alert("Evento gerado com sucesso!");
    } catch (error) { alert("Erro ao criar evento."); } finally { setIsSubmitting(false); }
  };

  const excluirEvento = async (id) => {
    if (window.confirm("Deseja excluir este evento? (Isto não apaga os ingressos já vendidos no banco)")) {
      await deleteDoc(doc(db, "eventos", id));
    }
  };

  // ================= CHECAGEM DE ADMIN =================
  // Fica DEPOIS de todos os hooks acima — nunca antes, senão viola as Regras de Hooks do React
  if (!user?.isAdmin) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans pb-24">
      <header className="mb-8 border-b border-gray-700 pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-purple-400">Painel de Comando ⚙️</h1>
          <p className="text-gray-400">Visão do Administrador</p>
        </div>
        <div className="flex flex-wrap gap-2 bg-gray-800 p-1 rounded-lg">
          <button onClick={() => { setAbaAtiva('dashboard'); setEventoSelecionado(null); }} className={`px-4 py-2 rounded-md font-bold transition ${abaAtiva === 'dashboard' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Dashboard</button>
          <button onClick={() => { setAbaAtiva('eventos'); setEventoSelecionado(null); }} className={`px-4 py-2 rounded-md font-bold transition ${abaAtiva === 'eventos' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Eventos</button>
          <button onClick={() => { setAbaAtiva('cardapio'); setEventoSelecionado(null); }} className={`px-4 py-2 rounded-md font-bold transition ${abaAtiva === 'cardapio' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Cardápio / Estoque</button>
        </div>
      </header>

      {/* ================= ABA 1: DASHBOARD GERAL ================= */}
      {abaAtiva === 'dashboard' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div className="bg-gradient-to-br from-green-900/50 to-green-600/20 p-6 rounded-2xl border border-green-500/30">
              <h3 className="text-green-400 font-semibold mb-2">Faturamento Geral (Bar)</h3>
              <p className="text-4xl font-bold">R$ {faturamentoGlobal.toFixed(2)}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-600/20 p-6 rounded-2xl border border-purple-500/30">
              <h3 className="text-purple-400 font-semibold mb-2">Total de Comandas</h3>
              <p className="text-4xl font-bold">{pedidos.length}</p>
            </div>
          </div>
          <h2 className="text-xl font-bold mb-4 border-l-4 border-purple-500 pl-3">Últimos Pedidos do Bar</h2>
          <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 p-4">
             {pedidos.length > 0 ? (
                <ul className="space-y-3">
                  {[...pedidos].reverse().slice(0, 10).map((pedido, i) => (
                    <li key={i} className="flex justify-between items-center border-b border-gray-700 pb-2">
                      <div>
                        <p className="font-bold">{pedido.clienteNome}</p>
                        <p className="text-xs text-gray-400">{pedido.itens?.length} itens - {pedido.formaPagamento}</p>
                      </div>
                      <p className="text-green-400 font-bold">R$ {pedido.total?.toFixed(2)}</p>
                    </li>
                  ))}
                </ul>
             ) : (
                <p className="text-gray-500 text-center">Nenhum pedido registrado.</p>
             )}
          </div>
        </div>
      )}

      {/* ================= ABA 2: EVENTOS E RELATÓRIOS ================= */}
      {abaAtiva === 'eventos' && (
        <div className="animate-fade-in">

          {/* MENU DE EVENTOS (Criação e Listagem) */}
          {!eventoSelecionado ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Eventos Ativos</h2>
                <button onClick={() => setMostrarFormulario(!mostrarFormulario)} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition">
                  {mostrarFormulario ? '✕ Fechar Formulário' : '+ Novo Evento'}
                </button>
              </div>

              {mostrarFormulario && (
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mb-8 shadow-2xl relative">
                  <h2 className="text-xl font-bold mb-6 text-purple-400">Criar Novo Evento</h2>
                  <form onSubmit={criarEvento} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">Nome da Festa</label>
                        <input type="text" required value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Data e Hora</label>
                        <input type="datetime-local" required value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white" />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-green-400 font-bold mb-1">Preço Pista (R$)</label>
                        <input type="number" required value={novoEvento.precoPista} onChange={e => setNovoEvento({...novoEvento, precoPista: e.target.value})} className="w-full bg-gray-900 border border-green-500/50 rounded-lg p-2 text-white font-bold" />
                      </div>
                    </div>

                    <div className="bg-gray-900/50 p-4 rounded-lg border border-purple-500/30">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Setores VIP</h3>
                        <button type="button" onClick={adicionarSetor} className="bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-3 py-1 rounded-lg text-xs font-bold transition">+ Setor</button>
                      </div>
                      <div className="space-y-2">
                        {setores.map(setor => (
                          <div key={setor.id} className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end bg-gray-800 p-3 rounded relative">
                            <button type="button" onClick={() => removerSetor(setor.id)} className="absolute top-1 right-2 text-red-500 font-bold text-xs">✕</button>
                            <div className="md:col-span-1">
                              <label className="block text-[10px] text-gray-400">Tipo</label>
                              <select value={setor.tipo} onChange={e => atualizarSetor(setor.id, 'tipo', e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-sm text-white">
                                <option>Camarote</option><option>Bistrô</option><option>Lounge</option>
                              </select>
                            </div>
                            <div className="md:col-span-1">
                              <label className="block text-[10px] text-gray-400">Qtd</label>
                              <input type="number" min="1" value={setor.quantidade} onChange={e => atualizarSetor(setor.id, 'quantidade', e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-sm text-white" />
                            </div>
                            <div className="md:col-span-1">
                              <label className="block text-[10px] text-gray-400">Pessoas</label>
                              <input type="number" min="1" value={setor.capacidade} onChange={e => atualizarSetor(setor.id, 'capacidade', e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-sm text-white" />
                            </div>
                            <div className="md:col-span-1">
                              <label className="block text-[10px] text-purple-400 font-bold">Total (R$)</label>
                              <input type="number" value={setor.preco} onChange={e => atualizarSetor(setor.id, 'preco', e.target.value)} className="w-full bg-gray-900 border border-purple-500/50 rounded p-1 text-sm text-white" />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] text-blue-400 font-bold">Consumação (R$)</label>
                              <input type="number" value={setor.consumacao} onChange={e => atualizarSetor(setor.id, 'consumacao', e.target.value)} className="w-full bg-gray-900 border border-blue-500/50 rounded p-1 text-sm text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button disabled={isSubmitting} type="submit" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg shadow-lg transition">
                      {isSubmitting ? 'Gerando Lote...' : 'Publicar Evento e Mapa'}
                    </button>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {eventos.map(evento => (
                  <div key={evento.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-xl flex flex-col relative">
                    <button onClick={() => excluirEvento(evento.id)} className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-8 h-8 rounded-full z-10 font-bold shadow">✕</button>
                    <div className="h-32 relative">
                      <img src={evento.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800"} alt="Capa" className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                      <div className="absolute bottom-2 left-4">
                        <h3 className="font-bold text-xl text-white">{evento.nome}</h3>
                        <p className="text-purple-300 text-xs font-bold">{new Date(evento.data).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-900/80">
                      <button
                        onClick={() => setEventoSelecionado(evento)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-lg font-bold shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span>📊</span> Ver Relatório de Vendas
                      </button>
                    </div>
                  </div>
                ))}
                {eventos.length === 0 && <p className="text-gray-500 col-span-3 text-center">Nenhum evento criado.</p>}
              </div>
            </>
          ) : (

            // RELATÓRIO DO EVENTO ESPECÍFICO
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <button onClick={() => setEventoSelecionado(null)} className="text-gray-400 hover:text-white mb-6 font-bold">← Voltar aos Eventos</button>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => navigate('/catraca', { state: { eventoId: eventoSelecionado.id } })}
                  className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-bold text-sm shadow-lg"
                >
                  🚪 Abrir Portaria
                </button>
                <button
                  onClick={() => navigate('/bar', { state: { eventoId: eventoSelecionado.id } })}
                  className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-bold text-sm shadow-lg"
                >
                  🍸 Abrir Painel do Bar
                </button>
              </div>

              <div className="flex flex-col md:flex-row justify-between md:items-start mb-8 gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white">{eventoSelecionado.nome}</h2>
                  <p className="text-purple-400">Painel de Vendas / Portaria VIP</p>
                </div>
                <div className="md:text-right bg-gray-900 p-4 rounded-xl border border-gray-700">
                  <p className="text-sm text-gray-400">Total Arrecadado (Bilheteria)</p>
                  <p className="text-3xl font-bold text-green-400">
                    R$ {(
                      espacosRelatorio.filter(e => e.status === 'reservado').reduce((acc, e) => acc + e.preco, 0) +
                      ingressosRelatorio.reduce((acc, i) => acc + i.preco, 0)
                    ).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Ingressos Pista Vendidos</p>
                    <p className="text-3xl font-bold text-white">{ingressosRelatorio.length}</p>
                  </div>
                  <div className="text-4xl">🎟️</div>
                </div>
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest">Espaços VIP Vendidos</p>
                    <p className="text-3xl font-bold text-purple-400">
                      {espacosRelatorio.filter(e => e.status === 'reservado').length} <span className="text-sm text-gray-500">/ {espacosRelatorio.length}</span>
                    </p>
                  </div>
                  <div className="text-4xl">🍾</div>
                </div>
              </div>

              <h3 className="text-xl font-bold mb-4 border-l-4 border-purple-500 pl-3">Status dos Camarotes/Bistrôs</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {espacosRelatorio.map(espaco => (
                  <div key={espaco.id} className={`p-4 rounded-xl border flex flex-col justify-between ${
                    espaco.status === 'reservado' ? 'bg-purple-900/20 border-purple-500/50' : 'bg-gray-900 border-gray-700 opacity-70'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-bold text-lg">{espaco.sigla}</h4>
                      {espaco.status === 'reservado' ? (
                        <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Vendido</span>
                      ) : (
                        <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Livre</span>
                      )}
                    </div>

                    {espaco.status === 'reservado' ? (
                      <div className="bg-black/30 p-2 rounded text-sm">
                        <p className="text-gray-400 text-[10px] uppercase">Dono da Reserva:</p>
                        <p className="text-white font-bold truncate" title={espaco.donoNome}>{espaco.donoNome}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 font-semibold">R$ {espaco.preco.toFixed(2)}</p>
                    )}
                  </div>
                ))}
                {espacosRelatorio.length === 0 && <p className="text-gray-500 col-span-4">Nenhum espaço VIP cadastrado para este evento.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ABA 3: CARDÁPIO (Motor de Estoque Numérico) ================= */}
      {abaAtiva === 'cardapio' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in">
          <div className="xl:col-span-1 bg-gray-800 p-6 rounded-xl border border-gray-700 h-fit">
            <h2 className="text-xl font-bold mb-4 text-purple-400">Adicionar Bebida</h2>
            <form onSubmit={adicionarProduto} className="space-y-4">
              <input type="text" placeholder="Ex: Cerveja Heineken" required value={novoItem.nome} onChange={e => setNovoItem({...novoItem, nome: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white" />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 uppercase">Preço (R$)</label>
                  <input type="number" step="0.01" required value={novoItem.preco} onChange={e => setNovoItem({...novoItem, preco: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-green-400 font-bold uppercase">Qtd. Estoque Inicial</label>
                  <input type="number" required value={novoItem.estoque} onChange={e => setNovoItem({...novoItem, estoque: e.target.value})} className="w-full bg-gray-900 border border-green-500/50 rounded-lg p-2 text-white font-bold" />
                </div>
              </div>

              <div className="flex gap-2">
                <select value={novoItem.categoria} onChange={e => setNovoItem({...novoItem, categoria: e.target.value})} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white">
                  <option>Drinks</option><option>Combos</option><option>Cervejas</option><option>Sem Álcool</option>
                </select>
                <input type="text" placeholder="Ícone 🍸" value={novoItem.img} onChange={e => setNovoItem({...novoItem, img: e.target.value})} className="w-16 bg-gray-900 border border-gray-700 rounded-lg p-2 text-center" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold text-white shadow-lg transition active:scale-95">
                + Salvar no Cardápio
              </button>
            </form>
          </div>

          <div className="xl:col-span-2">
            <h2 className="text-xl font-bold mb-4 border-l-4 border-purple-500 pl-3">Estoque do Bar (Tempo Real)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {produtos.map(produto => {
                const semEstoque = produto.estoque === 0;
                const alertaEstoque = produto.estoque > 0 && produto.estoque <= 10;

                let bordaCor = 'border-gray-700';
                if (semEstoque) bordaCor = 'border-red-500/50 bg-red-900/10';
                else if (alertaEstoque) bordaCor = 'border-yellow-500/50 bg-yellow-900/10';

                return (
                  <div key={produto.id} className={`p-4 rounded-xl border flex flex-col justify-between transition-colors ${bordaCor} ${!semEstoque ? 'bg-gray-800' : ''}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`text-3xl bg-gray-900 p-2 rounded-lg ${semEstoque ? 'grayscale opacity-50' : ''}`}>{produto.img}</span>
                        <div>
                          <h4 className={`font-bold ${semEstoque ? 'text-gray-500 line-through' : 'text-white'}`}>{produto.nome}</h4>
                          <p className="text-purple-400 text-sm font-bold">R$ {produto.preco.toFixed(2)}</p>
                        </div>
                      </div>

                      {semEstoque ? (
                        <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Esgotado</span>
                      ) : alertaEstoque ? (
                        <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">Acabando</span>
                      ) : (
                        <span className="bg-green-500/20 text-green-500 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">OK</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-700/50 pt-3 mt-auto">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-bold uppercase">Qtd:</span>
                        <div className="flex items-center bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
                          <button onClick={() => ajustarEstoque(produto.id, produto.estoque, -1)} className="px-3 py-1 hover:bg-gray-700 text-gray-300 font-bold transition">-1</button>
                          <div className={`px-4 py-1 font-bold ${semEstoque ? 'text-red-500' : (alertaEstoque ? 'text-yellow-500' : 'text-white')}`}>
                            {produto.estoque}
                          </div>
                          <button onClick={() => ajustarEstoque(produto.id, produto.estoque, 1)} className="px-3 py-1 hover:bg-gray-700 text-gray-300 font-bold transition">+1</button>
                        </div>
                        <button onClick={() => ajustarEstoque(produto.id, produto.estoque, 12)} className="ml-1 text-[10px] bg-green-900/40 text-green-400 px-2 py-1 rounded hover:bg-green-800 transition hidden sm:block">
                          +12 (Fardo)
                        </button>
                      </div>
                      <button onClick={() => deletarProduto(produto.id)} className="text-red-500/50 hover:text-red-500 text-lg transition">🗑️</button>
                    </div>
                  </div>
                );
              })}
              {produtos.length === 0 && <p className="text-gray-500 col-span-2 text-center py-6">O cardápio está vazio.</p>}
            </div>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}