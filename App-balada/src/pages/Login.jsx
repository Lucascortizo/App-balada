import { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

  // A MÁGICA: Onde o usuário estava antes de ser barrado?
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
      
      // O EFEITO BUMERANGUE: Volta para onde ele estava (com o ID da festa)
      navigate(returnTo, { state: { eventoId } }); 
      
    } catch (error) {
      setErro(error.message === 'Preencha todos os campos.' ? error.message : traduzirErro(error.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4 font-sans text-white">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-2xl">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-400 mb-2">Neon Club</h1>
          <p className="text-gray-400">
            {eventoId ? 'Crie sua conta para garantir sua reserva' : (isLogin ? 'Acesse sua conta' : 'Crie sua conta')}
          </p>
        </div>

        {erro && <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-500/30">{erro}</div>}

        <form onSubmit={handleAutenticacao} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">CPF</label>
                <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white" />
          </div>

          <button type="submit" disabled={loading} className="w-full text-white font-bold py-3 rounded-lg mt-6 bg-purple-600 hover:bg-purple-500 transition">
            {loading ? 'Processando...' : (isLogin ? 'Entrar' : 'Continuar')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => { setIsLogin(!isLogin); setErro(''); }} className="text-purple-400 text-sm">
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre aqui'}
          </button>
        </div>
      </div>
    </div>
  );
}