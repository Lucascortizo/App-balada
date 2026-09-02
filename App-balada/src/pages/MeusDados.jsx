import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { User as UserIcon, Phone, CreditCard, CalendarDays, LogOut, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MeusDados() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Você saiu da conta.");
      navigate('/login');
    } catch (error) {
      toast.error("Erro ao sair da conta.");
    }
  };

  // Prevenção de segurança (O Leão de Chácara já cuida disso, mas garantimos aqui)
  if (!user) return null;

  // Converte YYYY-MM-DD para DD/MM/YYYY
  const formatarData = (dataStr) => {
    if (!dataStr) return 'Não informada';
    const partes = dataStr.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataStr;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32 font-sans">
      
      {/* ================= CABEÇALHO DO PERFIL ================= */}
      <header className="bg-zinc-900 text-white pt-12 pb-8 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        {/* Efeito visual de fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        
        <div className="max-w-md mx-auto relative z-10 flex items-center gap-5">
          <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-zinc-800 shadow-xl flex-shrink-0">
            <span className="text-3xl font-black uppercase">
              {user.nome ? user.nome.charAt(0) : <UserIcon className="w-8 h-8"/>}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight tracking-tight">{user.nome || 'Usuário'}</h1>
            <p className="text-indigo-400 font-bold text-sm mt-1">{user.email}</p>
            
            {/* Se for funcionário, mostra o crachá */}
            {user.role !== 'cliente' && (
              <span className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mt-3 border border-white/10">
                <ShieldCheck className="w-3 h-3"/> Equipe: {user.role}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ================= DADOS DE CADASTRO ================= */}
      <main className="max-w-md mx-auto p-6 -mt-4 relative z-20">
        
        <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-zinc-200 space-y-6">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3">Informações Pessoais</h2>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 flex-shrink-0">
              <CreditCard className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">CPF</p>
              <p className="font-bold text-zinc-900 text-sm mt-0.5">{user.cpf || 'Não informado'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 flex-shrink-0">
              <Phone className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Celular / WhatsApp</p>
              <p className="font-bold text-zinc-900 text-sm mt-0.5">{user.telefone || 'Não informado'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 flex-shrink-0">
              <CalendarDays className="w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nascimento</p>
              <p className="font-bold text-zinc-900 text-sm mt-0.5">{user.dataNascimento ? formatarData(user.dataNascimento) : 'Não informado'}</p>
            </div>
          </div>
        </div>

        {/* ================= BOTÃO DE SAIR ================= */}
        <button 
          onClick={handleLogout}
          className="w-full mt-8 bg-zinc-100 hover:bg-red-50 text-red-500 font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors active:scale-95 border border-zinc-200 hover:border-red-200 shadow-sm"
        >
          <LogOut className="w-5 h-5" /> Sair da Conta
        </button>

      </main>

      <BottomNav />
    </div>
  );
}