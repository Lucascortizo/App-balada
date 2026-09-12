import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  User,
  ScanLine,
  Wine,
  LayoutDashboard,
  Wallet,
  ClipboardCheck,
  LogIn,
  Ticket,
  Home,
} from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useComanda } from '../hooks/useComanda';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  if (location.pathname === '/login') return null;

  const { comandasProcessadas = [] } = useComanda(
    user?.role === 'cliente' ? user : null
  );

  const possuiEventoAtivo = comandasProcessadas.some(
    (comanda) =>
      comanda.isNoEvento &&
      !comanda.isHistorico
  );

  let menu = [];

  if (!user) {
    menu = [
      { name: 'Início', icon: Home, path: '/home' },
      { name: 'Eventos', icon: CalendarDays, path: '/eventos' },
      { name: 'Entrar', icon: LogIn, path: '/login' },
    ];
  } else if (user.role === 'seguranca') {
    menu = [
      { name: 'Portaria', icon: ScanLine, path: '/catraca' },
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
      { name: 'Painel', icon: LayoutDashboard, path: '/admin' },
      { name: 'Perfil', icon: User, path: '/meus-dados' },
    ];
  } else {
    menu = possuiEventoAtivo
      ? [
          { name: 'Início', icon: Home, path: '/home' },
          { name: 'Bar', icon: Wine, path: '/cardapio' },
          { name: 'Comanda', icon: Wallet, path: '/minha-conta' },
          { name: 'Perfil', icon: User, path: '/meus-dados' },
        ]
      : [
          { name: 'Início', icon: Home, path: '/home' },
          { name: 'Eventos', icon: CalendarDays, path: '/eventos' },
          { name: 'Ingressos', icon: Ticket, path: '/meus-ingressos' },
          { name: 'Perfil', icon: User, path: '/meus-dados' },
        ];
  }

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-6 left-1/2 z-50 w-[92%] max-w-xl -translate-x-1/2"
    >
      <div className="flex items-center justify-around rounded-[2rem] border border-zinc-800/80 bg-zinc-950/90 px-2 py-3 shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {menu.map((item) => {
          const Icon = item.icon;

          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(`${item.path}/`);

          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-2 py-1 outline-none transition-transform active:scale-95"
            >
              <Icon
                className={
                  isActive
                    ? 'h-5 w-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                    : 'h-5 w-5 text-zinc-500'
                }
                strokeWidth={isActive ? 2.5 : 2}
              />

              <span
                className={`text-[9px] uppercase tracking-widest ${
                  isActive
                    ? 'font-black text-white'
                    : 'font-bold text-zinc-600'
                }`}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
