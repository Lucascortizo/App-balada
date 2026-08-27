import { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import { ArrowLeft, User, Mail, Shield, CreditCard } from 'lucide-react';

export default function MeusDados() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-32">
      
      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-zinc-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => navigate('/home')} 
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-600 p-2.5 rounded-full transition-transform active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-black tracking-tight text-zinc-900">Meus Dados</h1>
        <div className="w-10"></div>
      </header>

      <main className="p-6 max-w-md mx-auto space-y-6">
        
        {/* Cartão de Perfil Principal */}
        <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-8 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
          
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4 shadow-inner border-2 border-indigo-100">
            {user.nome ? user.nome.charAt(0).toUpperCase() : <User className="w-10 h-10" />}
          </div>
          
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-1">
            {user.nome || 'Usuário VIP'}
          </h2>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-1.5 mt-1">
            <Shield className="w-3.5 h-3.5 text-green-500" /> Conta Verificada
          </p>
        </div>

        {/* Lista de Informações Cadastrais */}
        <div className="bg-white rounded-[2rem] border border-zinc-200 p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3">
            Informações Pessoais
          </h3>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nome Completo</p>
              <p className="text-sm font-black text-zinc-900">{user.nome || 'Não informado'}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">E-mail de Acesso</p>
              <p className="text-sm font-black text-zinc-900">{user.email}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-500 flex-shrink-0 mt-0.5">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">CPF Cadastrado</p>
              <p className="text-sm font-black text-zinc-900">{user.cpf || 'Não informado'}</p>
            </div>
          </div>
        </div>

        {/* Botão de Encerrar Sessão */}
        <button 
          onClick={() => { logout(); navigate('/login'); }} 
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-black py-4 rounded-2xl transition-colors text-sm tracking-wider uppercase shadow-sm active:scale-95"
        >
          Sair da Conta
        </button>

      </main>
      
      <BottomNav />
    </div>
  );
}