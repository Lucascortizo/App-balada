import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  const rotaAtual = location.pathname;

  if (rotaAtual === '/login' || rotaAtual === '/cardapio') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 py-3 px-6 flex justify-around items-center z-50 shadow-2xl">
      <button
        onClick={() => navigate('/home')}
        className={`flex flex-col items-center gap-1 transition ${rotaAtual === '/home' ? 'text-purple-400 font-bold' : 'text-gray-400 hover:text-white'}`}
      >
        <span className="text-xl">🏠</span>
        <span className="text-[10px]">Início</span>
      </button>

      <button
        onClick={() => navigate('/minha-conta')}
        className={`flex flex-col items-center gap-1 transition ${rotaAtual === '/minha-conta' ? 'text-purple-400 font-bold' : 'text-gray-400 hover:text-white'}`}
      >
        <span className="text-xl">🎟️</span>
        <span className="text-[10px]">Meus Eventos</span>
      </button>

      {user?.isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className={`flex flex-col items-center gap-1 transition ${rotaAtual === '/admin' ? 'text-purple-400 font-bold' : 'text-gray-400 hover:text-white'}`}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[10px]">Admin</span>
        </button>
      )}
    </nav>
  );
}