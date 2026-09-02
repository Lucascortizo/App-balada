import { useState, useEffect, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, updateDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase'; // Adicionado o 'auth' para pegarmos a Chave da API
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  Settings, CalendarDays, Wine, Plus, X, ArrowLeft, BarChart3, 
  Users, Ticket, Crown, Trash2, Box, PackageOpen, LayoutDashboard, 
  CircleDollarSign, CheckCircle2, Clock, ScanLine, 
  Edit3, UploadCloud, Search, ShieldCheck, Lock, Mail, User as UserIcon
} from 'lucide-react';

export default function Admin() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [abaAtiva, setAbaAtiva] = useState('eventos'); 
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ================= ESTADOS: CARDÁPIO =================
  const [produtos, setProdutos] = useState([]);
  const [modalProduto, setModalProduto] = useState({ aberto: false, modo: 'criar' });
  const [novoProduto, setNovoProduto] = useState({ 
    nome: '', preco: '', categoria: 'Drinks', descricao: '', imagem: '', estoque: 50, apenasVIP: false 
  });
  const [editandoProdutoId, setEditandoProdutoId] = useState(null);

  // ================= ESTADOS: EVENTOS =================
  const [eventos, setEventos] = useState([]);
  const [novoEvento, setNovoEvento] = useState({ 
    nome: '', data: '', local: '', linkImagem: '', descricao: '', regras: '', precoPista: '' 
  });
  const [setores, setSetores] = useState([{ id: 1, tipo: 'Camarote', quantidade: 4, preco: 2000, consumacao: 1500, capacidade: 10 }]);

  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [espacosRelatorio, setEspacosRelatorio] = useState([]);
  const [ingressosRelatorio, setIngressosRelatorio] = useState([]);
  const [pedidosRelatorio, setPedidosRelatorio] = useState([]); 
  const [editandoPreco, setEditandoPreco] = useState(false);
  const [inputPrecoPista, setInputPrecoPista] = useState('');

  // ================= ESTADOS: EQUIPE (RH) =================
  const [equipe, setEquipe] = useState([]);
  const [modoRh, setModoRh] = useState('buscar'); // 'buscar' ou 'criar'
  
  // Para buscar cliente existente
  const [emailBusca, setEmailBusca] = useState('');
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null);
  
  // Para criar conta do zero
  const [novoFunc, setNovoFunc] = useState({ nome: '', email: '', senha: '', role: 'garcom' });

  // ================= FUNÇÕES UTILITÁRIAS =================
  const processarImagem = (file, callback) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  };

  // ================= ESCUTADORES GLOBAIS =================
  useEffect(() => {
    const unsubCardapio = onSnapshot(collection(db, "cardapio"), snap => setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const unsubEventos = onSnapshot(collection(db, "eventos"), snap => {
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.data) - new Date(a.data)));
    });
    
    const unsubEquipe = onSnapshot(query(collection(db, "usuarios"), where("role", "in", ["admin", "garcom", "barman", "seguranca", "caixa"])), snap => {
      setEquipe(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubCardapio(); unsubEventos(); unsubEquipe(); };
  }, []);

  // ================= ESCUTADORES DO EVENTO =================
  useEffect(() => {
    if (!eventoSelecionado) return;

    const unsubEspacos = onSnapshot(query(collection(db, "espacos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      setEspacosRelatorio(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.sigla.localeCompare(b.sigla)));
    });

    const unsubIngressos = onSnapshot(query(collection(db, "ingressos_vendidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      setIngressosRelatorio(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      setPedidosRelatorio(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubEspacos(); unsubIngressos(); unsubPedidos(); };
  }, [eventoSelecionado]);

  // ================= FUNÇÕES DE EQUIPE (RH) =================
  const buscarUsuarioParaEquipe = async (e) => {
    e.preventDefault();
    if (!emailBusca) return;
    setIsSubmitting(true);
    try {
      const q = query(collection(db, "usuarios"), where("email", "==", emailBusca.toLowerCase().trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error("Nenhum usuário encontrado com este e-mail.");
        setUsuarioEncontrado(null);
      } else {
        setUsuarioEncontrado({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (error) { toast.error("Erro na busca."); }
    setIsSubmitting(false);
  };

  const alterarCargoUsuario = async (uid, novoCargo) => {
    try {
      await updateDoc(doc(db, "usuarios", uid), { role: novoCargo });
      toast.success(`Cargo atualizado para ${novoCargo.toUpperCase()}!`);
      if (usuarioEncontrado?.id === uid) setUsuarioEncontrado(null);
      setEmailBusca('');
    } catch (error) { toast.error("Erro ao alterar cargo."); }
  };

  // MÁGICA: Criar conta via REST API do Firebase para não deslogar o Admin
  const criarFuncionarioDireto = async (e) => {
    e.preventDefault();
    if (!novoFunc.nome || !novoFunc.email || !novoFunc.senha) return toast.error("Preencha todos os campos.");
    if (novoFunc.senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    
    setIsSubmitting(true);
    const tId = toast.loading("Criando conta no servidor...");
    
    try {
      // 1. Pega a Chave da API do Firebase do seu projeto automaticamente
      const apiKey = auth.app.options.apiKey;
      
      // 2. Chama o servidor do Google por debaixo dos panos para criar a conta silenciosamente
      const resposta = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: novoFunc.email.trim(),
          password: novoFunc.senha,
          returnSecureToken: false
        })
      });

      const dados = await resposta.json();

      if (dados.error) {
        if (dados.error.message === 'EMAIL_EXISTS') throw new Error("Este e-mail já está cadastrado.");
        throw new Error(dados.error.message);
      }

      // 3. Salva os dados do funcionário já promovido na tabela "usuarios"
      await setDoc(doc(db, "usuarios", dados.localId), {
        nome: novoFunc.nome,
        email: novoFunc.email.toLowerCase().trim(),
        role: novoFunc.role,
        criadoEm: new Date().toISOString(),
        criadoPorAdmin: true
      });

      toast.success("Conta criada e funcionário promovido!", { id: tId });
      setNovoFunc({ nome: '', email: '', senha: '', role: 'garcom' });
      setModoRh('buscar'); // Volta pra tela inicial de equipe

    } catch (error) {
      toast.error(error.message || "Erro ao criar funcionário.", { id: tId });
    }
    setIsSubmitting(false);
  };

  // ================= FUNÇÕES DE EVENTOS E DRE =================
  const salvarNovoPreco = async (eventoId) => {
    const valorNum = parseFloat(inputPrecoPista);
    if (isNaN(valorNum) || valorNum < 0) return toast.error("Digite um valor válido.");
    try { 
      await updateDoc(doc(db, "eventos", eventoId), { precoPista: valorNum }); 
      setEditandoPreco(false); 
      toast.success("Lote atualizado com sucesso!"); 
    } catch (error) { toast.error("Erro ao alterar o preço."); }
  };

  const cancelarReserva = async (espaco) => {
    if (window.confirm(`Cancelar a reserva de "${espaco.donoNome}" no ${espaco.sigla}? O espaço voltará a ficar livre.`)) {
      try { 
        await updateDoc(doc(db, "espacos", espaco.id), { status: "disponivel", donoId: null, donoNome: null, dataReserva: null, checkinFeito: false, checkinEm: null }); 
        toast.success("Reserva cancelada."); 
      } catch (error) { toast.error("Erro ao cancelar reserva."); }
    }
  };

  const cancelarIngresso = async (ingresso) => {
    if (window.confirm(`Cancelar ingresso Pista de "${ingresso.donoNome}"? O QR Code será invalidado.`)) {
      try { 
        await deleteDoc(doc(db, "ingressos_vendidos", ingresso.id)); 
        toast.success("Ingresso estornado."); 
      } catch (error) { toast.error("Erro ao estornar."); }
    }
  };

  const adicionarSetor = () => setSetores([...setores, { id: Date.now(), tipo: 'Camarote', quantidade: 1, preco: 0, consumacao: 0, capacidade: 10 }]);
  const atualizarSetor = (id, campo, valor) => setSetores(setores.map(s => s.id === id ? { ...s, [campo]: valor } : s));
  const removerSetor = (id) => setSetores(setores.filter(s => s.id !== id));

  const criarEvento = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const tId = toast.loading("Criando evento...");
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
      toast.success("Evento e lotes criados com sucesso!", { id: tId });
    } catch (error) { toast.error("Erro ao criar evento.", { id: tId }); } 
    finally { setIsSubmitting(false); }
  };

  const excluirEvento = async (id) => {
    if (window.confirm("Atenção: Excluir este evento apaga ele da vitrine, mas não exclui as vendas do banco. Continuar?")) {
      await deleteDoc(doc(db, "eventos", id));
      toast.success("Evento removido da vitrine.");
    }
  };

  // ================= FUNÇÕES DO CARDÁPIO =================
  const abrirModalCriarProduto = () => { 
    setNovoProduto({ nome: '', preco: '', categoria: 'Drinks', descricao: '', imagem: '', estoque: 50, apenasVIP: false }); 
    setEditandoProdutoId(null); setModalProduto({ aberto: true, modo: 'criar' }); 
  };

  const abrirModalEditarProduto = (produto) => { 
    setNovoProduto({ 
      nome: produto.nome, preco: produto.preco, estoque: produto.estoque, 
      categoria: produto.categoria || 'Drinks', descricao: produto.descricao || '', 
      imagem: produto.imagem || '', apenasVIP: produto.apenasVIP || false 
    }); 
    setEditandoProdutoId(produto.id); setModalProduto({ aberto: true, modo: 'editar' }); 
  };

  const fecharModalProduto = () => { 
    setModalProduto({ aberto: false, modo: 'criar' }); 
    setNovoProduto({ nome: '', preco: '', categoria: 'Drinks', descricao: '', imagem: '', estoque: 50, apenasVIP: false }); 
  };

  const salvarProduto = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const tId = toast.loading("Salvando produto...");
    try {
      const payload = { 
        nome: novoProduto.nome, preco: parseFloat(novoProduto.preco), estoque: parseInt(novoProduto.estoque), 
        categoria: novoProduto.categoria || 'Drinks', descricao: novoProduto.descricao || '', 
        imagem: novoProduto.imagem || '', apenasVIP: novoProduto.apenasVIP || false 
      };
      if (editandoProdutoId) await updateDoc(doc(db, "cardapio", editandoProdutoId), payload); 
      else await addDoc(collection(db, "cardapio"), payload); 
      
      fecharModalProduto(); toast.success("Cardápio atualizado!", { id: tId });
    } catch (error) { toast.error("Erro ao salvar produto.", { id: tId }); } 
    finally { setIsSubmitting(false); }
  };

  const apagarProduto = async (id) => {
    if (window.confirm('Excluir este produto do cardápio permanentemente?')) { 
      await deleteDoc(doc(db, "cardapio", id)); toast.success("Produto excluído."); 
    }
  };

  const ajustarEstoque = async (id, estoqueAtual, variacao) => { 
    await updateDoc(doc(db, "cardapio", id), { estoque: Math.max(0, estoqueAtual + variacao) }); 
  };

  // ================= SEGURANÇA RBAC NO PAINEL =================
  if (user?.role !== 'admin') return <Navigate to="/home" replace />;

  const eventoAtual = eventoSelecionado ? eventos.find(e => e.id === eventoSelecionado.id) : null;
  const totalBilheteria = espacosRelatorio.filter(e => e.status === 'reservado').reduce((acc, e) => acc + e.preco, 0) + 
                          ingressosRelatorio.reduce((acc, i) => acc + i.preco, 0);
  const totalBar = pedidosRelatorio.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalGeral = totalBilheteria + totalBar;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
      
      <header className="bg-white border-b border-zinc-200 px-6 py-6 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:justify-between xl:items-center gap-6">
          <div>
            <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-1">Painel do Diretor</p>
            <h1 className="text-3xl font-black text-zinc-900 tracking-tight leading-none flex items-center gap-3">
              <Settings className="w-8 h-8 text-indigo-600" /> Administração
            </h1>
          </div>
          
          <div className="flex flex-wrap bg-zinc-100 p-1.5 rounded-2xl w-full xl:w-auto shadow-inner gap-1">
            <button onClick={() => { setAbaAtiva('eventos'); setEventoSelecionado(null); }} className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all ${abaAtiva === 'eventos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              <CalendarDays className="w-4 h-4" /> Eventos
            </button>
            <button onClick={() => { setAbaAtiva('cardapio'); setEventoSelecionado(null); }} className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all ${abaAtiva === 'cardapio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              <Wine className="w-4 h-4" /> Cardápio
            </button>
            <button onClick={() => { setAbaAtiva('equipe'); setEventoSelecionado(null); }} className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs uppercase tracking-widest font-black transition-all ${abaAtiva === 'equipe' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>
              <ShieldCheck className="w-4 h-4" /> RH / Equipe
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto mt-4">
        
        {/* ================= ABA 1: EVENTOS E DRE ================= */}
        {abaAtiva === 'eventos' && (
          <div className="animate-fade-in">
            {!eventoAtual ? (
              <>
                <div className="flex justify-between items-center mb-8 border-b border-zinc-200 pb-4">
                  <h2 className="text-2xl font-black text-zinc-900">Eventos Ativos</h2>
                  <button onClick={() => setMostrarFormulario(!mostrarFormulario)} className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3 rounded-2xl font-black transition-transform active:scale-95 text-sm shadow-md flex items-center gap-2">
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
                          <input type="text" required value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Data e Hora</label>
                          <input type="datetime-local" required value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Local</label>
                          <input type="text" required value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold" />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Capa do Evento (Foto)</label>
                          <div className="relative flex items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-2xl hover:bg-zinc-50 transition overflow-hidden">
                            {novoEvento.linkImagem ? (
                              <img src={novoEvento.linkImagem} alt="Preview" className="w-full h-full object-cover opacity-60" />
                            ) : (
                              <div className="text-center absolute">
                                <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-2"/>
                                <p className="text-sm font-bold text-zinc-500">Clique para enviar imagem</p>
                              </div>
                            )}
                            <input type="file" accept="image/*" onChange={(e) => processarImagem(e.target.files[0], (url) => setNovoEvento({...novoEvento, linkImagem: url}))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Descrição</label>
                          <textarea rows="3" required value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold resize-none"></textarea>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Regras</label>
                          <textarea rows="2" required value={novoEvento.regras} onChange={e => setNovoEvento({...novoEvento, regras: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-zinc-900 font-bold resize-none"></textarea>
                        </div>

                        <div className="md:col-span-2 bg-indigo-50/50 border border-indigo-100 p-6 rounded-3xl">
                          <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Preço Inicial Ingresso Pista (R$)</label>
                          <input type="number" required value={novoEvento.precoPista} onChange={e => setNovoEvento({...novoEvento, precoPista: e.target.value})} className="w-full bg-white border border-indigo-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-indigo-700 font-black text-2xl shadow-sm" />
                        </div>
                      </div>

                      <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-200">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-200 pb-4">
                          <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest">Mapa de Setores VIP</h3>
                          <button type="button" onClick={adicionarSetor} className="bg-white border text-zinc-900 px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5">
                            <Plus className="w-4 h-4"/> Adicionar Setor
                          </button>
                        </div>
                        
                        <div className="space-y-4">
                          {setores.map(setor => (
                            <div key={setor.id} className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end bg-white p-5 rounded-[2rem] border shadow-sm relative group">
                              <button type="button" onClick={() => removerSetor(setor.id)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center"><X className="w-4 h-4" /></button>
                              
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-zinc-400 font-black uppercase mb-1">Tipo</label>
                                <select value={setor.tipo} onChange={e => atualizarSetor(setor.id, 'tipo', e.target.value)} className="w-full bg-zinc-50 border rounded-xl p-3 text-sm font-bold outline-none">
                                  <option>Camarote</option>
                                  <option>Bistrô</option>
                                </select>
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-zinc-400 font-black uppercase mb-1">Qtd</label>
                                <input type="number" min="1" value={setor.quantidade} onChange={e => atualizarSetor(setor.id, 'quantidade', e.target.value)} className="w-full bg-zinc-50 border rounded-xl p-3 text-sm font-bold outline-none" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-zinc-400 font-black uppercase mb-1">Pessoas</label>
                                <input type="number" min="1" value={setor.capacidade} onChange={e => atualizarSetor(setor.id, 'capacidade', e.target.value)} className="w-full bg-zinc-50 border rounded-xl p-3 text-sm font-bold outline-none" />
                              </div>
                              <div className="md:col-span-1">
                                <label className="block text-[10px] text-indigo-600 font-black uppercase mb-1">Venda</label>
                                <input type="number" value={setor.preco} onChange={e => atualizarSetor(setor.id, 'preco', e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm font-black text-indigo-700 outline-none" />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-[10px] text-emerald-600 font-black uppercase mb-1">Consumação</label>
                                <input type="number" value={setor.consumacao} onChange={e => atualizarSetor(setor.id, 'consumacao', e.target.value)} className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-black text-emerald-700 outline-none" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 text-white font-black text-lg py-5 rounded-[2rem] uppercase tracking-wider">
                        {isSubmitting ? 'Processando...' : 'Publicar Evento'}
                      </button>
                    </form>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {eventos.map(evento => (
                    <div key={evento.id} className="bg-white rounded-[2rem] overflow-hidden border shadow-sm flex flex-col relative group">
                      <button onClick={() => excluirEvento(evento.id)} className="absolute top-4 right-4 bg-white/90 text-red-500 w-10 h-10 rounded-full z-10 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="h-48 relative">
                        <img src={evento.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7"} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 to-transparent"></div>
                        <div className="absolute bottom-5 left-6">
                          <h3 className="font-black text-2xl text-white">{evento.nome}</h3>
                          <p className="text-indigo-300 text-[10px] font-bold uppercase">
                            <CalendarDays className="w-3 h-3 inline" /> {new Date(evento.data).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="p-5 bg-white">
                        <button onClick={() => setEventoSelecionado(evento)} className="w-full bg-zinc-900 text-white py-4 rounded-xl font-black flex justify-center gap-2">
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
              <div className="bg-white rounded-[2.5rem] p-6 md:p-10 border shadow-sm animate-fade-in">
                
                <button onClick={() => setEventoSelecionado(null)} className="text-zinc-500 font-black text-xs uppercase flex items-center gap-2 mb-8 hover:text-indigo-600 transition">
                  <span className="bg-zinc-100 p-2 rounded-full"><ArrowLeft className="w-4 h-4" /></span> Voltar
                </button>
                
                <div className="flex flex-col xl:flex-row justify-between xl:items-end mb-10 gap-6 border-b pb-8">
                  <div>
                    <h2 className="text-4xl font-black">{eventoAtual.nome}</h2>
                    <p className="text-indigo-600 font-bold uppercase text-xs mt-1">
                      <Clock className="w-3 h-3 inline" /> {new Date(eventoAtual.data).toLocaleString('pt-BR')}
                    </p>
                    <div className="flex gap-3 mt-8">
                      <button onClick={() => navigate('/catraca', { state: { eventoId: eventoAtual.id } })} className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-3.5 rounded-xl font-black text-xs transition">
                        <ScanLine className="w-4 h-4 inline" /> Portaria
                      </button>
                      <button onClick={() => navigate('/bar', { state: { eventoId: eventoAtual.id } })} className="bg-white border hover:bg-zinc-50 px-6 py-3.5 rounded-xl font-black text-xs transition">
                        <Wine className="w-4 h-4 inline" /> Barman
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-50 p-6 rounded-3xl border">
                    <p className="text-[10px] text-zinc-400 font-black uppercase mb-2">Preço Pista</p>
                    {editandoPreco ? (
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xl">R$</span>
                        <input type="number" value={inputPrecoPista} onChange={e => setInputPrecoPista(e.target.value)} className="border rounded-xl px-3 py-2 w-24 font-black text-xl outline-none focus:border-indigo-500" />
                        <button onClick={() => salvarNovoPreco(eventoAtual.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black transition">Salvar</button>
                        <button onClick={() => setEditandoPreco(false)} className="bg-zinc-200 hover:bg-zinc-300 text-zinc-500 px-3 py-2 rounded-xl transition"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-6">
                        <p className="text-3xl font-black text-emerald-600">R$ {(eventoAtual.precoPista||0).toFixed(2)}</p>
                        <button onClick={() => { setInputPrecoPista(eventoAtual.precoPista); setEditandoPreco(true); }} className="bg-white border px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:border-indigo-300 transition">Virar Lote</button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-2xl font-black mb-6"><BarChart3 className="w-6 h-6 text-indigo-600 inline" /> DRE</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
                  <div className="col-span-2 lg:col-span-4 bg-zinc-900 p-8 rounded-3xl border border-zinc-800 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                    <p className="text-[10px] text-zinc-400 font-black uppercase relative z-10">Faturamento Bruto Total</p>
                    <p className="text-5xl font-black text-white mt-1 relative z-10">R$ {totalGeral.toFixed(2)}</p>
                    <CircleDollarSign className="w-24 h-24 text-zinc-800 absolute right-8 top-1/2 -translate-y-1/2 hidden sm:block" />
                  </div>
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <p className="text-[10px] text-emerald-600 font-black uppercase">Bilheteria Total</p>
                    <p className="text-3xl font-black text-emerald-600 mt-1">R$ {totalBilheteria.toFixed(2)}</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-black uppercase">Receita do Bar</p>
                    <p className="text-3xl font-black text-blue-600 mt-1">R$ {totalBar.toFixed(2)}</p>
                  </div>
                  <div className="bg-zinc-50 p-6 rounded-3xl border flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-black uppercase">Ingressos</p>
                      <p className="text-3xl font-black">{ingressosRelatorio.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-zinc-300" />
                  </div>
                  <div className="bg-zinc-50 p-6 rounded-3xl border flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-black uppercase">VIP Vendidos</p>
                      <p className="text-3xl font-black text-indigo-600">{espacosRelatorio.filter(e => e.status === 'reservado').length} <span className="text-xl text-zinc-300">/ {espacosRelatorio.length}</span></p>
                    </div>
                    <Crown className="w-8 h-8 text-indigo-200" />
                  </div>
                </div>

                <h3 className="text-2xl font-black mb-6"><Crown className="w-6 h-6 text-indigo-600 inline" /> Mapa VIP</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5 mb-14">
                  {espacosRelatorio.map(espaco => (
                    <div key={espaco.id} className={`p-6 rounded-3xl border flex flex-col justify-between ${espaco.status === 'reservado' ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white'}`}>
                      <div className="flex justify-between mb-6">
                        <div>
                          <p className="text-[10px] text-zinc-400 font-black uppercase">{espaco.tipo}</p>
                          <h4 className="font-black text-3xl">{espaco.sigla}</h4>
                        </div>
                        {espaco.status === 'reservado' ? <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-md font-black uppercase">Vendido</span> : <span className="bg-zinc-100 text-zinc-500 text-[10px] px-3 py-1.5 rounded-md font-black uppercase">Livre</span>}
                      </div>
                      
                      {espaco.status === 'reservado' ? (
                        <div className="bg-white p-5 rounded-2xl border relative">
                          <button onClick={() => cancelarReserva(espaco)} className="absolute top-2 right-2 text-red-500 text-[10px] font-black uppercase hover:underline"><X className="w-3 h-3 inline"/> Estornar</button>
                          <p className="text-zinc-400 text-[10px] font-black uppercase">Titular</p>
                          <p className="font-black truncate pr-16">{espaco.donoNome}</p>
                          <div className={`mt-4 pt-4 border-t border-dashed text-[10px] font-black uppercase ${espaco.checkinFeito ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {espaco.checkinFeito ? <><CheckCircle2 className="w-3 h-3 inline"/> Na casa</> : <><Clock className="w-3 h-3 inline"/> Aguardando</>}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-zinc-50 p-5 rounded-2xl border">
                          <p className="text-[10px] text-zinc-400 font-black uppercase">Valor</p>
                          <p className="text-xl font-black">R$ {espaco.preco.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {espacosRelatorio.length === 0 && <p className="text-zinc-500 font-medium">Nenhum setor VIP cadastrado.</p>}
                </div>

                <h3 className="text-2xl font-black mb-6"><Users className="w-6 h-6 text-indigo-600 inline" /> Lista Pista</h3>
                <div className="bg-zinc-50 border rounded-3xl max-h-[400px] overflow-y-auto p-3">
                  {ingressosRelatorio.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Ticket className="w-10 h-10 text-zinc-300 mb-3" />
                      <p className="text-zinc-400 font-bold">Nenhum ingresso pista vendido ainda.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {ingressosRelatorio.map((ingresso, index) => (
                        <li key={ingresso.id} className="flex justify-between items-center bg-white hover:bg-zinc-50 p-4 rounded-2xl border transition">
                          <div className="flex items-center gap-5">
                            <span className="text-zinc-300 font-black text-xl w-8">#{index+1}</span>
                            <div>
                              <p className="font-black text-base">{ingresso.donoNome}</p>
                              <div className="flex gap-3 mt-1">
                                <span className="text-[10px] bg-zinc-100 px-2 py-1 rounded-md text-zinc-500 font-bold uppercase">{new Date(ingresso.dataCompra).toLocaleDateString()}</span>
                                <span className={`text-[10px] font-black uppercase ${ingresso.status === 'usado' ? 'text-zinc-400' : 'text-emerald-600'}`}>
                                  {ingresso.status === 'usado' ? 'Entrou' : 'Válido'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => cancelarIngresso(ingresso)} className="text-red-500 hover:bg-red-50 hover:text-red-600 bg-white border border-red-100 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition">
                            <Trash2 className="w-3 h-3 inline"/> Estornar
                          </button>
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
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-8 border-b border-zinc-200 pb-4">
              <h2 className="text-2xl font-black text-zinc-900 flex items-center gap-2"><Box className="w-6 h-6 text-indigo-600"/> Estoque em Tempo Real</h2>
              <button onClick={abrirModalCriarProduto} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black transition flex items-center gap-2 shadow-md">
                <Plus className="w-4 h-4" /> Nova Bebida
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {produtos.map(produto => (
                <div key={produto.id} className={`p-5 rounded-3xl border flex flex-col justify-between transition-all hover:shadow-md ${produto.estoque === 0 ? 'bg-zinc-50 opacity-60' : 'bg-white'}`}>
                  
                  <div className="flex items-start gap-4 mb-5 border-b pb-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-100 flex-shrink-0">
                      {produto.imagem ? <img src={produto.imagem} className="w-full h-full object-cover"/> : <Wine className="w-6 h-6 text-zinc-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="bg-zinc-100 text-zinc-500 text-[8px] px-2 py-0.5 rounded font-black uppercase mb-1 inline-block">{produto.categoria || 'Geral'}</span>
                      <h4 className="font-black truncate text-base leading-tight text-zinc-900">{produto.nome}</h4>
                      <p className="text-indigo-600 text-sm font-black mt-0.5">R$ {parseFloat(produto.preco).toFixed(2)}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-400 font-black uppercase">Estoque</span>
                      <div className="flex items-center bg-zinc-100 rounded-xl border border-zinc-200">
                        <button onClick={() => ajustarEstoque(produto.id, produto.estoque, -1)} className="w-10 h-8 font-black text-zinc-600 hover:bg-zinc-200 transition">-</button>
                        <div className="w-10 h-8 flex items-center justify-center font-black text-sm bg-white border-x border-zinc-200">{produto.estoque}</div>
                        <button onClick={() => ajustarEstoque(produto.id, produto.estoque, 1)} className="w-10 h-8 font-black text-zinc-600 hover:bg-zinc-200 transition">+</button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => abrirModalEditarProduto(produto)} className="bg-white border border-zinc-200 text-zinc-600 hover:text-indigo-600 py-2.5 rounded-xl font-bold text-xs transition">
                        <Edit3 className="w-3 h-3 inline mr-1"/> Editar
                      </button>
                      <button onClick={() => apagarProduto(produto.id)} className="bg-red-50 text-red-500 border border-red-100 hover:bg-red-500 hover:text-white py-2.5 rounded-xl font-bold text-xs transition">
                        <Trash2 className="w-3 h-3 inline mr-1"/> Excluir
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {produtos.length === 0 && (
                <div className="col-span-full text-center p-16 border border-dashed border-zinc-300 rounded-[2.5rem] bg-white">
                  <PackageOpen className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
                  <p className="text-zinc-800 font-black text-lg mb-1">O cardápio está vazio</p>
                  <p className="text-zinc-500 font-medium">Clique no botão acima para adicionar bebidas.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 3: EQUIPE E CARGOS ================= */}
        {abaAtiva === 'equipe' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* PAINEL DE ADIÇÃO DE FUNCIONÁRIO */}
            <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm h-fit">
              
              <div className="flex bg-zinc-100 p-1.5 rounded-2xl mb-8">
                <button onClick={() => setModoRh('buscar')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${modoRh === 'buscar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Promover Cliente</button>
                <button onClick={() => setModoRh('criar')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${modoRh === 'criar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>Criar Conta Nova</button>
              </div>

              {/* MODO 1: Buscar Cliente Existente */}
              {modoRh === 'buscar' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-black text-zinc-900 mb-2">Promover Usuário</h2>
                  <p className="text-sm text-zinc-500 font-medium mb-6">Digite o e-mail de um cliente para dar permissões na operação.</p>
                  
                  <form onSubmit={buscarUsuarioParaEquipe} className="flex gap-2 mb-6">
                    <input type="email" required placeholder="E-mail do cliente" value={emailBusca} onChange={e => setEmailBusca(e.target.value)} className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl px-4 py-3 font-bold text-zinc-900" />
                    <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 rounded-xl font-black flex items-center justify-center transition disabled:opacity-50"><Search className="w-5 h-5"/></button>
                  </form>

                  {usuarioEncontrado && (
                    <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl animate-slide-up">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-lg">{usuarioEncontrado.nome?.charAt(0) || '@'}</div>
                        <div>
                          <p className="font-black text-lg text-zinc-900 leading-none">{usuarioEncontrado.nome || 'Sem Nome'}</p>
                          <p className="text-xs text-indigo-600 font-bold mt-1">{usuarioEncontrado.email}</p>
                        </div>
                      </div>
                      
                      <p className="text-[10px] font-black uppercase text-zinc-500 mb-2 tracking-widest">Definir acesso ao sistema como:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'caixa')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-3 rounded-xl font-black text-xs text-zinc-700 transition">Caixa (PDV)</button>
                        <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'garcom')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-3 rounded-xl font-black text-xs text-zinc-700 transition">Garçom (Mesas)</button>
                        <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'barman')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-3 rounded-xl font-black text-xs text-zinc-700 transition">Barman (Cozinha)</button>
                        <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'seguranca')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-3 rounded-xl font-black text-xs text-zinc-700 transition">Segurança (Porta)</button>
                        <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'admin')} className="col-span-2 bg-zinc-900 hover:bg-black text-white py-3 rounded-xl font-black text-xs transition border border-zinc-800">Sócio (Admin)</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODO 2: Criar Conta Direto via API sem deslogar */}
              {modoRh === 'criar' && (
                <div className="animate-fade-in">
                  <h2 className="text-2xl font-black text-zinc-900 mb-2">Novo Funcionário</h2>
                  <p className="text-sm text-zinc-500 font-medium mb-6">Cria a conta do sistema e define o cargo imediatamente.</p>
                  
                  <form onSubmit={criarFuncionarioDireto} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 ml-1">Nome Completo</label>
                      <div className="relative">
                        <UserIcon className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input type="text" required value={novoFunc.nome} onChange={e => setNovoFunc({...novoFunc, nome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold text-sm" placeholder="Ex: João Silva" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 ml-1">E-mail Corporativo/Pessoal</label>
                      <div className="relative">
                        <Mail className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input type="email" required value={novoFunc.email} onChange={e => setNovoFunc({...novoFunc, email: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold text-sm" placeholder="joao@email.com" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 ml-1">Senha (Mínimo 6 caracteres)</label>
                      <div className="relative">
                        <Lock className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input type="password" required value={novoFunc.senha} onChange={e => setNovoFunc({...novoFunc, senha: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold text-sm" placeholder="••••••" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1 mt-4">Cargo Inicial</label>
                      <select value={novoFunc.role} onChange={e => setNovoFunc({...novoFunc, role: e.target.value})} className="w-full bg-white border border-zinc-200 outline-none rounded-xl p-3 text-zinc-900 font-bold text-sm shadow-sm cursor-pointer">
                        <option value="caixa">Caixa (Pagamentos)</option>
                        <option value="garcom">Garçom (Atende Mesas)</option>
                        <option value="barman">Barman (Produção KDS)</option>
                        <option value="seguranca">Segurança (Portaria)</option>
                        <option value="admin">Sócio (Administrador)</option>
                      </select>
                    </div>

                    <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-md transition-all mt-4 disabled:opacity-50 active:scale-95">
                      {isSubmitting ? 'Gerando Conta...' : 'Criar e Promover Funcionário'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* PAINEL DE EQUIPE ATIVA */}
            <div className="bg-white p-8 rounded-[2rem] border border-zinc-200 shadow-sm h-fit">
              <h2 className="text-2xl font-black text-zinc-900 mb-2">Equipe Ativa</h2>
              <p className="text-sm text-zinc-500 font-medium mb-8">Pessoas com permissões especiais no sistema.</p>
              
              <div className="space-y-3">
                {equipe.map(membro => {
                  let badgeCor = 'bg-zinc-100 text-zinc-600';
                  if (membro.role === 'admin') badgeCor = 'bg-indigo-100 text-indigo-700';
                  if (membro.role === 'barman') badgeCor = 'bg-orange-100 text-orange-700';
                  if (membro.role === 'garcom') badgeCor = 'bg-emerald-100 text-emerald-700';
                  if (membro.role === 'seguranca') badgeCor = 'bg-blue-100 text-blue-700';
                  if (membro.role === 'caixa') badgeCor = 'bg-pink-100 text-pink-700';

                  return (
                    <div key={membro.id} className="flex justify-between items-center bg-zinc-50 border border-zinc-100 p-4 rounded-2xl">
                      <div>
                        <p className="font-black text-sm text-zinc-900 flex items-center gap-2">
                          {membro.nome || 'Sem Nome'} 
                          {membro.criadoPorAdmin && <span className="bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest">Conta Empresa</span>}
                        </p>
                        <p className="text-xs text-zinc-400 font-bold">{membro.email}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${badgeCor}`}>{membro.role}</span>
                        {membro.role !== 'admin' && (
                          <button onClick={() => { if(window.confirm('Remover acesso? Ele voltará a ser cliente.')) alterarCargoUsuario(membro.id, 'cliente') }} className="text-red-400 hover:text-red-600 bg-white p-2 border rounded-lg transition" title="Demitir">
                            <Trash2 className="w-4 h-4"/>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ================= MODAL DE PRODUTO ================= */}
      {modalProduto.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-zinc-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2"><Box className="w-5 h-5 text-indigo-400"/> {modalProduto.modo === 'criar' ? 'Nova Bebida' : 'Editar Bebida'}</h2>
              <button onClick={fecharModalProduto} className="text-zinc-400 hover:text-white transition"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="form-produto" onSubmit={salvarProduto} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Foto da Bebida</label>
                  <div className="relative flex items-center justify-center w-full h-32 border-2 border-zinc-300 border-dashed rounded-2xl hover:bg-zinc-50 transition overflow-hidden">
                    {novoProduto.imagem ? (
                      <img src={novoProduto.imagem} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-center absolute">
                        <UploadCloud className="w-8 h-8 text-zinc-400 mx-auto mb-2"/>
                        <p className="text-sm font-bold text-zinc-500">Clique para enviar imagem</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={(e) => processarImagem(e.target.files[0], (url) => setNovoProduto({...novoProduto, imagem: url}))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 p-4 rounded-xl">
                  <input type="checkbox" id="vipToggle" checked={novoProduto.apenasVIP} onChange={e => setNovoProduto({...novoProduto, apenasVIP: e.target.checked})} className="w-5 h-5 accent-orange-600 rounded cursor-pointer" />
                  <label htmlFor="vipToggle" className="text-sm font-bold text-orange-900 cursor-pointer leading-tight">Exclusivo para Camarotes/Mesas <br/><span className="text-[10px] uppercase font-black tracking-widest text-orange-600">Proibir venda na Pista</span></label>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Nome do Produto *</label>
                  <input type="text" required value={novoProduto.nome} onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 text-zinc-900 font-bold transition" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Categoria (Aba no Cardápio) *</label>
                  <input type="text" list="categorias-admin" required value={novoProduto.categoria} onChange={e => setNovoProduto({...novoProduto, categoria: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 text-zinc-900 font-bold transition" />
                  <datalist id="categorias-admin">
                    <option value="Combos" /><option value="Doses" /><option value="Cervejas" /><option value="Sem Álcool" />
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Preço (R$) *</label>
                    <input type="number" step="0.01" required value={novoProduto.preco} onChange={e => setNovoProduto({...novoProduto, preco: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 text-zinc-900 font-bold transition" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Estoque Inicial *</label>
                    <input type="number" required value={novoProduto.estoque} onChange={e => setNovoProduto({...novoProduto, estoque: e.target.value})} className="w-full bg-emerald-50 border border-emerald-200 focus:border-emerald-500 outline-none rounded-xl p-3.5 text-emerald-700 font-black transition" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Descrição (Opcional)</label>
                  <textarea placeholder="Ex: Acompanha gelo e copos." rows="2" value={novoProduto.descricao} onChange={e => setNovoProduto({...novoProduto, descricao: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 text-zinc-700 font-medium transition text-sm resize-none"></textarea>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex gap-3">
              <button type="button" onClick={fecharModalProduto} className="flex-1 bg-white border border-zinc-200 text-zinc-600 font-bold py-4 rounded-xl transition shadow-sm hover:bg-zinc-100">Cancelar</button>
              <button type="submit" form="form-produto" disabled={isSubmitting} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-md transition active:scale-95 flex justify-center items-center gap-2 disabled:opacity-50">
                {isSubmitting ? 'Salvando...' : 'Salvar Bebida'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}