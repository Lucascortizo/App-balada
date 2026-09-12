import { useState, useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { Settings, CalendarDays, Wine, ShieldCheck, LogOut, Menu, Store, Smartphone, ScanLine, Users, X } from 'lucide-react';

import GestaoEventos from '../components/admin/GestaoEventos';
import GestaoCardapio from '../components/admin/GestaoCardapio';
import GestaoRH from '../components/admin/GestaoRH';

export default function Admin() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const [menuLateral, setMenuLateral] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('eventos'); 

  const sairDaConta = async () => {
    await logout();
    navigate('/login');
  };

  if (user?.role !== 'admin') return <Navigate to="/home" replace />;

  const renderComponente = () => {
    switch(abaAtiva) {
      case 'eventos': return <GestaoEventos />;
      case 'cardapio': return <GestaoCardapio />;
      case 'equipe': return <GestaoRH />;
      default: return <GestaoEventos />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] font-sans pb-24 md:pb-0 text-zinc-900">
      
      {menuLateral && (
        <div className="fixed inset-0 z-40 bg-zinc-900/60 backdrop-blur-sm xl:hidden" onClick={() => setMenuLateral(false)}></div>
      )}

      <nav className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-zinc-200 z-50 flex flex-col transition-transform duration-300 ${menuLateral ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Rolê App</p>
            <h1 className="text-2xl font-black text-zinc-900 flex items-center gap-2"><Settings className="w-6 h-6 text-indigo-600" /> Admin</h1>
          </div>
          <button className="xl:hidden p-2 bg-zinc-50 hover:bg-zinc-100 rounded-full text-zinc-500 transition" onClick={() => setMenuLateral(false)}>
            <X className="w-5 h-5"/>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          <div>
            <p className="px-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Administração</p>
            <div className="space-y-1">
              <button onClick={() => { setAbaAtiva('eventos'); setMenuLateral(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${abaAtiva === 'eventos' ? 'bg-indigo-50 text-indigo-700 font-black' : 'text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900'}`}><CalendarDays className="w-5 h-5" /> Gestão de Eventos</button>
              <button onClick={() => { setAbaAtiva('cardapio'); setMenuLateral(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${abaAtiva === 'cardapio' ? 'bg-indigo-50 text-indigo-700 font-black' : 'text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900'}`}><Wine className="w-5 h-5" /> Cardápio / Estoque</button>
              <button onClick={() => { setAbaAtiva('equipe'); setMenuLateral(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${abaAtiva === 'equipe' ? 'bg-indigo-50 text-indigo-700 font-black' : 'text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900'}`}><ShieldCheck className="w-5 h-5" /> RH / Equipe</button>
            </div>
          </div>
          <div>
            <p className="px-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-3">Acessos da Operação</p>
            <div className="space-y-1">
              <button onClick={() => navigate('/home')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900 transition"><Smartphone className="w-5 h-5" /> Vitrine</button>
              <button onClick={() => navigate('/caixa')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900 transition"><Store className="w-5 h-5" /> Caixa</button>
              <button onClick={() => navigate('/catraca')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900 transition"><ScanLine className="w-5 h-5" /> Portaria</button>
              <button onClick={() => navigate('/bar')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900 transition"><Wine className="w-5 h-5" /> Bar</button>
              <button onClick={() => navigate('/garcom')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-zinc-600 font-bold hover:bg-zinc-50 hover:text-zinc-900 transition"><Users className="w-5 h-5" /> Garçom</button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100">
          <button onClick={sairDaConta} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-black text-red-500 hover:bg-red-50 rounded-xl transition"><LogOut className="w-5 h-5" /> Sair do Sistema</button>
        </div>
      </nav>

      <div className="flex-1 xl:ml-72 flex flex-col min-w-0">
        <header className="xl:hidden bg-white border-b border-zinc-200 px-4 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuLateral(true)} className="p-2 bg-zinc-50 hover:bg-zinc-100 rounded-lg text-zinc-600 transition"><Menu className="w-6 h-6" /></button>
            <h1 className="text-xl font-black text-zinc-900 capitalize">{abaAtiva === 'equipe' ? 'RH / Equipe' : abaAtiva}</h1>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 md:p-8">
          {renderComponente()}
        </main>
      </div>
    </div>
  );
}