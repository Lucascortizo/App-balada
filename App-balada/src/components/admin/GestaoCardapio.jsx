import { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, updateDoc, addDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';
import { Box, Plus, Wine, Edit3, Trash2, UploadCloud, X } from 'lucide-react';

export default function GestaoCardapio() {
  const [produtos, setProdutos] = useState([]);
  const [modalProduto, setModalProduto] = useState({ aberto: false, modo: 'criar' });
  const [novoProduto, setNovoProduto] = useState({ 
    nome: '', preco: '', categoria: 'Drinks', descricao: '', imagem: '', estoque: 50, apenasVIP: false 
  });
  const [editandoProdutoId, setEditandoProdutoId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ================= EFEITOS =================
  useEffect(() => {
    const unsubCardapio = onSnapshot(collection(db, "cardapio"), snap => {
      setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubCardapio();
  }, []);

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

  // ================= CONTROLE DO MODAL =================
  const abrirModalCriarProduto = () => { 
    setNovoProduto({ nome: '', preco: '', categoria: 'Drinks', descricao: '', imagem: '', estoque: 50, apenasVIP: false }); 
    setEditandoProdutoId(null); 
    setModalProduto({ aberto: true, modo: 'criar' }); 
  };
  
  const abrirModalEditarProduto = (produto) => { 
    setNovoProduto({ 
      nome: produto.nome, 
      preco: produto.preco, 
      estoque: produto.estoque, 
      categoria: produto.categoria || 'Drinks', 
      descricao: produto.descricao || '', 
      imagem: produto.imagem || '', 
      apenasVIP: produto.apenasVIP || false 
    }); 
    setEditandoProdutoId(produto.id); 
    setModalProduto({ aberto: true, modo: 'editar' }); 
  };
  
  const fecharModalProduto = () => { 
    setModalProduto({ aberto: false, modo: 'criar' }); 
  };

  // ================= AÇÕES DE BANCO DE DADOS =================
  const salvarProduto = async (e) => {
    e.preventDefault(); 
    setIsSubmitting(true); 
    const tId = toast.loading("Salvando...");
    
    try { 
      const payload = { 
        nome: novoProduto.nome, 
        preco: parseFloat(novoProduto.preco), 
        estoque: parseInt(novoProduto.estoque), 
        categoria: novoProduto.categoria || 'Drinks', 
        descricao: novoProduto.descricao || '', 
        imagem: novoProduto.imagem || '', 
        apenasVIP: novoProduto.apenasVIP || false 
      };
      
      if (editandoProdutoId) {
        await updateDoc(doc(db, "cardapio", editandoProdutoId), payload); 
      } else {
        await addDoc(collection(db, "cardapio"), payload); 
      }
      
      fecharModalProduto(); 
      toast.success("Cardápio atualizado!", { id: tId });
    } catch (error) { 
      toast.error("Erro ao salvar.", { id: tId }); 
    } finally { 
      setIsSubmitting(false); 
    }
  };
  
  const apagarProduto = async (id) => { 
    if (window.confirm('Excluir permanentemente do cardápio?')) { 
      await deleteDoc(doc(db, "cardapio", id)); 
      toast.success("Produto excluído."); 
    } 
  };
  
  const ajustarEstoque = async (id, estoqueAtual, variacao) => { 
    await updateDoc(doc(db, "cardapio", id), { 
      estoque: Math.max(0, estoqueAtual + variacao) 
    }); 
  };

  // ================= RENDERIZAÇÃO =================
  return (
    <div className="animate-fade-in">
      
      {/* Cabeçalho Desktop */}
      <div className="flex justify-between items-center mb-8 border-b border-zinc-200 pb-4 hidden md:flex">
        <h2 className="text-3xl font-black !text-zinc-900 flex items-center gap-2">
          <Box className="w-8 h-8 text-indigo-600"/> Gestão de Estoque
        </h2>
        <button 
          onClick={abrirModalCriarProduto} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black transition active:scale-95 flex items-center gap-2 shadow-md"
        >
          <Plus className="w-4 h-4" /> Nova Bebida
        </button>
      </div>
      
      {/* Botão Mobile */}
      <button 
        onClick={abrirModalCriarProduto} 
        className="md:hidden w-full mb-8 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-2xl font-black transition active:scale-95 flex justify-center items-center gap-2 shadow-md"
      >
        <Plus className="w-4 h-4" /> Nova Bebida
      </button>

      {/* Grid de Produtos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {produtos.map(produto => (
          <div key={produto.id} className={`p-6 rounded-[2rem] border flex flex-col justify-between transition-all hover:shadow-lg ${produto.estoque === 0 ? 'bg-zinc-50 opacity-60' : 'bg-white'}`}>
            
            <div className="flex items-start gap-4 mb-6 border-b border-zinc-100 pb-5">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-zinc-100 flex-shrink-0 shadow-sm">
                {produto.imagem ? <img src={produto.imagem} className="w-full h-full object-cover"/> : <Wine className="w-8 h-8 text-zinc-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="bg-zinc-100 text-zinc-500 text-[8px] px-2 py-1 rounded font-black uppercase mb-2 inline-block tracking-widest">
                  {produto.categoria || 'Geral'}
                </span>
                <h4 className="font-black truncate text-lg leading-tight !text-zinc-900">{produto.nome}</h4>
                <p className="text-indigo-600 text-sm font-black mt-1">R$ {parseFloat(produto.preco).toFixed(2)}</p>
                {produto.apenasVIP && (
                  <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 mt-1">Apenas Camarotes</p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-5">
              <div className="flex justify-between items-center bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-widest pl-2">Estoque</span>
                <div className="flex items-center bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden">
                  <button onClick={() => ajustarEstoque(produto.id, produto.estoque, -1)} className="w-10 h-8 font-black text-zinc-600 hover:bg-zinc-100 transition">-</button>
                  <div className="w-12 h-8 flex items-center justify-center font-black text-sm border-x border-zinc-200 !text-zinc-900">{produto.estoque}</div>
                  <button onClick={() => ajustarEstoque(produto.id, produto.estoque, 1)} className="w-10 h-8 font-black text-zinc-600 hover:bg-zinc-100 transition">+</button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => abrirModalEditarProduto(produto)} 
                  className="bg-white border border-zinc-200 text-zinc-600 hover:text-indigo-600 hover:border-indigo-200 py-3 rounded-xl font-bold text-xs transition shadow-sm"
                >
                  <Edit3 className="w-4 h-4 inline mr-1"/> Editar
                </button>
                <button 
                  onClick={() => apagarProduto(produto.id)} 
                  className="bg-red-50 text-red-500 border border-red-100 hover:bg-red-600 hover:text-white py-3 rounded-xl font-bold text-xs transition shadow-sm"
                >
                  <Trash2 className="w-4 h-4 inline mr-1"/> Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {produtos.length === 0 && (
        <div className="text-center p-16 border border-dashed border-zinc-300 rounded-[2.5rem] bg-white mt-4">
          <Wine className="w-16 h-16 text-zinc-200 mx-auto mb-4" />
          <p className="!text-zinc-900 font-black text-lg mb-1">O cardápio está vazio</p>
          <p className="text-zinc-500 font-medium text-sm">Clique no botão acima para adicionar produtos.</p>
        </div>
      )}

      {/* ================= MODAL CRIAR/EDITAR PRODUTO ================= */}
      {modalProduto.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
            
            <div className="p-6 bg-zinc-900 text-white flex justify-between items-center">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Box className="w-5 h-5 text-indigo-400"/> 
                {modalProduto.modo === 'criar' ? 'Nova Bebida' : 'Editar Bebida'}
              </h2>
              <button onClick={fecharModalProduto} className="text-zinc-400 hover:text-white transition">
                <X className="w-6 h-6"/>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="form-produto" onSubmit={salvarProduto} className="space-y-6">
                
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
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => processarImagem(e.target.files[0], (url) => setNovoProduto({...novoProduto, imagem: url}))} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 p-4 rounded-xl">
                  <input 
                    type="checkbox" 
                    id="vipToggle" 
                    checked={novoProduto.apenasVIP} 
                    onChange={e => setNovoProduto({...novoProduto, apenasVIP: e.target.checked})} 
                    className="w-5 h-5 accent-orange-600 rounded cursor-pointer" 
                  />
                  <label htmlFor="vipToggle" className="text-sm font-bold text-orange-900 cursor-pointer leading-tight">
                    Exclusivo para Camarotes/Mesas <br/>
                    <span className="text-[10px] uppercase font-black tracking-widest text-orange-600">Proibir venda na Pista</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Nome do Produto *</label>
                  <input 
                    type="text" 
                    required 
                    value={novoProduto.nome} 
                    onChange={e => setNovoProduto({...novoProduto, nome: e.target.value})} 
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 !text-zinc-900 font-bold transition" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Categoria (Aba no Cardápio) *</label>
                  <input 
                    type="text" 
                    list="categorias-admin" 
                    required 
                    value={novoProduto.categoria} 
                    onChange={e => setNovoProduto({...novoProduto, categoria: e.target.value})} 
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 !text-zinc-900 font-bold transition" 
                  />
                  <datalist id="categorias-admin">
                    <option value="Combos" />
                    <option value="Doses" />
                    <option value="Cervejas" />
                    <option value="Energéticos" />
                    <option value="Sem Álcool" />
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Preço (R$) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={novoProduto.preco} 
                      onChange={e => setNovoProduto({...novoProduto, preco: e.target.value})} 
                      className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 !text-zinc-900 font-bold transition" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Estoque Inicial *</label>
                    <input 
                      type="number" 
                      required 
                      value={novoProduto.estoque} 
                      onChange={e => setNovoProduto({...novoProduto, estoque: e.target.value})} 
                      className="w-full bg-emerald-50 border border-emerald-200 focus:border-emerald-500 outline-none rounded-xl p-3.5 text-emerald-700 font-black transition" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Descrição (Opcional)</label>
                  <textarea 
                    placeholder="Ex: Acompanha gelo e copos." 
                    rows="2" 
                    value={novoProduto.descricao} 
                    onChange={e => setNovoProduto({...novoProduto, descricao: e.target.value})} 
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl p-3.5 !text-zinc-900 font-medium transition text-sm resize-none"
                  ></textarea>
                </div>

              </form>
            </div>
            
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex gap-3">
              <button 
                type="button" 
                onClick={fecharModalProduto} 
                className="flex-1 bg-white border border-zinc-200 text-zinc-600 font-bold py-4 rounded-xl transition shadow-sm hover:bg-zinc-100"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="form-produto" 
                disabled={isSubmitting} 
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl shadow-md transition active:scale-95 flex justify-center items-center disabled:opacity-50"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Bebida'}
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}