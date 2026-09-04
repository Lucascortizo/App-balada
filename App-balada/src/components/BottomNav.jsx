import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Ticket, Receipt, User, ScanLine, Wine, LayoutDashboard, Wallet, ClipboardCheck, LogIn } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  if (location.pathname === '/login') return null;

  let menu = [];

  if (!user) {
    menu = [
      { name: 'Início', icon: Home, path: '/home' },
      { name: 'Entrar', icon: LogIn, path: '/login' },
    ];
  } else if (user.role === 'seguranca') {
    menu = [
      { name: 'Ler QR', icon: ScanLine, path: '/catraca' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  } else if (user.role === 'garcom') {
    menu = [
      { name: 'Mesas', icon: ClipboardCheck, path: '/garcom' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  } else if (user.role === 'barman') {
    menu = [
      { name: 'Bar', icon: Wine, path: '/bar' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  } else if (user.role === 'caixa') {
    menu = [
      { name: 'Caixa', icon: Wallet, path: '/caixa' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  } else if (user.role === 'admin') {
    menu = [
      { name: 'Início', icon: Home, path: '/home' },
      { name: 'Admin', icon: LayoutDashboard, path: '/admin' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  } else {
    menu = [
      { name: 'Início', icon: Home, path: '/home' },
      { name: 'Ingressos', icon: Ticket, path: '/meus-ingressos' },
      { name: 'Comanda', icon: Receipt, path: '/minha-conta' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 w-full z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-md justify-around px-2 py-2.5">
        {menu.map((item) => {
          const isActive = location.pathname.includes(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 rounded-xl px-4 py-1.5 text-zinc-400 transition-colors hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              <span className={`h-1 w-1 rounded-full transition-opacity ${isActive ? 'bg-indigo-600 opacity-100' : 'opacity-0'}`} />
              <Icon className={isActive ? 'h-5 w-5 text-indigo-600' : 'h-5 w-5'} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className={`text-[11px] ${isActive ? 'font-semibold text-indigo-600' : 'font-medium'}`}>{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}