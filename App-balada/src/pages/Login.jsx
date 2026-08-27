import { useState, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = location.state?.returnTo || '/home';
  const eventoId = location.state?.eventoId || null;

  const traduzirErro = (codigo) => {
    switch (codigo) {
      case 'auth/invalid-credential': return 'E-mail ou senha incorretos.';
      case 'auth/email-already-in-use': return 'Este e-mail já está cadastrado.';
      case 'auth/weak-password': return 'A senha deve ter pelo menos 6 caracteres.';
      default: return 'Ocorreu um erro inesperado. Tente novamente.';
    }
  };

  const handleAutenticacao = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, senha);
      } else {
        if (!nome || !cpf) throw new Error('Preencha todos os campos.');
        await register(email, senha, nome, cpf);
      }
      navigate(returnTo, { state: { eventoId } }); 
    } catch (error) {
      setErro(error.message === 'Preencha todos os campos.' ? error.message : traduzirErro(error.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-gray-100 shadow-xl relative overflow-hidden">
        
        {/* Detalhe de design no topo do card */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-purple-500 to-pink-500"></div>

        <div className="text-center mb-8 mt-2">
          <h1 className="text-3xl font-black text-purple-600 mb-2 tracking-tighter">NEON.</h1>
          <p className="text-slate-500 font-medium">
            {eventoId ? 'Crie sua conta para garantir sua reserva' : (isLogin ? 'Acesse sua conta VIP' : 'Crie sua conta VIP')}
          </p>
        </div>

        {erro && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 border border-red-100 font-medium text-center">{erro}</div>}

        <form onSubmit={handleAutenticacao} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none rounded-xl p-3 text-slate-900 transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">CPF</label>
                <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none rounded-xl p-3 text-slate-900 transition" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none rounded-xl p-3 text-slate-900 transition" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required className="w-full bg-gray-50 border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none rounded-xl p-3 text-slate-900 transition" />
          </div>

          <button type="submit" disabled={loading} className="w-full text-white font-black py-4 rounded-xl mt-6 bg-purple-600 hover:bg-purple-700 shadow-[0_8px_20px_rgba(147,51,234,0.3)] transition active:scale-95 text-lg">
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Continuar')}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-gray-100 pt-6">
          <button onClick={() => { setIsLogin(!isLogin); setErro(''); }} className="text-slate-500 hover:text-purple-600 font-bold transition">
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre aqui'}
          </button>
        </div>
      </div>
    </div>
  );
}