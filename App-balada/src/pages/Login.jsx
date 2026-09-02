import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Wine, Lock, Mail, ArrowRight, Loader2, User as UserIcon, CalendarDays, Phone, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

// ================= FUNÇÕES DE MÁSCARA PROFISSIONAIS =================
const mascaraCPF = (valor) => {
  return valor
    .replace(/\D/g, '') // Remove tudo o que não é dígito
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto entre o terceiro e o quarto dígitos
    .replace(/(\d{3})(\d)/, '$1.$2') // Coloca um ponto entre o sexto e o sétimo dígitos
    .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Coloca um hífen entre o nono e o décimo dígitos
    .replace(/(-\d{2})\d+?$/, '$1'); // Captura os dois últimos dígitos e não deixa digitar mais nada
};

const mascaraTelefone = (valor) => {
  return valor
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isProcessando, setIsProcessando] = useState(false);
  
  // Estados do Formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  
  const { login, register, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Redirecionamento Inteligente de Equipe vs Cliente
  useEffect(() => {
    if (user) direcionarPorCargo(user.role);
  }, [user]);

  const direcionarPorCargo = (role) => {
    if (role === 'admin') navigate('/admin', { replace: true });
    else if (role === 'garcom') navigate('/garcom', { replace: true });
    else if (role === 'barman') navigate('/bar', { replace: true });
    else if (role === 'seguranca') navigate('/catraca', { replace: true });
    else if (role === 'caixa') navigate('/caixa', { replace: true });
    else navigate('/home', { replace: true }); 
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsProcessando(true);
    const toastId = toast.loading(isLogin ? 'Autenticando...' : 'Criando seu cadastro...');
    
    try {
      if (isLogin) {
        // ================= FLUXO DE LOGIN =================
        await login(email, password);
        toast.success('Bem-vindo(a) de volta!', { id: toastId });
      } else {
        // ================= FLUXO DE CADASTRO COMPLETO =================
        // 1. Validações Locais
        if (cpf.length < 14) throw new Error("CPF incompleto.");
        if (telefone.length < 14) throw new Error("Telefone incompleto.");
        if (!nome.trim() || !dataNascimento) throw new Error("Preencha todos os campos.");

        // 2. Validação de Maioridade (18 anos)
        const hoje = new Date();
        const nasc = new Date(dataNascimento);
        let idade = hoje.getFullYear() - nasc.getFullYear();
        const mes = hoje.getMonth() - nasc.getMonth();
        if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
            idade--;
        }
        if (idade < 18) throw new Error("menor_de_idade");

        // 3. Cria a Conta no Firebase Auth
        const cred = await register(email, password);
        
        // 4. Atualiza o nome no Perfil de Autenticação
        await updateProfile(cred.user, { displayName: nome });

        // 5. Salva os dados completos do Cliente no Banco de Dados (Firestore)
        await setDoc(doc(db, 'usuarios', cred.user.uid), {
          nome,
          email,
          cpf,
          telefone,
          dataNascimento,
          role: 'cliente',
          criadoEm: new Date().toISOString()
        }, { merge: true });

        toast.success('Cadastro aprovado com sucesso!', { id: toastId });
      }
    } catch (error) {
      console.error(error);
      let mensagemErro = 'Erro de autenticação.';
      
      if (error.code === 'auth/invalid-credential') mensagemErro = 'E-mail ou senha incorretos.';
      if (error.code === 'auth/email-already-in-use') mensagemErro = 'Este e-mail já possui cadastro.';
      if (error.message === 'menor_de_idade') mensagemErro = 'É necessário ter 18 anos ou mais para se cadastrar.';
      if (error.message === 'CPF incompleto.') mensagemErro = 'Digite um CPF válido.';
      if (error.message === 'Telefone incompleto.') mensagemErro = 'Digite um telefone válido.';
      if (error.message === 'Preencha todos os campos.') mensagemErro = 'Todos os campos são obrigatórios.';
      
      toast.error(mensagemErro, { id: toastId });
      setIsProcessando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-6 text-zinc-900">
      <div className={`w-full ${isLogin ? 'max-w-sm' : 'max-w-lg'} animate-fade-in transition-all duration-300`}>
        
        <div className="text-center mb-8">
          <div className="bg-white w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-sm border border-zinc-200">
            <Wine className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-1"> Night</h1>
          <p className="text-zinc-500 font-medium text-sm">
            {isLogin ? 'Acesse sua conta para continuar.' : 'Complete seu cadastro para acessar a casa.'}
          </p>
        </div>

        <div className="bg-white border border-zinc-200 p-8 rounded-[2.5rem] shadow-sm">
          <h2 className="text-xl font-black mb-6 text-center">{isLogin ? 'Fazer Login' : 'Novo Cadastro'}</h2>
          
          <form onSubmit={handleAuth} className={isLogin ? 'space-y-5' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
            
            {/* ================= CAMPOS EXCLUSIVOS DO CADASTRO ================= */}
            {!isLogin && (
              <>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold transition-all text-sm" placeholder="Digite seu nome" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">CPF</label>
                  <div className="relative">
                    <CreditCard className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" required value={cpf} onChange={e => setCpf(mascaraCPF(e.target.value))} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold transition-all text-sm" placeholder="000.000.000-00" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Nascimento</label>
                  <div className="relative">
                    <CalendarDays className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="date" required value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold transition-all text-sm" />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="tel" required value={telefone} onChange={e => setTelefone(mascaraTelefone(e.target.value))} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold transition-all text-sm" placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </>
            )}

            {/* ================= CAMPOS DE E-MAIL E SENHA (COMUNS AOS DOIS) ================= */}
            <div className={!isLogin ? 'md:col-span-2' : ''}>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">E-mail</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold transition-all text-sm" placeholder="seu@email.com" />
              </div>
            </div>

            <div className={!isLogin ? 'md:col-span-2' : ''}>
              <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 ml-1">Senha</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 focus:border-indigo-500 outline-none rounded-xl py-3 pl-12 pr-4 text-zinc-900 font-bold transition-all text-sm" placeholder="••••••••" />
              </div>
            </div>

            <div className={!isLogin ? 'md:col-span-2 pt-2' : 'pt-2'}>
              <button disabled={isProcessando} type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                {isProcessando ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{isLogin ? 'Acessar Conta' : 'Concluir Cadastro'} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center border-t border-zinc-100 pt-6">
            <button onClick={() => { setIsLogin(!isLogin); setPassword(''); }} className="text-sm font-bold text-zinc-500 hover:text-indigo-600 transition-colors">
              {isLogin ? 'Ainda não é cliente? Cadastre-se' : 'Já possui cadastro? Faça Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}