import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Ticket, Receipt, User, ScanLine, Wine, LayoutDashboard, Wallet, ClipboardCheck, LogIn } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  // Esconde o menu inferior inteiro se o usuário estiver na tela de login
  if (location.pathname === '/login') return null;

  let menu = [];

  // 1. MENU DE QUEM NÃO FEZ LOGIN (Apenas o essencial)
  if (!user) {
    menu = [
      { name: 'Home', icon: Home, path: '/home' },
      { name: 'Entrar', icon: LogIn, path: '/login' }
    ];
  } 
  // 2. MENU DO SEGURANÇA
  else if (user.role === 'seguranca') {
    menu = [
      { name: 'Ler QR', icon: ScanLine, path: '/catraca' },
      { name: 'Perfil', icon: User, path: '/meus-dados' }
    ];
  } 
  // 3. MENU DO GARÇOM
  else if (user.role === 'garcom') {
    menu = [
      { name: 'Mesas', icon: ClipboardCheck, path: '/garcom' },
      { name: 'Perfil', icon: User, path: '/meus-dados' }
    ];
  } 
  // 4. MENU DO BARMAN
  else if (user.role === 'barman') {
    menu = [
      { name: 'KDS', icon: Wine, path: '/bar' },
      { name: 'Perfil', icon: User, path: '/meus-dados' }
    ];
  } 
  // 5. MENU DO CAIXA
  else if (user.role === 'caixa') {
    menu = [
      { name: 'Caixa PDV', icon: Wallet, path: '/caixa' },
      { name: 'Perfil', icon: User, path: '/meus-dados' }
    ];
  } 
  // 6. MENU DO SÓCIO (ADMIN)
  else if (user.role === 'admin') {
    menu = [
      { name: 'Vitrine', icon: Home, path: '/home' },
      { name: 'Admin', icon: LayoutDashboard, path: '/admin' },
      { name: 'Perfil', icon: User, path: '/meus-dados' }
    ];
  } 
  // 7. MENU DO CLIENTE
  else {
    menu = [
      { name: 'Home', icon: Home, path: '/home' },
      { name: 'Ingressos', icon: Ticket, path: '/meus-ingressos' },
      { name: 'Comanda', icon: Receipt, path: '/minha-conta' },
      { name: 'Perfil', icon: User, path: '/meus-dados' }
    ];
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 pb-safe z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
      <div className="max-w-md mx-auto flex justify-around px-2 py-3">
        {menu.map((item) => {
          const isActive = location.pathname.includes(item.path);
          const Icon = item.icon;
          return (
            <button key={item.name} onClick={() => navigate(item.path)} className={`flex flex-col items-center gap-1 transition-colors px-4 ${isActive ? 'text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}>
              <Icon className={`w-6 h-6 ${isActive ? 'fill-indigo-50/50' : ''}`} />
              <span className={`text-[10px] font-bold ${isActive ? 'font-black' : ''}`}>{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}