import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import toast from 'react-hot-toast';
import { Search, Trash2, User as UserIcon, Mail, Lock } from 'lucide-react';

export default function GestaoRH() {
  const [equipe, setEquipe] = useState([]);
  const [modoRh, setModoRh] = useState('buscar'); 
  const [emailBusca, setEmailBusca] = useState('');
  const [usuarioEncontrado, setUsuarioEncontrado] = useState(null);
  const [novoFunc, setNovoFunc] = useState({ nome: '', email: '', senha: '', role: 'garcom' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ================= EFEITOS =================
  useEffect(() => {
    // Escuta em tempo real quem tem cargo operante na balada
    const unsubEquipe = onSnapshot(
      query(collection(db, "usuarios"), where("role", "in", ["admin", "garcom", "barman", "seguranca", "caixa"])), 
      snap => {
        setEquipe(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return () => unsubEquipe();
  }, []);

  // ================= FUNÇÕES DE BUSCA E ALTERAÇÃO DE CARGO =================
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
    } catch (error) { 
      toast.error("Erro na busca."); 
    }
    setIsSubmitting(false);
  };

  // Função 100% Gratuita (Lógica no Banco em vez de Cloud Functions)
  const alterarCargoUsuario = async (uid, novoCargo) => {
    const tId = toast.loading('Aplicando novo cargo com segurança...');
    try { 
      // Atualiza direto no banco, protegido pelas Regras do Firestore
      await updateDoc(doc(db, "usuarios", uid), { role: novoCargo });

      toast.success(`Cargo atualizado!`, { id: tId }); 
      if (usuarioEncontrado?.id === uid) setUsuarioEncontrado(null); 
      setEmailBusca(''); 
    } catch (error) { 
      toast.error("Erro de permissão. Apenas Admins podem fazer isso.", { id: tId }); 
    }
  };

  const criarFuncionarioDireto = async (e) => {
    e.preventDefault();
    if (!novoFunc.nome || !novoFunc.email || !novoFunc.senha) return toast.error("Preencha todos os campos.");
    if (novoFunc.senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    
    // =================================================================
    // COLOQUE SEU EMAIL AQUI PARA ELE SEMPRE TER PERMISSÃO MAXIMA
    const MEU_EMAIL_DONO = "lucasscortizo@gmail.com"; 
    // =================================================================

    setIsSubmitting(true);
    const tId = toast.loading("Criando conta no servidor...");
    
    try {
      const apiKey = auth.app.options.apiKey;
      // Cria o usuário silenciosamente no Firebase Auth sem deslogar o Admin
      const resposta = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email: novoFunc.email.trim(), password: novoFunc.senha, returnSecureToken: false }) 
      });
      
      const dados = await resposta.json();
      if (dados.error) {
        throw new Error(dados.error.message === 'EMAIL_EXISTS' ? "Este e-mail já está cadastrado." : dados.error.message);
      }
      
      // Trava de segurança: Se o email criado for a Chave Mestra, ele vira Admin
      let cargoFinal = novoFunc.role;
      if (novoFunc.email.toLowerCase().trim() === MEU_EMAIL_DONO.toLowerCase()) {
         cargoFinal = 'admin'; 
      }

      // Salva os dados visuais e o cargo direto no Firestore
      await setDoc(doc(db, "usuarios", dados.localId), { 
        nome: novoFunc.nome, 
        email: novoFunc.email.toLowerCase().trim(), 
        role: cargoFinal, 
        criadoEm: new Date().toISOString(), 
        criadoPorAdmin: true 
      });

      toast.success("Conta criada e funcionário promovido!", { id: tId }); 
      setNovoFunc({ nome: '', email: '', senha: '', role: 'garcom' }); 
      setModoRh('buscar'); 
      
    } catch (error) { 
      toast.error(error.message || "Erro ao criar funcionário.", { id: tId }); 
    }
    setIsSubmitting(false);
  };

  // ================= RENDERIZAÇÃO =================
  return (
    <div className="animate-fade-in grid grid-cols-1 xl:grid-cols-2 gap-8">
      
      {/* ================= COLUNA 1: GESTÃO ================= */}
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-zinc-200 shadow-sm h-fit">
        
        <div className="flex bg-zinc-100 p-2 rounded-2xl mb-10">
          <button 
            onClick={() => setModoRh('buscar')} 
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${modoRh === 'buscar' ? 'bg-white !text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Promover Cliente
          </button>
          <button 
            onClick={() => setModoRh('criar')} 
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${modoRh === 'criar' ? 'bg-white !text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Criar Conta Nova
          </button>
        </div>

        {/* MODO BUSCAR CLIENTE */}
        {modoRh === 'buscar' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-black !text-zinc-900 mb-2">Promover Usuário Existente</h2>
            <p className="text-sm text-zinc-500 font-medium mb-8">Digite o e-mail de um cliente para dar permissões na operação.</p>
            
            <form onSubmit={buscarUsuarioParaEquipe} className="flex flex-col sm:flex-row gap-3 mb-8">
              <input 
                type="email" 
                required 
                placeholder="E-mail do cliente" 
                value={emailBusca} 
                onChange={e => setEmailBusca(e.target.value)} 
                className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl px-5 py-4 font-bold !text-zinc-900" 
              />
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center justify-center transition disabled:opacity-50"
              >
                <Search className="w-5 h-5 mr-2"/> Buscar
              </button>
            </form>
            
            {usuarioEncontrado && (
              <div className="bg-indigo-50/50 border border-indigo-200 p-8 rounded-3xl animate-slide-up">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-xl shadow-md">
                    {usuarioEncontrado.nome?.charAt(0) || '@'}
                  </div>
                  <div>
                    <p className="font-black text-xl !text-zinc-900 leading-tight">{usuarioEncontrado.nome || 'Sem Nome'}</p>
                    <p className="text-sm text-indigo-600 font-bold mt-1">{usuarioEncontrado.email}</p>
                  </div>
                </div>
                <p className="text-xs font-black uppercase text-zinc-500 mb-4 tracking-widest border-b border-indigo-100 pb-2">Definir acesso como:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'caixa')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-4 rounded-xl font-black text-xs !text-zinc-900 transition shadow-sm">Caixa</button>
                  <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'garcom')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-4 rounded-xl font-black text-xs !text-zinc-900 transition shadow-sm">Garçom</button>
                  <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'barman')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-4 rounded-xl font-black text-xs !text-zinc-900 transition shadow-sm">Barman</button>
                  <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'seguranca')} className="bg-white hover:bg-zinc-50 border border-zinc-200 py-4 rounded-xl font-black text-xs !text-zinc-900 transition shadow-sm">Portaria</button>
                  <button onClick={() => alterarCargoUsuario(usuarioEncontrado.id, 'admin')} className="col-span-2 sm:col-span-4 bg-zinc-900 hover:bg-black text-white py-4 rounded-xl font-black text-xs transition border border-zinc-800 shadow-md">Tornar Administrador (Sócio)</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODO CRIAR CONTA */}
        {modoRh === 'criar' && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-black !text-zinc-900 mb-2">Novo Funcionário</h2>
            <p className="text-sm text-zinc-500 font-medium mb-8">Cria a conta do sistema e define o cargo imediatamente.</p>
            
            <form onSubmit={criarFuncionarioDireto} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="w-5 h-5 text-zinc-400 absolute left-5 top-1/2 -translate-y-1/2" />
                  <input type="text" required value={novoFunc.nome} onChange={e => setNovoFunc({...novoFunc, nome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl py-4 pl-14 pr-4 !text-zinc-900 font-bold" placeholder="Ex: João Silva" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-zinc-400 absolute left-5 top-1/2 -translate-y-1/2" />
                  <input type="email" required value={novoFunc.email} onChange={e => setNovoFunc({...novoFunc, email: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl py-4 pl-14 pr-4 !text-zinc-900 font-bold" placeholder="joao@email.com" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1">Senha (Mínimo 6)</label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-zinc-400 absolute left-5 top-1/2 -translate-y-1/2" />
                  <input type="password" required value={novoFunc.senha} onChange={e => setNovoFunc({...novoFunc, senha: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-2xl py-4 pl-14 pr-4 !text-zinc-900 font-bold" placeholder="••••••" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 ml-1 mt-6">Cargo Inicial</label>
                <select value={novoFunc.role} onChange={e => setNovoFunc({...novoFunc, role: e.target.value})} className="w-full bg-white border border-zinc-200 outline-none rounded-2xl p-4 !text-zinc-900 font-bold shadow-sm cursor-pointer">
                  <option value="caixa">Caixa (Pagamentos)</option>
                  <option value="garcom">Garçom (Atende Mesas)</option>
                  <option value="barman">Barman (Produção KDS)</option>
                  <option value="seguranca">Segurança (Portaria)</option>
                  <option value="admin">Sócio (Administrador)</option>
                </select>
              </div>
              <button 
                disabled={isSubmitting} 
                type="submit" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl shadow-md transition-all mt-4 disabled:opacity-50 active:scale-95 text-lg"
              >
                {isSubmitting ? 'Processando...' : 'Criar e Promover'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ================= COLUNA 2: EQUIPE ATIVA ================= */}
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-zinc-200 shadow-sm h-fit">
        <h2 className="text-2xl font-black !text-zinc-900 mb-2">Equipe Ativa</h2>
        <p className="text-sm text-zinc-500 font-medium mb-8">Colaboradores com permissões na casa.</p>
        
        <div className="space-y-4">
          {equipe.map(membro => {
            let badgeCor = 'bg-zinc-100 text-zinc-600 border-zinc-200'; 
            if (membro.role === 'admin') badgeCor = 'bg-indigo-50 text-indigo-700 border-indigo-200'; 
            if (membro.role === 'barman') badgeCor = 'bg-orange-50 text-orange-700 border-orange-200'; 
            if (membro.role === 'garcom') badgeCor = 'bg-emerald-50 text-emerald-700 border-emerald-200'; 
            if (membro.role === 'seguranca') badgeCor = 'bg-blue-50 text-blue-700 border-blue-200'; 
            if (membro.role === 'caixa') badgeCor = 'bg-pink-50 text-pink-700 border-pink-200';
            
            return (
              <div key={membro.id} className="flex justify-between items-center bg-zinc-50 border border-zinc-100 p-5 rounded-2xl">
                <div>
                  <p className="font-black text-base !text-zinc-900 flex items-center gap-2 mb-1">
                    {membro.nome || 'Sem Nome'} 
                    {membro.criadoPorAdmin && (
                      <span className="bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-black">
                        Conta Empresa
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-500 font-bold">{membro.email}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${badgeCor}`}>
                    {membro.role}
                  </span>
                  {membro.role !== 'admin' && (
                    <button 
                      onClick={() => { if(window.confirm('Remover acesso? Ele voltará a ser cliente.')) alterarCargoUsuario(membro.id, 'cliente') }} 
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-xl transition" 
                      title="Demitir"
                    >
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
  );
}