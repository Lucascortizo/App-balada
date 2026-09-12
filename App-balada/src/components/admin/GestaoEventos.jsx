import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';
import Cropper from 'react-easy-crop';
import { 
  Plus, X, BarChart3, Users, Ticket, Crown, Trash2, PackageOpen, LayoutDashboard, 
  CircleDollarSign, CheckCircle2, Clock, Map as MapIcon, AlertTriangle, Receipt, Crop, 
  CalendarDays, Settings, Info, Image as ImageIcon, FileText, ArrowLeft, Wine
} from 'lucide-react';

export default function GestaoEventos() {
  const [eventos, setEventos] = useState([]);
  const [eventoSelecionado, setEventoSelecionado] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ================= ESTADOS DO RECORTADOR =================
  const [modalCrop, setModalCrop] = useState({ aberto: false, fotoUrl: null });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);

  // ================= ESTADOS DO NOVO EVENTO =================
  const [novoEvento, setNovoEvento] = useState({ 
    nome: '', data: '', local: '', linkImagem: '', linkMapa: '', descricao: '', regras: '',
    vendaIngressosOnline: true,
    vendaCamarotesOnline: true
  });
  
  const [ingressosForm, setIngressosForm] = useState([
    { id: Date.now(), nome: 'Pista', tipoPreco: 'unico', preco: 50, precoMasc: 0, precoFem: 0, consumacao: 0 }
  ]);
  
  const [setores, setSetores] = useState([
    { id: 1, tipo: 'Camarote', nomePersonalizado: '', quantidade: 4, preco: 2000, consumacao: 1500, capacidade: 10 }
  ]);

  // ================= ESTADOS DO DASHBOARD =================
  const [espacosRelatorio, setEspacosRelatorio] = useState([]);
  const [ingressosRelatorio, setIngressosRelatorio] = useState([]);
  const [pedidosRelatorio, setPedidosRelatorio] = useState([]); 
  const [modalExclusao, setModalExclusao] = useState({ aberto: false, evento: null, textoConfirmacao: '' });
  const [editandoIngresso, setEditandoIngresso] = useState(null);

  // ================= EFEITOS =================
  useEffect(() => {
    const unsubEventos = onSnapshot(collection(db, "eventos"), snap => {
      const evts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEventos(evts.sort((a, b) => new Date(b.data) - new Date(a.data)));
    });
    return () => unsubEventos();
  }, []);

  useEffect(() => {
    if (!eventoSelecionado) return;
    
    const unsubEspacos = onSnapshot(query(collection(db, "espacos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      const esp = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEspacosRelatorio(esp.sort((a, b) => a.sigla.localeCompare(b.sigla)));
    });
    
    const unsubIngressos = onSnapshot(query(collection(db, "ingressos_vendidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      setIngressosRelatorio(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const unsubPedidos = onSnapshot(query(collection(db, "pedidos"), where("eventoId", "==", eventoSelecionado.id)), snap => {
      const ped = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPedidosRelatorio(ped.sort((a, b) => new Date(b.data) - new Date(a.data)));
    });
    
    return () => { unsubEspacos(); unsubIngressos(); unsubPedidos(); };
  }, [eventoSelecionado]);

  // ================= UPLOAD E CORTE DE IMAGEM =================
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

  const aoEscolherCapaDoEvento = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.readAsDataURL(e.target.files[0]);
      reader.onload = (evt) => {
        setModalCrop({ aberto: true, fotoUrl: evt.target.result });
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
    }
  };

  const confirmarRecorte = async () => {
    try {
      const image = new Image();
      image.src = modalCrop.fotoUrl;
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = cropPixels.width;
        canvas.height = cropPixels.height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(
          image,
          cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
          0, 0, cropPixels.width, cropPixels.height
        );
        
        const MAX_WIDTH = 1000;
        let base64Image = '';
        if (canvas.width > MAX_WIDTH) {
          const scale = MAX_WIDTH / canvas.width;
          const canvasReduzido = document.createElement('canvas');
          canvasReduzido.width = MAX_WIDTH;
          canvasReduzido.height = canvas.height * scale;
          const ctxReduzido = canvasReduzido.getContext('2d');
          ctxReduzido.drawImage(canvas, 0, 0, canvasReduzido.width, canvasReduzido.height);
          base64Image = canvasReduzido.toDataURL('image/jpeg', 0.8);
        } else {
          base64Image = canvas.toDataURL('image/jpeg', 0.8);
        }
        
        setNovoEvento({...novoEvento, linkImagem: base64Image});
        setModalCrop({ aberto: false, fotoUrl: null });
      };
    } catch (e) {
      toast.error("Erro ao recortar imagem.");
    }
  };

  // ================= FORMULÁRIO DINÂMICO =================
  const adicionarIngressoForm = () => {
    setIngressosForm([...ingressosForm, { id: Date.now(), nome: 'Nova Área', tipoPreco: 'unico', preco: 0, precoMasc: 0, precoFem: 0, consumacao: 0 }]);
  };
  
  const removerIngressoForm = (id) => {
    setIngressosForm(ingressosForm.filter(i => i.id !== id));
  };
  
  const atualizarIngressoForm = (id, campo, valor) => {
    setIngressosForm(ingressosForm.map(i => i.id === id ? { ...i, [campo]: valor } : i));
  };

  const adicionarSetor = () => {
    setSetores([...setores, { id: Date.now(), tipo: 'Camarote', nomePersonalizado: '', quantidade: 1, preco: 0, consumacao: 0, capacidade: 10 }]);
  };
  
  const atualizarSetor = (id, campo, valor) => {
    setSetores(setores.map(s => s.id === id ? { ...s, [campo]: valor } : s));
  };
  
  const removerSetor = (id) => {
    setSetores(setores.filter(s => s.id !== id));
  };

  const criarEvento = async (e) => {
    e.preventDefault();
    const dataEscolhida = new Date(novoEvento.data);
    const agora = new Date();
    
    if (dataEscolhida < agora) {
      return toast.error("Você não pode criar um evento no passado!");
    }

    setIsSubmitting(true);
    const tId = toast.loading("Criando evento...");
    
    try {
      const ingressosProcessados = ingressosForm.map(i => ({ 
          id: i.id.toString(), 
          nome: i.nome, 
          tipoPreco: i.tipoPreco, 
          preco: Number(i.preco) || 0, 
          precoMasc: Number(i.precoMasc) || 0, 
          precoFem: Number(i.precoFem) || 0, 
          consumacao: Number(i.consumacao) || 0 
      }));
      
      const payloadEvento = { 
        ...novoEvento, 
        ingressos: ingressosProcessados, 
        criadoEm: new Date().toISOString(), 
        status: 'ativo',
        vendaPortaria: true,
      };
      
      const eventoRef = await addDoc(collection(db, "eventos"), payloadEvento);
      
      if (novoEvento.vendaCamarotesOnline) {
        const batch = writeBatch(db);
        const contagemPrefixos = {};
        
        setores.forEach(setor => {
          const nomeRealDoSetor = setor.tipo === 'Outro' ? (setor.nomePersonalizado || 'Setor VIP') : setor.tipo;
          const letra = nomeRealDoSetor.charAt(0).toUpperCase();
          let numeroAtual = contagemPrefixos[letra] || 0;
          
          for (let i = 1; i <= parseInt(setor.quantidade); i++) {
            numeroAtual++;
            const espacoRef = doc(collection(db, "espacos"));
            batch.set(espacoRef, { 
              eventoId: eventoRef.id, 
              nome: `${nomeRealDoSetor} ${letra}${numeroAtual}`, 
              sigla: `${letra}${numeroAtual}`, 
              tipo: nomeRealDoSetor, 
              preco: parseFloat(setor.preco || 0), 
              consumacao: parseFloat(setor.consumacao || 0), 
              capacidade: parseInt(setor.capacidade || 1), 
              status: "disponivel" 
            });
          }
          contagemPrefixos[letra] = numeroAtual;
        });
        
        await batch.commit();
      }
      
      // Reseta os estados após sucesso
      setNovoEvento({ nome: '', data: '', local: '', linkImagem: '', linkMapa: '', descricao: '', regras: '', vendaIngressosOnline: true, vendaCamarotesOnline: true });
      setIngressosForm([{ id: Date.now(), nome: 'Pista', tipoPreco: 'unico', preco: 50, precoMasc: 0, precoFem: 0, consumacao: 0 }]);
      setSetores([{ id: 1, tipo: 'Camarote', nomePersonalizado: '', quantidade: 4, preco: 2000, consumacao: 1500, capacidade: 10 }]);
      setMostrarFormulario(false);
      
      toast.success("Evento criado com sucesso!", { id: tId });
    } catch (error) { 
      toast.error("Erro ao criar evento.", { id: tId }); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // ================= AÇÕES DO DASHBOARD =================
  const confirmarExclusaoSegura = async () => {
    if (modalExclusao.textoConfirmacao !== 'CONFIRMAR') {
      return toast.error('Digite CONFIRMAR para autorizar a exclusão.');
    }
    try { 
      await deleteDoc(doc(db, "eventos", modalExclusao.evento.id)); 
      toast.success("Evento removido com sucesso."); 
      setModalExclusao({ aberto: false, evento: null, textoConfirmacao: '' }); 
    } catch (e) { 
      toast.error("Erro ao apagar evento."); 
    }
  };

  const cancelarReserva = async (espaco) => {
    if (window.confirm(`Cancelar a reserva de "${espaco.donoNome}" no ${espaco.sigla}?`)) {
      try { 
        await updateDoc(doc(db, "espacos", espaco.id), { 
          status: "disponivel", donoId: null, donoNome: null, dataReserva: null, checkinFeito: false, checkinEm: null 
        }); 
        toast.success("Reserva cancelada."); 
      } catch (error) { 
        toast.error("Erro."); 
      }
    }
  };

  const cancelarIngresso = async (ingresso) => {
    if (window.confirm(`Cancelar ingresso de "${ingresso.donoNome}"?`)) {
      try { 
        await deleteDoc(doc(db, "ingressos_vendidos", ingresso.id)); 
        toast.success("Ingresso estornado."); 
      } catch (error) { 
        toast.error("Erro."); 
      }
    }
  };

  const salvarEdicaoLote = async (eventoId) => {
    const eventoReferencia = eventos.find(e => e.id === eventoId);
    let ingressosExistentes = eventoReferencia.ingressos || [];
    
    const novaLista = ingressosExistentes.map(i => i.id === editandoIngresso.id ? { 
      ...i, 
      preco: Number(editandoIngresso.preco), 
      precoMasc: Number(editandoIngresso.precoMasc), 
      precoFem: Number(editandoIngresso.precoFem),
      consumacao: Number(editandoIngresso.consumacao) || 0
    } : i);
    
    try { 
      await updateDoc(doc(db, "eventos", eventoId), { ingressos: novaLista }); 
      setEditandoIngresso(null); 
      toast.success("Lote alterado!"); 
    } catch (e) { 
      toast.error("Erro ao virar o lote."); 
    }
  };

  // ================= ESTILOS DARK MODE =================
  const inputClass = "w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none rounded-xl px-4 py-3 text-sm font-bold text-white transition-all";
  const labelClass = "block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2";

  // ================= TELA 1: DASHBOARD DO EVENTO =================
  if (eventoSelecionado) {
    const eventoAtual = eventos.find(e => e.id === eventoSelecionado.id);
    const ingressosDoDashboard = eventoAtual?.ingressos || [];
    
    // Matemática à prova de falhas (Evita Crash de NaN)
    const totalBilheteria = espacosRelatorio
      .filter(e => e.status === 'reservado')
      .reduce((acc, e) => acc + (Number(e.preco) || 0), 0) 
      + ingressosRelatorio.reduce((acc, i) => acc + (Number(i.preco) || 0), 0);
      
    const totalBar = pedidosRelatorio.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    const totalGeral = totalBilheteria + totalBar;

    return (
      <div className="bg-zinc-950 rounded-[2.5rem] p-6 md:p-10 border border-zinc-800 shadow-2xl animate-fade-in">
        <button onClick={() => setEventoSelecionado(null)} className="text-zinc-500 font-black text-xs uppercase flex items-center gap-2 mb-8 hover:text-white transition">
          <span className="bg-zinc-900 border border-zinc-800 p-2 rounded-full"><ArrowLeft className="w-4 h-4" /></span> Voltar
        </button>
        
        <div className="flex flex-col xl:flex-row justify-between xl:items-end mb-10 gap-6 border-b border-zinc-900 pb-8">
          <div>
            <h2 className="text-4xl font-black text-white">{eventoAtual?.nome}</h2>
            <p className="text-indigo-500 font-bold uppercase text-xs mt-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {eventoAtual?.data ? new Date(eventoAtual.data).toLocaleString('pt-BR') : ''}
            </p>
          </div>
          
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 flex-1 xl:max-w-md max-h-56 overflow-y-auto">
              <p className="text-[10px] text-zinc-500 font-black uppercase mb-3 sticky top-0 bg-zinc-900 z-10">Lotes de Ingressos</p>
              <p className="text-[10px] text-zinc-600 font-bold mb-3">Esses lotes ficam disponíveis para a portaria mesmo quando a venda online estiver desligada.</p>
              <div className="space-y-3">
                {ingressosDoDashboard.map(ing => (
                  <div key={ing.id} className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                    {editandoIngresso?.id === ing.id ? (
                      <div className="flex-1 space-y-2">
                        <p className="text-[10px] font-black uppercase text-indigo-500">{ing.nome}</p>
                        {ing.tipoPreco === 'unico' ? (
                          <input type="number" placeholder="Preço" value={editandoIngresso.preco} onChange={e => setEditandoIngresso({...editandoIngresso, preco: e.target.value})} className="w-full bg-zinc-800 text-white border-zinc-700 rounded px-3 py-2 font-black text-sm outline-none focus:border-indigo-500" />
                        ) : (
                          <div className="flex gap-2">
                            <input type="number" placeholder="Fem" value={editandoIngresso.precoFem} onChange={e => setEditandoIngresso({...editandoIngresso, precoFem: e.target.value})} className="w-1/2 bg-zinc-800 text-pink-400 border-zinc-700 rounded px-3 py-2 font-black text-sm outline-none focus:border-pink-500" />
                            <input type="number" placeholder="Masc" value={editandoIngresso.precoMasc} onChange={e => setEditandoIngresso({...editandoIngresso, precoMasc: e.target.value})} className="w-1/2 bg-zinc-800 text-blue-400 border-zinc-700 rounded px-3 py-2 font-black text-sm outline-none focus:border-blue-500" />
                          </div>
                        )}
                        <input type="number" placeholder="Consumação Bônus" value={editandoIngresso.consumacao || ''} onChange={e => setEditandoIngresso({...editandoIngresso, consumacao: e.target.value})} className="w-full bg-emerald-950 text-emerald-400 border-emerald-900 rounded px-3 py-2 font-black text-sm outline-none focus:border-emerald-500" />
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => salvarEdicaoLote(eventoAtual.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-black transition">Salvar</button>
                          <button onClick={() => setEditandoIngresso(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-xs font-black transition">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-black text-white text-sm">{ing.nome}</p>
                          <p className="text-xs font-bold text-zinc-400 mb-1">
                            {ing.tipoPreco === 'unico' ? `R$ ${(Number(ing.preco) || 0).toFixed(2)}` : `Masc: R$ ${(Number(ing.precoMasc) || 0).toFixed(2)} | Fem: R$ ${(Number(ing.precoFem) || 0).toFixed(2)}`}
                          </p>
                          {Number(ing.consumacao) > 0 && <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">Bônus: R$ {Number(ing.consumacao).toFixed(2)}</span>}
                        </div>
                        <button onClick={() => setEditandoIngresso(ing)} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-white transition">Editar lote</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
        </div>

        <h3 className="text-2xl font-black mb-6 text-white"><BarChart3 className="w-6 h-6 text-indigo-500 inline mr-2" /> DRE</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
          <div className="col-span-2 lg:col-span-4 bg-zinc-900 p-8 rounded-3xl border border-zinc-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <p className="text-[10px] text-zinc-500 font-black uppercase relative z-10">Faturamento Bruto Total</p>
            <p className="text-5xl font-black text-white mt-1 relative z-10">R$ {totalGeral.toFixed(2)}</p>
            <CircleDollarSign className="w-24 h-24 text-zinc-800 absolute right-8 top-1/2 -translate-y-1/2 hidden sm:block" />
          </div>
          <div className="bg-emerald-950/30 p-6 rounded-3xl border border-emerald-900/50">
            <p className="text-[10px] text-emerald-500 font-black uppercase">Bilheteria Total</p>
            <p className="text-3xl font-black text-emerald-400 mt-1">R$ {totalBilheteria.toFixed(2)}</p>
          </div>
          <div className="bg-blue-950/30 p-6 rounded-3xl border border-blue-900/50">
            <p className="text-[10px] text-blue-500 font-black uppercase">Receita do Bar</p>
            <p className="text-3xl font-black text-blue-400 mt-1">R$ {totalBar.toFixed(2)}</p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-zinc-500 font-black uppercase">Ingressos</p>
              <p className="text-3xl font-black text-white">{ingressosRelatorio.length}</p>
            </div>
            <Users className="w-8 h-8 text-zinc-700" />
          </div>
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 flex justify-between items-center">
            <div>
              <p className="text-[10px] text-zinc-500 font-black uppercase">VIP Vendidos</p>
              <p className="text-3xl font-black text-indigo-400">{espacosRelatorio.filter(e => e.status === 'reservado').length} <span className="text-xl text-zinc-700"> / {espacosRelatorio.length}</span></p>
            </div>
            <Crown className="w-8 h-8 text-indigo-900" />
          </div>
        </div>

        <h3 className="text-2xl font-black mb-6 text-white"><Receipt className="w-6 h-6 text-indigo-500 inline mr-2" /> Histórico do Bar</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] max-h-[500px] overflow-y-auto p-4 mb-14 shadow-inner">
          {pedidosRelatorio.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Wine className="w-12 h-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500 font-bold text-lg">Nenhum pedido realizado ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosRelatorio.map((pedido) => (
                <div key={pedido.id} className="bg-zinc-950 p-5 rounded-3xl border border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-zinc-800 text-zinc-400 font-black text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-md">#{pedido.id.slice(-6).toUpperCase()}</span>
                      <span className="text-xs font-bold text-zinc-500">{new Date(pedido.data).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="font-black text-lg text-white leading-tight mb-1">{pedido.clienteNome}</p>
                    <p className="text-sm font-bold text-zinc-400">{pedido.itens.map(i => `${i.quantidade}x ${i.nome}`).join(', ')}</p>
                    {pedido.mesaSigla && <p className="text-xs font-black uppercase text-indigo-400 mt-2 bg-indigo-500/10 inline-block px-2 py-1 rounded border border-indigo-500/20">Mesa: {pedido.mesaSigla}</p>}
                  </div>
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 border-zinc-800 pt-4 md:pt-0 gap-2 min-w-[120px]">
                    <p className="font-black text-2xl text-white">R$ {(Number(pedido.total) || 0).toFixed(2)}</p>
                    {pedido.status === 'pendente' && <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg w-full text-center">Pendente</span>}
                    {pedido.status === 'preparando' && <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg w-full text-center">Preparando</span>}
                    {pedido.status === 'pronto' && <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg w-full text-center">Pronto</span>}
                    {pedido.status === 'entregue' && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg w-full text-center">Entregue</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <h3 className="text-2xl font-black mb-6 text-white"><Crown className="w-6 h-6 text-indigo-500 inline mr-2" /> Mapa VIP</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-14">
          {espacosRelatorio.map(espaco => (
            <div key={espaco.id} className={`p-6 rounded-3xl border flex flex-col justify-between ${espaco.status === 'reservado' ? 'bg-indigo-950/20 border-indigo-500/30' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex justify-between mb-6">
                <div>
                  <p className="text-[10px] text-zinc-500 font-black uppercase">{espaco.tipo}</p>
                  <h4 className="font-black text-3xl text-white">{espaco.sigla}</h4>
                </div>
                {espaco.status === 'reservado' ? (
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-3 py-1.5 rounded-md font-black uppercase">Vendido</span>
                ) : (
                  <span className="bg-zinc-800 text-zinc-400 text-[10px] px-3 py-1.5 rounded-md font-black uppercase">Livre</span>
                )}
              </div>
              {espaco.status === 'reservado' ? (
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 shadow-sm relative">
                  <button onClick={() => cancelarReserva(espaco)} className="absolute top-2 right-2 text-red-400 text-[10px] font-black uppercase hover:underline"><X className="w-3 h-3 inline"/> Estornar</button>
                  <p className="text-zinc-500 text-[10px] font-black uppercase">Titular</p>
                  <p className="font-black truncate pr-16 text-white">{espaco.donoNome}</p>
                  <div className={`mt-4 pt-4 border-t border-zinc-800 border-dashed text-[10px] font-black uppercase ${espaco.checkinFeito ? 'text-emerald-400' : 'text-amber-500'}`}>
                    {espaco.checkinFeito ? <><CheckCircle2 className="w-3 h-3 inline"/> Na casa</> : <><Clock className="w-3 h-3 inline"/> Aguardando</>}
                  </div>
                </div>
              ) : (
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800">
                  <p className="text-[10px] text-zinc-500 font-black uppercase">Valor</p>
                  <p className="text-xl font-black text-white">R$ {(Number(espaco.preco)||0).toFixed(2)}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <h3 className="text-2xl font-black mb-6 text-white"><Users className="w-6 h-6 text-indigo-500 inline mr-2" /> Lista Pista</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-h-[400px] overflow-y-auto p-3 shadow-inner">
          {ingressosRelatorio.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Ticket className="w-10 h-10 text-zinc-700 mb-3" />
              <p className="text-zinc-500 font-bold">Nenhum ingresso pista vendido.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {ingressosRelatorio.map((ingresso, index) => (
                <li key={ingresso.id} className="flex justify-between items-center bg-zinc-950 hover:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-800 shadow-sm transition">
                  <div className="flex items-center gap-5">
                    <span className="text-zinc-600 font-black text-xl w-8">#{index+1}</span>
                    <div>
                      <p className="font-black text-base text-white">{ingresso.donoNome}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] bg-zinc-800 px-2 py-1 rounded-md text-zinc-400 font-bold uppercase">{new Date(ingresso.dataCompra).toLocaleDateString()}</span>
                        <span className={`text-[10px] font-black uppercase ${ingresso.status === 'usado' ? 'text-zinc-500' : 'text-emerald-400'}`}>{ingresso.status === 'usado' ? 'Entrou' : 'Válido'}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => cancelarIngresso(ingresso)} className="text-red-400 hover:bg-red-500/10 hover:text-red-500 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-black uppercase transition"><Trash2 className="w-3 h-3 inline"/> Estornar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ================= TELA 2: LISTA DE EVENTOS E CRIAÇÃO =================
  return (
    <div className="animate-fade-in text-zinc-50">
      <div className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-4 hidden md:flex">
        <h2 className="text-3xl font-black text-white">Gestão de Eventos</h2>
        <button onClick={() => setMostrarFormulario(!mostrarFormulario)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black transition-transform active:scale-95 text-sm shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center gap-2">
          {mostrarFormulario ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Evento</>}
        </button>
      </div>

      <button onClick={() => setMostrarFormulario(!mostrarFormulario)} className="md:hidden w-full mb-8 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-4 rounded-2xl font-black transition-transform active:scale-95 text-sm shadow-md flex justify-center items-center gap-2">
        {mostrarFormulario ? <><X className="w-4 h-4" /> Cancelar</> : <><Plus className="w-4 h-4" /> Novo Evento</>}
      </button>

      {mostrarFormulario && (
        <div className="mb-10 space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-t-[2rem] p-8 text-white shadow-lg border border-indigo-500/20">
            <h2 className="text-3xl font-black mb-2">Criar Nova Festa</h2>
            <p className="text-indigo-300 font-medium">Configure os detalhes e as regras de venda do evento.</p>
          </div>
          
          <form onSubmit={criarEvento} className="space-y-6 -mt-10 relative z-10 px-4 md:px-0">
            
            {/* Bloco de Configurações */}
            <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-zinc-800 shadow-xl">
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 border-b border-zinc-800 pb-4">
                <Settings className="w-5 h-5 text-indigo-500" /> Configurações do App
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-5 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <div>
                    <h4 className="font-black text-white text-sm">Vender Ingressos no App</h4>
                    <p className="text-xs text-zinc-500 font-medium mt-1">O toggle controla apenas a venda online. A portaria sempre usa estes lotes.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setNovoEvento({...novoEvento, vendaIngressosOnline: !novoEvento.vendaIngressosOnline})}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${novoEvento.vendaIngressosOnline ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${novoEvento.vendaIngressosOnline ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-5 bg-zinc-950 border border-zinc-800 rounded-2xl">
                  <div>
                    <h4 className="font-black text-white text-sm">Vender Camarotes no App</h4>
                    <p className="text-xs text-zinc-500 font-medium mt-1">Mapa VIP e Lounges.</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setNovoEvento({...novoEvento, vendaCamarotesOnline: !novoEvento.vendaCamarotesOnline})}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${novoEvento.vendaCamarotesOnline ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${novoEvento.vendaCamarotesOnline ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Bloco Informações Básicas */}
            <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-zinc-800 shadow-xl">
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 border-b border-zinc-800 pb-4">
                <Info className="w-5 h-5 text-indigo-500" /> Informações Básicas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome da Festa</label>
                  <input type="text" required value={novoEvento.nome} onChange={e => setNovoEvento({...novoEvento, nome: e.target.value})} className={inputClass} placeholder="Ex: Baile do Havaí" />
                </div>
                <div>
                  <label className={labelClass}>Data e Hora</label>
                  <input type="datetime-local" required max="2099-12-31T23:59" value={novoEvento.data} onChange={e => setNovoEvento({...novoEvento, data: e.target.value})} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Localização</label>
                  <input type="text" required value={novoEvento.local} onChange={e => setNovoEvento({...novoEvento, local: e.target.value})} className={inputClass} placeholder="Ex: Club 88" />
                </div>
              </div>
            </div>

            {/* Bloco de Imagens */}
            <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-zinc-800 shadow-xl">
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 border-b border-zinc-800 pb-4">
                <ImageIcon className="w-5 h-5 text-indigo-500" /> Identidade Visual
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>Capa Principal (App)</label>
                  {novoEvento.linkImagem ? (
                    <div className="relative flex items-center justify-center w-full h-40 rounded-2xl overflow-hidden border border-zinc-700 group">
                      <img src={novoEvento.linkImagem} className="w-full h-full object-cover" alt="Capa" />
                      <button type="button" onClick={() => setNovoEvento({...novoEvento, linkImagem: ''})} className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ) : (
                    <div className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-zinc-700 border-dashed rounded-2xl bg-zinc-950 hover:bg-zinc-800 transition overflow-hidden">
                      <Crop className="w-8 h-8 text-zinc-500 mb-2"/>
                      <p className="text-sm font-black text-zinc-400">Clique para enviar capa</p>
                      <input type="file" accept="image/*" onChange={aoEscolherCapaDoEvento} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Mapa do Evento (Opcional)</label>
                  <div className="relative flex items-center justify-center w-full h-40 bg-zinc-950 border-2 border-zinc-700 border-dashed rounded-2xl hover:bg-zinc-800 transition overflow-hidden">
                    {novoEvento.linkMapa ? (
                      <>
                        <img src={novoEvento.linkMapa} alt="Mapa" className="w-full h-full object-contain p-2" />
                        <button type="button" onClick={() => setNovoEvento({...novoEvento, linkMapa: ''})} className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full transition"><Trash2 className="w-4 h-4"/></button>
                      </>
                    ) : (
                      <div className="text-center flex flex-col items-center pointer-events-none">
                        <MapIcon className="w-8 h-8 text-zinc-600 mb-2"/>
                        <p className="text-sm font-bold text-zinc-500">Enviar Planta/Mapa</p>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={(e) => processarImagem(e.target.files[0], (url) => setNovoEvento({...novoEvento, linkMapa: url}))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco Detalhes */}
            <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-zinc-800 shadow-xl">
              <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 border-b border-zinc-800 pb-4">
                <FileText className="w-5 h-5 text-indigo-500" /> Descrição e Regras
              </h3>
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>Descrição do Evento</label>
                  <textarea rows="3" value={novoEvento.descricao} onChange={e => setNovoEvento({...novoEvento, descricao: e.target.value})} className={`${inputClass} resize-none`} placeholder="Atrações, horários..."></textarea>
                </div>
                <div>
                  <label className={labelClass}>Regras da Casa</label>
                  <textarea rows="2" value={novoEvento.regras} onChange={e => setNovoEvento({...novoEvento, regras: e.target.value})} className={`${inputClass} resize-none`} placeholder="Ex: Proibido menores de 18 anos."></textarea>
                </div>
              </div>
            </div>

            {/* Bloco Ingressos */}
            <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-indigo-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2"><Ticket className="w-5 h-5 text-indigo-400" /> Lotes de Ingresso</h3>
                  <button type="button" onClick={adicionarIngressoForm} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition"><Plus className="w-4 h-4"/> Novo Lote</button>
                </div>
                <div className="space-y-4">
                  {ingressosForm.map((ing, index) => (
                    <div key={ing.id} className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 relative grid grid-cols-1 lg:grid-cols-5 gap-4">
                      {ingressosForm.length > 1 && <button type="button" onClick={() => removerIngressoForm(ing.id)} className="absolute -top-3 -right-3 bg-red-500/20 text-red-400 w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:bg-red-500 hover:text-white transition"><X className="w-4 h-4" /></button>}
                      <div className="lg:col-span-1"><label className={labelClass}>Lote {index+1}</label><input type="text" value={ing.nome} onChange={e => atualizarIngressoForm(ing.id, 'nome', e.target.value)} className={inputClass} placeholder="Ex: 1º Lote" /></div>
                      <div className="lg:col-span-1"><label className={labelClass}>Modelo</label><select value={ing.tipoPreco} onChange={e => atualizarIngressoForm(ing.id, 'tipoPreco', e.target.value)} className={inputClass}><option value="unico">Preço Único</option><option value="separado">Masc / Fem</option></select></div>
                      
                      {ing.tipoPreco === 'unico' ? (
                        <div className="lg:col-span-2"><label className={labelClass}>Valor Unissex (R$)</label><input type="number" value={ing.preco} onChange={e => atualizarIngressoForm(ing.id, 'preco', e.target.value)} className={`${inputClass} !text-indigo-400 !text-lg bg-zinc-900 border-zinc-700`} /></div>
                      ) : (
                        <><div className="lg:col-span-1"><label className={labelClass}>Fem (R$)</label><input type="number" value={ing.precoFem} onChange={e => atualizarIngressoForm(ing.id, 'precoFem', e.target.value)} className={`${inputClass} !text-pink-400 !text-lg bg-zinc-900 border-zinc-700 focus:border-pink-500`} /></div><div className="lg:col-span-1"><label className={labelClass}>Masc (R$)</label><input type="number" value={ing.precoMasc} onChange={e => atualizarIngressoForm(ing.id, 'precoMasc', e.target.value)} className={`${inputClass} !text-blue-400 !text-lg bg-zinc-900 border-zinc-700 focus:border-blue-500`} /></div></>
                      )}
                      
                      <div className="lg:col-span-1"><label className={labelClass}>Bônus Bar (R$)</label><input type="number" value={ing.consumacao || ''} onChange={e => atualizarIngressoForm(ing.id, 'consumacao', e.target.value)} className={`${inputClass} !text-emerald-400 bg-emerald-950/30 border-emerald-900 focus:border-emerald-500`} placeholder="Opcional" /></div>
                    </div>
                  ))}
                </div>
              </div>

            {/* Bloco Camarotes */}
            {novoEvento.vendaCamarotesOnline && (
              <div className="bg-zinc-900 p-6 md:p-8 rounded-[2rem] border border-indigo-500/30 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2"><Crown className="w-5 h-5 text-indigo-400" /> Mapa VIP</h3>
                  <button type="button" onClick={adicionarSetor} className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition"><Plus className="w-4 h-4"/> Novo Setor</button>
                </div>
                <div className="space-y-4">
                  {setores.map((setor, index) => (
                    <div key={setor.id} className="grid grid-cols-2 lg:grid-cols-6 gap-4 items-end bg-zinc-950 p-5 rounded-2xl border border-zinc-800 relative group">
                      {setores.length > 1 && <button type="button" onClick={() => removerSetor(setor.id)} className="absolute -top-3 -right-3 bg-red-500/20 text-red-400 w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:bg-red-500 hover:text-white transition"><X className="w-4 h-4" /></button>}
                      <div className="lg:col-span-1"><label className={labelClass}>Tipo {index+1}</label><select value={setor.tipo} onChange={e => atualizarSetor(setor.id, 'tipo', e.target.value)} className={inputClass}><option>Camarote</option><option>Bistrô</option><option>Mesa</option><option value="Outro">Outro...</option></select>{setor.tipo === 'Outro' && <input type="text" placeholder="Nome" value={setor.nomePersonalizado} onChange={e => atualizarSetor(setor.id, 'nomePersonalizado', e.target.value)} className={`${inputClass} mt-2 !py-2`} />}</div>
                      <div className="lg:col-span-1"><label className={labelClass}>Qtd</label><input type="number" min="1" value={setor.quantidade} onChange={e => atualizarSetor(setor.id, 'quantidade', e.target.value)} className={inputClass} /></div>
                      <div className="lg:col-span-1"><label className={labelClass}>Pessoas</label><input type="number" min="1" value={setor.capacidade} onChange={e => atualizarSetor(setor.id, 'capacidade', e.target.value)} className={inputClass} /></div>
                      <div className="lg:col-span-1"><label className={labelClass}>Preço (R$)</label><input type="number" value={setor.preco} onChange={e => atualizarSetor(setor.id, 'preco', e.target.value)} className={`${inputClass} !text-indigo-400 bg-zinc-900 border-zinc-700`} /></div>
                      <div className="col-span-2 lg:col-span-2"><label className={labelClass}>Bônus Consumo (R$)</label><input type="number" value={setor.consumacao} onChange={e => atualizarSetor(setor.id, 'consumacao', e.target.value)} className={`${inputClass} !text-emerald-400 bg-emerald-950/30 border-emerald-900`} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Botão Salvar */}
            <div className="pt-4">
              <button disabled={isSubmitting} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 transition active:scale-95 text-white font-black text-lg py-5 rounded-[2rem] uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] flex justify-center items-center gap-3">
                {isSubmitting ? 'Processando...' : <><CheckCircle2 className="w-6 h-6" /> Publicar Evento no App</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid de Eventos na Tela Inicial do Admin */}
      {!mostrarFormulario && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {eventos.map(evento => (
            <div key={evento.id} className="bg-zinc-900 rounded-[2rem] overflow-hidden border border-zinc-800 shadow-xl flex flex-col relative group hover:border-indigo-500/50 transition">
              <button onClick={() => setModalExclusao({ aberto: true, evento: evento, textoConfirmacao: '' })} className="absolute top-4 right-4 bg-red-500/90 text-white w-10 h-10 rounded-full z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm hover:bg-red-500"><Trash2 className="w-4 h-4" /></button>
              <div className="h-48 relative">
                <img src={evento.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7"} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
                <div className="absolute bottom-5 left-6">
                  <h3 className="font-black text-2xl text-white">{evento.nome}</h3>
                  <p className="text-indigo-400 text-[10px] font-bold uppercase"><CalendarDays className="w-3 h-3 inline" /> {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="p-5 bg-zinc-900">
                <button onClick={() => setEventoSelecionado(evento)} className="w-full bg-zinc-800 text-white py-4 rounded-xl font-black flex justify-center gap-2 transition hover:bg-zinc-700 hover:text-indigo-300"><LayoutDashboard className="w-4 h-4" /> Dashboard Financeiro</button>
              </div>
            </div>
          ))}
          {eventos.length === 0 && (
            <div className="col-span-full text-center p-16 bg-zinc-900 border border-dashed border-zinc-800 rounded-[2rem]">
              <PackageOpen className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold text-lg">Nenhum evento criado.</p>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAIS DE AÇÃO ================= */}
      {modalCrop.aberto && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-fade-in p-4">
          <div className="w-full max-w-3xl flex justify-between items-center text-white mb-4"><div><h2 className="text-2xl font-black">Recortar Capa</h2><p className="text-sm font-medium text-zinc-400">Arraste a foto e ajuste o zoom</p></div><button onClick={() => setModalCrop({ aberto: false, fotoUrl: null })} className="bg-zinc-800 p-2 rounded-full hover:bg-zinc-700"><X className="w-6 h-6"/></button></div>
          <div className="relative w-full max-w-3xl h-[50vh] sm:h-[60vh] bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
            <Cropper image={modalCrop.fotoUrl} crop={crop} zoom={zoom} aspect={16 / 9} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, croppedAreaPixels) => setCropPixels(croppedAreaPixels)} />
          </div>
          <div className="w-full max-w-3xl mt-6 space-y-4">
            <div className="flex items-center gap-4 bg-zinc-900 px-6 py-4 rounded-2xl"><span className="text-zinc-400 font-bold text-sm">Zoom</span><input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-indigo-500" /></div>
            <button onClick={confirmarRecorte} className="w-full bg-indigo-600 hover:bg-indigo-500 transition active:scale-95 text-white py-5 rounded-[2rem] font-black text-xl flex justify-center items-center gap-2"><Crop className="w-5 h-5"/> Confirmar Recorte</button>
          </div>
        </div>
      )}

      {modalExclusao.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center animate-slide-up">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><AlertTriangle className="w-10 h-10 text-red-500" /></div>
            <h2 className="text-2xl font-black text-white mb-2">Excluir Evento</h2>
            <p className="text-sm font-bold text-zinc-400 mb-6">Tem certeza que deseja apagar <strong className="text-white">"{modalExclusao.evento.nome}"</strong>? Esta ação não pode ser desfeita.</p>
            <div className="text-left bg-zinc-950 p-4 rounded-2xl border border-zinc-800 mb-6">
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Digite CONFIRMAR</label>
              <input type="text" placeholder="CONFIRMAR" value={modalExclusao.textoConfirmacao} onChange={e => setModalExclusao({...modalExclusao, textoConfirmacao: e.target.value.toUpperCase()})} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 font-black text-center text-red-400 outline-none focus:border-red-500 uppercase tracking-widest" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalExclusao({ aberto: false, evento: null, textoConfirmacao: '' })} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl transition">Cancelar</button>
              <button onClick={confirmarExclusaoSegura} disabled={modalExclusao.textoConfirmacao !== 'CONFIRMAR'} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl transition disabled:opacity-50 disabled:grayscale">Apagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
