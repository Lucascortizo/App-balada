import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Wine, Lock, Mail, Loader2, User as UserIcon, CalendarDays, Phone, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { APP_NAME } from '../constants/Brand';

const mascaraCPF = (valor) =>
  valor
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');

const mascaraTelefone = (valor) =>
  valor
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isProcessando, setIsProcessando] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  const { login, register, user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) direcionarPorCargo(user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const toastId = toast.loading(isLogin ? 'Entrando...' : 'Criando sua conta...');

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Bem-vindo(a) de volta!', { id: toastId });
      } else {
        if (cpf.length < 14) throw new Error('CPF incompleto.');
        if (telefone.length < 14) throw new Error('Telefone incompleto.');
        if (!nome.trim() || !dataNascimento) throw new Error('Preencha todos os campos.');

        const hoje = new Date();
        const nasc = new Date(dataNascimento);
        let idade = hoje.getFullYear() - nasc.getFullYear();
        const mes = hoje.getMonth() - nasc.getMonth();
        if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) idade--;
        if (idade < 18) throw new Error('menor_de_idade');

        const cred = await register(email, password);
        await updateProfile(cred.user, { displayName: nome });
        await setDoc(
          doc(db, 'usuarios', cred.user.uid),
          { nome, email, cpf, telefone, dataNascimento, role: 'cliente', criadoEm: new Date().toISOString() },
          { merge: true }
        );

        toast.success('Conta criada com sucesso!', { id: toastId });
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

  const campo = 'w-full rounded-xl border border-zinc-200 bg-zinc-50 py-3 pl-11 pr-4 text-sm font-medium text-zinc-900 outline-none transition focus:border-indigo-500 focus:bg-white';
  const rotulo = 'mb-1.5 block text-sm font-medium text-zinc-600';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] p-6 text-zinc-900">
      <div className={`w-full ${isLogin ? 'max-w-sm' : 'max-w-lg'} transition-all`}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
            <Wine className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isLogin ? 'Entre para continuar.' : 'Crie sua conta para garantir seu lugar.'}
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleAuth} className={isLogin ? 'space-y-4' : 'grid grid-cols-1 gap-4 md:grid-cols-2'}>
            {!isLogin && (
              <>
                <div className="md:col-span-2">
                  <label className={rotulo}>Nome completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Seu nome" />
                  </div>
                </div>

                <div>
                  <label className={rotulo}>CPF</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input type="text" required value={cpf} onChange={(e) => setCpf(mascaraCPF(e.target.value))} className={campo} placeholder="000.000.000-00" />
                  </div>
                </div>

                <div>
                  <label className={rotulo}>Nascimento</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input type="date" required value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={campo} />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className={rotulo}>Telefone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input type="tel" required value={telefone} onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} className={campo} placeholder="(00) 00000-0000" />
                  </div>
                </div>
              </>
            )}

            <div className={!isLogin ? 'md:col-span-2' : ''}>
              <label className={rotulo}>E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} placeholder="seu@email.com" />
              </div>
            </div>

            <div className={!isLogin ? 'md:col-span-2' : ''}>
              <label className={rotulo}>Senha</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={campo} placeholder="••••••••" />
              </div>
            </div>

            <div className={!isLogin ? 'pt-2 md:col-span-2' : 'pt-2'}>
              <button
                disabled={isProcessando}
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {isProcessando ? <Loader2 className="h-4 w-4 animate-spin" /> : isLogin ? 'Entrar' : 'Criar conta'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-zinc-100 pt-5 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setPassword(''); }} className="text-sm font-medium text-zinc-500 hover:text-indigo-600">
              {isLogin ? 'Ainda não tem conta? Criar conta' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}