import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '../services/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isLogin, setIsLogin] = useState(true); // Alterna entre Entrar e Cadastrar
  const [erro, setErro] = useState('');
  
  const navigate = useNavigate();

  const handleAutenticacao = async (e) => {
    e.preventDefault();
    setErro('');

    try {
      if (isLogin) {
        // Tenta logar
        await signInWithEmailAndPassword(auth, email, senha);
      } else {
        // Tenta criar nova conta
        await createUserWithEmailAndPassword(auth, email, senha);
      }
      // Se deu certo, manda o usuário para a balada!
      navigate('/cardapio');
    } catch (error) {
      console.error(error);
      setErro('Erro na autenticação. Verifique os dados ou tente uma senha de no mínimo 6 caracteres.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4 font-sans text-white">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-2xl shadow-purple-900/20">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-purple-400 mb-2">Neon Club</h1>
          <p className="text-gray-400">
            {isLogin ? 'Entre para acessar seu ingresso' : 'Crie sua conta para curtir'}
          </p>
        </div>

        {erro && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-500/50">
            {erro}
          </div>
        )}

        <form onSubmit={handleAutenticacao} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Senha</label>
            <input 
              type="password" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg mt-6 transition-colors"
          >
            {isLogin ? 'Entrar na Festa' : 'Criar Conta'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entre aqui'}
          </button>
        </div>

      </div>
    </div>
  );
}