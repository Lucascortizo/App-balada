import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { Home, Ticket, Settings } from 'lucide-react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  if (!user) return null;

  const rotaAtual = location.pathname;
  if (rotaAtual === '/login' || rotaAtual === '/cardapio') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-[400px] sm:rounded-full bg-white/90 backdrop-blur-xl border-t sm:border border-zinc-200 py-3 px-6 flex justify-around items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300">
      <button
        onClick={() => navigate('/home')}
        className={`flex flex-col items-center gap-1 transition-colors ${rotaAtual === '/home' ? 'text-indigo-600 font-black' : 'text-zinc-400 hover:text-indigo-500'}`}
      >
        <Home className="w-6 h-6" strokeWidth={rotaAtual === '/home' ? 2.5 : 2} />
        <span className="text-[10px] tracking-wide font-bold">Início</span>
      </button>

      <button
        onClick={() => navigate('/minha-conta')}
        className={`flex flex-col items-center gap-1 transition-colors ${rotaAtual === '/minha-conta' ? 'text-indigo-600 font-black' : 'text-zinc-400 hover:text-indigo-500'}`}
      >
        <Ticket className="w-6 h-6" strokeWidth={rotaAtual === '/minha-conta' ? 2.5 : 2} />
        <span className="text-[10px] tracking-wide font-bold">Carteira</span>
      </button>

      {(user?.isAdmin || user?.email === 'seuemail@teste.com') && (
        <button
          onClick={() => navigate('/admin')}
          className={`flex flex-col items-center gap-1 transition-colors ${rotaAtual === '/admin' ? 'text-indigo-600 font-black' : 'text-zinc-400 hover:text-indigo-500'}`}
        >
          <Settings className="w-6 h-6" strokeWidth={rotaAtual === '/admin' ? 2.5 : 2} />
          <span className="text-[10px] tracking-wide font-bold">Admin</span>
        </button>
      )}
    </nav>
  );
}