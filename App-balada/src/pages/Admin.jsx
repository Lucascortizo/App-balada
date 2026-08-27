import { useState, useEffect, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';
import { 
  Settings, CalendarDays, Wine, Plus, X, ArrowLeft, BarChart3, 
  Users, Ticket, Crown, Trash2, Box, PackageOpen, LayoutDashboard, 
  DollarSign, CircleDollarSign, CheckCircle2, Clock
} from 'lucide-react';

export default function Admin() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [abaAtiva, setAbaAtiva] = useState('eventos');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ================= ESTADOS: CARDÁPIO E ESTOQUE =================
  const [produtos, setProdutos] = useState([]);
  const [novoItem, setNovoItem] = useState({ nome: '', preco: '', categoria: 'Drinks', img: '', estoque: 50 });

  // ================= ESTADOS: EVENTOS =================
  const [eventos, setEventos] = useState([]);
  const [novoEvento, setNovoEvento] = useState({ 
    nome: '', data: '', local: '', linkImagem: '', descricao: '', regras: '', precoPista: '' 
  });
  const [setores, setSetores] = useState([{ id: 1, tipo: 'Camarote', quantidade: 4, preco: 2000, consumacao: 1500, capacidade: 10 }]);

  // ================= ESTADOS: RELATÓRIO INDIVIDUAL =================
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [espacosRelatorio, setEspacosRelatorio] = useState([]);
  const [ingressosRelatorio, setIngressosRelatorio] = useState([]);
  const [pedidosRelatorio, setPedidosRelatorio] = useState([]); 
  const [editandoPreco, setEditandoPreco] = useState(false);
  const [inputPrecoPista, setInputPrecoPista] = useState('');

  // ================= ESCUTADORES GLOBAIS =================
  useEffect(() => {
    const unsubCardapio = onSnapshot(collection(db, "cardapio"), (snapshot) => {
      setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEventos = onSnapshot(collection(db, "eventos"), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => new Date(b.data) - new Date(a.data));
      setEventos(lista);
    });

    return () => { unsubCardapio(); unsubEventos(); };
  }, []);

  // ================= ESCUTADOR DO EVENTO ESPECÍFICO =================
  useEffect(() => {
    if (!eventoSelecionado) return;

    const unsubEspacos = onSnapshot(query(collection(db, "espacos"), where("eventoId", "==", eventoSelecionado.id)), (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => a.sigla.localeCompare(b.sigla));
      setEspacosRelatorio(lista);
    });

    const unsubIngressos = onSnapshot(query(collection(db, "ingressos_vendidos"), where("eventoId", "==", eventoSelecionado.id)), (snapshot) => {
      setIngressosRelatorio(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("eventoId", "==", eventoSelecionado.id)), (snapshot) => {
      setPedidosRelatorio(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubEspacos(); unsubIngressos(); unsubPedidos(); };
  }, [eventoSelecionado]);

  // ================= FUNÇÕES DE AÇÃO =================
  const salvarNovoPreco = async (eventoId) => {
    const valorNum = parseFloat(inputPrecoPista);
    if (isNaN(valorNum) || valorNum < 0) return alert("Digite um valor válido.");
    
    try {
      await updateDoc(doc(db, "eventos", eventoId), { precoPista: valorNum });
      setEditandoPreco(false);
      alert("Lote atualizado com sucesso!");
    } catch (error) { alert("Erro ao alterar o preço."); }
  };

  const cancelarReserva = async (espaco) => {
    if (window.confirm(`Cancelar a reserva de "${espaco.donoNome}" no ${espaco.sigla}? O espaço voltará a ficar disponível.`)) {
      try {
        await updateDoc(doc(db, "espacos", espaco.id), { status: "disponivel", donoId: null, donoNome: null, dataReserva: null, checkinFeito: false, checkinEm: null });
      } catch (error) { alert("Erro ao cancelar reserva."); }
    }
  };

  const cancelarIngresso = async (ingresso) => {
    if (window.confirm(`Cancelar ingresso Pista de "${ingresso.donoNome}"? O QR Code será invalidado.`)) {
      try { await deleteDoc(doc(db, "ingressos_vendidos", ingresso.id)); } catch (error) { alert("Erro ao cancelar ingresso."); }
    }
  };

  const adicionarProduto = async (e) => {
    e.preventDefault();
    if (!novoItem.nome || !novoItem.preco) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "cardapio"), { ...novoItem, preco: parseFloat(novoItem.preco), estoque: parseInt(novoItem.estoque) });
      setNovoItem({ nome: '', preco: '', categoria: 'Drinks', img: '', estoque: 50 });
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const deletarProduto = async (id) => {
    if (window.confirm('Excluir produto do cardápio permanentemente?')) await deleteDoc(doc(db, "cardapio", id));
  };

  const ajustarEstoque = async (id, estoqueAtual, variacao) => {
    await updateDoc(doc(db, "cardapio", id), { estoque: Math.max(0, estoqueAtual + variacao) });
  };

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
            eventoId: eventoRef.id, nome: `${setor.tipo} ${letra}${numeroAtual}`, sigla: `${letra}${numeroAtual}`,
            tipo: setor.tipo, preco: parseFloat(setor.preco || 0), consumacao: parseFloat(setor.consumacao || 0),
            capacidade: parseInt(setor.capacidade || 1), status: "disponivel"
          });
        }
        contagemPrefixos[letra] = numeroAtual;
      });

      await batch.commit();
      setNovoEvento({ nome: '', data: '', local: '', linkImagem: '', descricao: '', regras: '', precoPista: '' });
      setMostrarFormulario(false);
      alert("Evento e lotes criados com sucesso!");
    } catch (error) { alert("Erro ao criar evento."); } finally { setIsSubmitting(false); }
  };

  const excluirEvento = async (id) => {
    if (window.confirm("Atenção: Excluir este evento apaga ele da vitrine, mas não exclui as vendas do banco. Continuar?")) {
      await deleteDoc(doc(db, "eventos", id));
    }
  };

  // ================= SEGURANÇA E CÁLCULOS =================
  if (!user?.isAdmin && user?.email !== 'seuemail@teste.com') {
     return <Navigate to="/home" replace />;
  }

  const eventoAtual = eventoSelecionado ? eventos.find(e => e.id === eventoSelecionado.id) : null;
  const totalBilheteria = espacosRelatorio.filter(e => e.status === 'reservado').reduce((acc, e) => acc + e.preco, 0) + ingressosRelatorio.reduce((acc, i) => acc + i.preco, 0);
  const totalBar = pedidosRelatorio.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalGeral = totalBilheteria + totalBar;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
      
      <header className="bg-white border-b border-zinc-200 px-6 py-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-6">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">Painel de Controle</p>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight leading-none flex items-center gap-3">
              <Settings className="w-8 h-8 text-indigo-600" /> Administração
            </h1>
          </div>
          
          <div className="flex bg-zinc-100 p-1.5 rounded-2xl w-full md:w-auto shadow-inner">
            <button 
              onClick={() => { setAbaAtiva('eventos'); setEventoSelecionado(null); }} 
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all ${abaAtiva === 'eventos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <CalendarDays className="w-4 h-4" /> Eventos
            </button>
            <button 
              onClick={() => { setAbaAtiva('cardapio'); setEventoSelecionado(null); }} 
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all ${abaAtiva === 'cardapio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
            >
              <Wine className="w-4 h-4" /> Bar & Estoque
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto mt-4">
        
        {/* ================= ABA 1: EVENTOS E RELATÓRIOS ================= */}
        {abaAtiva === 'eventos' && (
          <div className="animate-fade-in">
            {!eventoAtual ? (
              <>
                <div className="flex justify-between items-center mb-8 border-b border-zinc-200 pb-4">
                  <h2 className="text-2xl font-black text-zinc-900">Eventos Ativos</h2>
                  <button 
                    onClick={() => setMostrarFormulario(!mostrarFormulario)} 
                    className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-2xl font-black transition-transform active:scale-95 text-sm shadow-md flex items-center gap-2"
                  >
                    {mostrarFormulario ? <><X className="w-4 h-4" /> Fechar</> : <><Plus className="w-4 h-4" /> Novo Evento</>}
                  </button>
                </div>

                {mostrarFormulario && (
                  <div className="bg-white p-8 rounded-[2.5rem] border border-zinc-200 mb-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                    <h2 className="text-2xl font-black text-zinc-900 mb-8 border-b border-zinc-100 pb-4">Criar Nova Festa</h2>
                    
                    <form onSubmit={criarEvento} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Nome da Festa</label>
                          <input type="text" placeholder="Ex: Baile do DJ Silva" required value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition" />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Data e Hora</label>
                          <input type="datetime-local" required value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition" />
                        </div>
                        
                        <div>
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Local da Festa</label>
                          <input type="text" placeholder="Ex: Neon Club Principal" required value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition" />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Link do Banner (URL da Imagem)</label>
                          <input type="url" placeholder="https://..." value={novoEvento.linkImagem} onChange={e => setNovoEvento({...novoEvento, linkImagem: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition" />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Descrição Completa</label>
                          <textarea rows="3" required placeholder="Line-up, atrações, promoções..." value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition"></textarea>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Regras da Casa</label>
                          <textarea rows="2" required placeholder="Obrigatório doc. +18, etc." value={novoEvento.regras} onChange={e => setNovoEvento({...novoEvento, regras: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition"></textarea>
                        </div>

                        <div className="md:col-span-2 bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl">
                          <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Preço Inicial Ingresso Pista (R$)</label>
                          <input type="number" required value={novoEvento.precoPista} onChange={e => setNovoEvento({...novoEvento, precoPista: e.target.value})} className="w-full bg-white border border-indigo-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-indigo-700 font-black text-2xl transition shadow-sm" />
                        </div>
                      </div>

                      <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-200 pb-4">
                          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Mapa de Setores VIP</h3>
                          <button type="button" onClick={adicionarSetor} className="bg-white border border-zinc-200 text-zinc-900 hover:bg-zinc-100 px-4 py-2.5 rounded-xl text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5"><Plus className="w-4 h-4"/> Adicionar Setor</button>
                        </div>
                        
                        <div className="space-y-4">
                          {setores.map(setor => (
                            <div key={setor.id} className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end bg-white p-5 rounded-[2rem] border border-zinc-200 shadow-sm relative group">
                              <button type="button" onClick={() => removerSetor(setor.id)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white w-8 h-8 rounded-full font-black shadow-sm transition flex items-center justify-center"><X className="w-4 h-4" /></button>
                              
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-zinc-400 font-black uppercase mb-1 tracking-widest">Tipo</label>
                                <select value={setor.tipo} onChange={e => atualizarSetor(setor.id, 'tipo', e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm font-bold text-zinc-700 outline-none focus:border-indigo-500">
                                  <option>Camarote</option><option>Bistrô</option><option>Lounge</option>
                                </select>
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-zinc-400 font-black uppercase mb-1 tracking-widest">Unidades</label>
                                <input type="number" min="1" value={setor.quantidade} onChange={e => atualizarSetor(setor.id, 'quantidade', e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm font-bold text-zinc-700 outline-none focus:border-indigo-500" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-zinc-400 font-black uppercase mb-1 tracking-widest">Pessoas</label>
                                <input type="number" min="1" value={setor.capacidade} onChange={e => atualizarSetor(setor.id, 'capacidade', e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm font-bold text-zinc-700 outline-none focus:border-indigo-500" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-indigo-600 font-black uppercase mb-1 tracking-widest">Venda (R$)</label>
                                <input type="number" value={setor.preco} onChange={e => atualizarSetor(setor.id, 'preco', e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm font-black text-indigo-700 outline-none focus:border-indigo-500" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[10px] text-emerald-600 font-black uppercase mb-1 tracking-widest">Consumação (R$)</label>
                                <input type="number" value={setor.consumacao} onChange={e => atualizarSetor(setor.id, 'consumacao', e.target.value)} className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-black text-emerald-700 outline-none focus:border-emerald-500" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg py-5 rounded-[2rem] shadow-[0_8px_20px_rgba(79,70,229,0.3)] transition active:scale-95 uppercase tracking-wider disabled:opacity-70">
                        {isSubmitting ? 'Processando...' : 'Publicar Evento'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {eventos.map(evento => (
                    <div key={evento.id} className="bg-white rounded-[2rem] overflow-hidden border border-zinc-200 shadow-sm flex flex-col relative group hover:shadow-xl transition-all duration-300">
                      <button onClick={() => excluirEvento(evento.id)} className="absolute top-4 right-4 bg-white/90 backdrop-blur-md hover:bg-red-500 text-red-500 hover:text-white w-10 h-10 rounded-full z-10 font-bold shadow-md transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="h-48 relative">
                        <img src={evento.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7"} alt="Capa" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-zinc-900/20 to-transparent"></div>
                        <div className="absolute bottom-5 left-6">
                          <h3 className="font-black text-2xl text-white leading-tight drop-shadow-md mb-1">{evento.nome}</h3>
                          <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"><CalendarDays className="w-3 h-3" /> {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="p-5 bg-white">
                        <button onClick={() => setEventoSelecionado(evento)} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-xl font-black transition-all active:scale-95 flex items-center justify-center gap-2">
                          <LayoutDashboard className="w-4 h-4" /> Acessar Dashboard
                        </button>
                      </div>
                    </div>
                  ))}
                  {eventos.length === 0 && (
                    <div className="col-span-full text-center p-16 bg-white border border-dashed border-zinc-300 rounded-[2rem]">
                      <PackageOpen className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                      <p className="text-zinc-500 font-bold text-lg">Nenhum evento criado.</p>
                      <p className="text-zinc-400">O sistema está aguardando a primeira festa.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border border-zinc-200 shadow-sm animate-fade-in">
                <button onClick={() => setEventoSelecionado(null)} className="text-zinc-500 hover:text-indigo-600 mb-8 font-black text-xs uppercase tracking-widest transition-colors flex items-center gap-2 active:scale-95 w-fit">
                  <span className="bg-zinc-100 p-2 rounded-full"><ArrowLeft className="w-4 h-4" /></span> Voltar para a lista
                </button>

                <div className="flex flex-col xl:flex-row justify-between xl:items-end mb-10 gap-6 border-b border-zinc-100 pb-8">
                  <div>
                    <h2 className="text-4xl font-black text-zinc-900 tracking-tight leading-none mb-2">{eventoAtual.nome}</h2>
                    <p className="text-indigo-600 font-bold uppercase tracking-widest text-xs flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(eventoAtual.data).toLocaleString('pt-BR')}</p>
                    
                    <div className="flex flex-wrap gap-3 mt-8">
                      <button onClick={() => navigate('/catraca', { state: { eventoId: eventoAtual.id } })} className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3.5 rounded-xl font-black text-xs shadow-md transition active:scale-95 flex items-center gap-2">
                        <ScanLine className="w-4 h-4" /> Portaria / Catraca
                      </button>
                      <button onClick={() => navigate('/bar', { state: { eventoId: eventoAtual.id } })} className="bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-6 py-3.5 rounded-xl font-black text-xs shadow-sm transition active:scale-95 flex items-center gap-2">
                        <Wine className="w-4 h-4" /> Painel Garçons
                      </button>
                    </div>
                  </div>

                  <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 flex flex-col justify-center min-w-[280px]">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black mb-2 flex items-center gap-1.5"><Ticket className="w-3 h-3"/> Preço Atual Pista</p>
                    {editandoPreco ? (
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-900 font-black text-xl">R$</span>
                        <input type="number" value={inputPrecoPista} onChange={e => setInputPrecoPista(e.target.value)} className="bg-white border border-indigo-300 focus:border-indigo-500 rounded-xl px-3 py-2 text-zinc-900 w-24 font-black text-xl outline-none shadow-sm" />
                        <button onClick={() => salvarNovoPreco(eventoAtual.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition-colors">Salvar</button>
                        <button onClick={() => setEditandoPreco(false)} className="bg-zinc-200 hover:bg-zinc-300 text-zinc-500 px-3 py-2 rounded-xl text-xs font-black transition-colors"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-3xl font-black text-emerald-600">R$ {eventoAtual.precoPista.toFixed(2)}</p>
                        <button onClick={() => { setInputPrecoPista(eventoAtual.precoPista); setEditandoPreco(true); }} className="bg-white border border-zinc-200 text-indigo-600 hover:border-indigo-200 px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black shadow-sm transition">Virar Lote</button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-2xl font-black text-zinc-900 mb-6 tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6 text-indigo-600" /> DRE e Conversão</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
                  <div className="col-span-2 lg:col-span-4 bg-zinc-900 p-8 rounded-3xl border border-zinc-800 flex justify-between items-center shadow-[0_8px_30px_rgba(0,0,0,0.1)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                    <div className="relative z-10">
                      <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1 flex items-center gap-2"><DollarSign className="w-3 h-3"/> Faturamento Bruto Total</p>
                      <p className="text-5xl font-black text-white tracking-tight leading-none">R$ {totalGeral.toFixed(2)}</p>
                    </div>
                    <CircleDollarSign className="w-24 h-24 text-zinc-800 relative z-10 hidden sm:block" />
                  </div>
                  
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-sm">
                    <p className="text-[10px] text-emerald-600/70 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"><Ticket className="w-3 h-3"/> Bilheteria Total</p>
                    <p className="text-3xl font-black text-emerald-600">R$ {totalBilheteria.toFixed(2)}</p>
                  </div>
                  
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 shadow-sm">
                    <p className="text-[10px] text-blue-600/70 font-black uppercase tracking-widest mb-1 flex items-center gap-1.5"><Wine className="w-3 h-3"/> Receita do Bar</p>
                    <p className="text-3xl font-black text-blue-600">R$ {totalBar.toFixed(2)}</p>
                  </div>
                  
                  <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-1">Ingressos Pista</p>
                      <p className="text-3xl font-black text-zinc-900">{ingressosRelatorio.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-zinc-300" />
                  </div>
                  
                  <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-1">Mesas / VIP</p>
                      <p className="text-3xl font-black text-indigo-600">{espacosRelatorio.filter(e => e.status === 'reservado').length} <span className="text-xl text-zinc-300">/ {espacosRelatorio.length}</span></p>
                    </div>
                    <Crown className="w-8 h-8 text-indigo-200" />
                  </div>
                </div>

                <h3 className="text-2xl font-black text-zinc-900 mb-6 tracking-tight flex items-center gap-2"><Crown className="w-6 h-6 text-indigo-600" /> Mapa VIP</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 mb-14">
                  {espacosRelatorio.map(espaco => (
                    <div key={espaco.id} className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${espaco.status === 'reservado' ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-zinc-200'}`}>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-0.5">{espaco.tipo}</p>
                          <h4 className="font-black text-3xl text-zinc-900 leading-none">{espaco.sigla}</h4>
                        </div>
                        {espaco.status === 'reservado' ? <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-md font-black uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Vendido</span> : <span className="bg-zinc-100 text-zinc-500 text-[10px] px-3 py-1.5 rounded-md font-black uppercase tracking-widest">Livre</span>}
                      </div>

                      {espaco.status === 'reservado' ? (
                        <div className="bg-white p-5 rounded-2xl border border-indigo-100 relative shadow-sm">
                          <button onClick={() => cancelarReserva(espaco)} className="absolute top-2 right-2 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white px-2 py-1.5 rounded-lg transition text-[10px] font-black uppercase tracking-widest flex items-center gap-1" title="Estornar e Liberar"><X className="w-3 h-3"/> Estornar</button>
                          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1">Titular</p>
                          <p className="text-zinc-900 font-black truncate pr-20 text-base" title={espaco.donoNome}>{espaco.donoNome}</p>
                          <div className={`mt-4 pt-4 border-t border-dashed border-zinc-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${espaco.checkinFeito ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {espaco.checkinFeito ? <><CheckCircle2 className="w-3 h-3"/> Na casa</> : <><Clock className="w-3 h-3"/> Aguardando</>}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-50 p-5 rounded-2xl border border-zinc-200">
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-1">Valor</p>
                          <p className="text-xl text-zinc-900 font-black leading-none">R$ {espaco.preco.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {espacosRelatorio.length === 0 && <p className="text-zinc-500 font-medium col-span-full">Nenhum setor VIP cadastrado no mapa.</p>}
                </div>

                <h3 className="text-2xl font-black text-zinc-900 mb-6 tracking-tight flex items-center gap-2"><Users className="w-6 h-6 text-indigo-600" /> Lista Pista</h3>
                <div className="bg-zinc-50 border border-zinc-200 shadow-inner rounded-3xl max-h-[400px] overflow-y-auto p-3">
                  {ingressosRelatorio.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Ticket className="w-10 h-10 text-zinc-300 mb-3" />
                      <p className="text-zinc-400 font-bold">Nenhum ingresso pista vendido ainda.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {ingressosRelatorio.map((ingresso, index) => (
                        <li key={ingresso.id} className="flex justify-between items-center bg-white hover:bg-zinc-50 p-4 rounded-2xl transition border border-zinc-100 shadow-sm">
                          <div className="flex items-center gap-5">
                            <span className="text-zinc-300 font-black text-xl w-8">#{index+1}</span>
                            <div>
                              <p className="font-black text-zinc-900 text-base">{ingresso.donoNome}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] bg-zinc-100 px-2 py-1 rounded-md text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1"><CalendarDays className="w-3 h-3"/> {new Date(ingresso.dataCompra).toLocaleDateString()}</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${ingresso.status === 'usado' ? 'text-zinc-400' : 'text-emerald-600'}`}>
                                  {ingresso.status === 'usado' ? <><CheckCircle2 className="w-3 h-3"/> Entrou</> : <><Clock className="w-3 h-3"/> Válido</>}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => cancelarIngresso(ingresso)} className="text-red-500 hover:text-white hover:bg-red-500 bg-white border border-red-100 px-4 py-2.5 rounded-xl text-xs font-black transition shadow-sm uppercase tracking-widest flex items-center gap-1.5"><Trash2 className="w-3 h-3"/> Estornar</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= ABA 2: CARDÁPIO E ESTOQUE ================= */}
        {abaAtiva === 'cardapio' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fade-in">
            <div className="xl:col-span-1 bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.04)] h-fit">
              <h2 className="text-2xl font-black text-zinc-900 mb-8 border-b border-zinc-100 pb-4 tracking-tight flex items-center gap-2"><Plus className="w-6 h-6 text-indigo-600"/> Nova Bebida</h2>
              <form onSubmit={adicionarProduto} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Nome do Produto</label>
                  <input type="text" placeholder="Ex: Cerveja Heineken" required value={novoItem.nome} onChange={e => setNovoItem({...novoItem, nome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Preço (R$)</label>
                    <input type="number" step="0.01" required value={novoItem.preco} onChange={e => setNovoItem({...novoItem, preco: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold transition" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Estoque Inicial</label>
                    <input type="number" required value={novoItem.estoque} onChange={e => setNovoItem({...novoItem, estoque: e.target.value})} className="w-full bg-emerald-50 border border-emerald-200 focus:border-emerald-500 outline-none rounded-2xl p-4 text-emerald-700 font-black transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Categoria</label>
                  <select value={novoItem.categoria} onChange={e => setNovoItem({...novoItem, categoria: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 outline-none rounded-2xl p-4 text-zinc-700 font-bold">
                    <option>Drinks</option><option>Combos</option><option>Cervejas</option><option>Sem Álcool</option>
                  </select>
                </div>
                <button disabled={isSubmitting} type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 py-5 rounded-2xl font-black text-white shadow-lg transition active:scale-95 uppercase tracking-wider mt-4 flex justify-center items-center gap-2">
                  <Box className="w-5 h-5"/> Adicionar ao Bar
                </button>
              </form>
            </div>

            <div className="xl:col-span-2">
              <h2 className="text-2xl font-black text-zinc-900 mb-8 tracking-tight flex items-center gap-2"><Box className="w-6 h-6 text-indigo-600"/> Estoque em Tempo Real</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {produtos.map(produto => {
                  const semEstoque = produto.estoque === 0;
                  const alertaEstoque = produto.estoque > 0 && produto.estoque <= 10;
                  let cardStyle = 'bg-white border-zinc-200 shadow-sm';
                  if (semEstoque) cardStyle = 'bg-zinc-50 border-zinc-200 opacity-60';
                  else if (alertaEstoque) cardStyle = 'bg-orange-50 border-orange-200 shadow-sm';

                  return (
                    <div key={produto.id} className={`p-6 rounded-3xl border flex flex-col justify-between transition-all ${cardStyle}`}>
                      <div className="flex justify-between items-start mb-6 border-b border-zinc-100 pb-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 bg-white shadow-sm rounded-2xl flex items-center justify-center text-zinc-400 ${semEstoque ? 'grayscale opacity-50' : ''}`}>
                            <Wine className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className={`font-black text-xl leading-none mb-1 ${semEstoque ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>{produto.nome}</h4>
                            <p className="text-indigo-600 text-sm font-black">R$ {produto.preco.toFixed(2)}</p>
                          </div>
                        </div>
                        {semEstoque ? <span className="bg-zinc-200 text-zinc-500 text-[10px] px-3 py-1.5 rounded-md font-black uppercase tracking-widest">Esgotado</span> : alertaEstoque ? <span className="bg-orange-200 text-orange-700 text-[10px] px-3 py-1.5 rounded-md font-black uppercase tracking-widest">Acabando</span> : <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-md font-black uppercase tracking-widest">Normal</span>}
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Qtd.</span>
                          <div className="flex items-center bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
                            <button onClick={() => ajustarEstoque(produto.id, produto.estoque, -1)} className="px-4 py-2 hover:bg-zinc-200 text-zinc-600 font-black transition text-lg">-</button>
                            <div className={`px-4 py-2 font-black text-base bg-white border-x border-zinc-200 w-12 text-center ${semEstoque ? 'text-zinc-400' : (alertaEstoque ? 'text-orange-500' : 'text-zinc-900')}`}>{produto.estoque}</div>
                            <button onClick={() => ajustarEstoque(produto.id, produto.estoque, 1)} className="px-4 py-2 hover:bg-zinc-200 text-zinc-600 font-black transition text-lg">+</button>
                          </div>
                          <button onClick={() => ajustarEstoque(produto.id, produto.estoque, 12)} className="ml-2 text-[10px] font-black uppercase tracking-widest bg-white border border-zinc-200 text-zinc-600 px-3 py-2.5 rounded-xl shadow-sm hover:bg-zinc-50 transition active:scale-95 hidden sm:block">+ Fardo</button>
                        </div>
                        <button onClick={() => deletarProduto(produto.id)} className="text-red-400 hover:text-white hover:bg-red-500 bg-white border border-red-100 w-11 h-11 rounded-full flex items-center justify-center transition shadow-sm active:scale-95"><Trash2 className="w-5 h-5"/></button>
                      </div>
                    </div>
                  );
                })}
                {produtos.length === 0 && (
                  <div className="col-span-2 text-center p-16 border border-dashed border-zinc-300 rounded-[2.5rem] bg-white">
                    <PackageOpen className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-800 font-black text-lg mb-1">O cardápio está vazio</p>
                    <p className="text-zinc-500 font-medium">Adicione as bebidas no formulário ao lado.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}