import { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';
import { User, Flame, CalendarX, Globe, MessageSquare, MapPin, ShieldCheck, AlertTriangle, Ticket, LogOut, ChevronDown } from 'lucide-react';

export default function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuPerfilAberto, setMenuPerfilAberto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const eventosQuery = query(collection(db, "eventos"), orderBy("data", "asc"));
    const unsubscribe = onSnapshot(eventosQuery, (snapshot) => {
      setEventos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fecha o menu se o usuário clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuPerfilAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const gerenciarAutenticacao = async () => {
    if (user) {
      await logout();
      navigate('/login');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans pb-24 relative">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-zinc-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-black tracking-tighter text-indigo-600">NEON.</h1>
        
        {user ? (
          <div className="relative" ref={menuRef}>
            {/* Botão do Perfil que ativa o card flutuante */}
            <button 
              onClick={() => setMenuPerfilAberto(!menuPerfilAberto)} 
              className="flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 p-1.5 pr-3 rounded-full transition-all active:scale-95 border border-zinc-200/60"
            >
              <div className="w-8 h-8 bg-indigo-600 text-white rounded-full font-bold flex items-center justify-center text-xs shadow-sm">
                {user.nome ? user.nome.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <span className="text-xs font-bold text-zinc-800 hidden sm:inline">
                {user.nome?.split(' ')[0] || 'VIP'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${menuPerfilAberto ? 'rotate-180' : ''}`} />
            </button>

            {/* CARD FLUTUANTE DE PERFIL (POPOVER) */}
            {menuPerfilAberto && (
              <div className="absolute right-0 mt-3 w-72 bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-zinc-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-6 bg-zinc-900 text-white relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl pointer-events-none"></div>
                  <p className="text-[10px] uppercase font-black tracking-widest text-indigo-400 mb-1">Conta Conectada</p>
                  <p className="font-black text-lg text-white truncate">{user.nome || 'Usuário VIP'}</p>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{user.email}</p>
                </div>

                <div className="p-3 space-y-1 bg-white">
                  <button 
                    onClick={() => { setMenuPerfilAberto(false); navigate('/minha-conta'); }} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-black">Meus Ingressos & Comanda</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Ver QR codes e saldo devedor</p>
                    </div>
                  </button>

                  {/* NOVO: BOTÃO PARA LEVAR AOS DADOS DO CLIENTE */}
                  <button 
                    onClick={() => { setMenuPerfilAberto(false); navigate('/meus-dados'); }} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-zinc-700 hover:bg-zinc-50 hover:text-indigo-600 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-black">Meus Dados</p>
                      <p className="text-[10px] text-zinc-400 font-medium">Nome, e-mail e cadastro</p>
                    </div>
                  </button>

                  <div className="h-px bg-zinc-100 my-1 mx-2"></div>

                  <button 
                    onClick={() => { setMenuPerfilAberto(false); gerenciarAutenticacao(); }} 
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                      <LogOut className="w-4 h-4" />
                    </div>
                    <span className="font-black">Sair da Conta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={gerenciarAutenticacao} 
            className="bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-full text-sm font-bold shadow-md transition-all active:scale-95"
          >
            Entrar
          </button>
        )}
      </header>

      <main className="px-6 pt-8 max-w-5xl mx-auto min-h-[70vh]">
        <div className="mb-8 flex items-center gap-3">
          <Flame className="w-8 h-8 text-indigo-500" strokeWidth={2.5} />
          <div>
            <h2 className="text-3xl font-black tracking-tight text-zinc-900">Em destaque</h2>
            <p className="text-zinc-500 font-medium">Os melhores eventos da semana</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="w-full h-64 bg-zinc-200 rounded-[2rem]"></div>
            <div className="w-full h-64 bg-zinc-200 rounded-[2rem]"></div>
          </div>
        ) : eventos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-zinc-200 shadow-sm">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarX className="w-10 h-10 text-zinc-300" strokeWidth={1.5} />
            </div>
            <p className="text-zinc-500 font-medium text-lg">Nenhum evento disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {eventos.map(evento => {
              const dataEvento = new Date(evento.data);
              
              return (
                <div 
                  key={evento.id} 
                  onClick={() => navigate('/ingressos', { state: { eventoId: evento.id } })} 
                  className="group cursor-pointer bg-white rounded-[2rem] overflow-hidden border border-zinc-200 shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <div className="relative h-72 w-full overflow-hidden">
                    <img 
                      src={evento.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7"} 
                      alt={evento.nome} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                    
                    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl text-center shadow-lg">
                      <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">
                        {dataEvento.toLocaleDateString('pt-BR', { month: 'short' })}
                      </p>
                      <p className="text-2xl font-black text-zinc-900 leading-none mt-1">
                        {dataEvento.getDate()}
                      </p>
                    </div>
                    
                    <div className="absolute bottom-6 left-6 right-6">
                      <h3 className="text-3xl font-black text-white leading-tight mb-2 drop-shadow-md">
                        {evento.nome}
                      </h3>
                      <p className="text-sm text-zinc-300 font-medium drop-shadow-md">
                        {evento.local || 'Local não informado'} • {dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      
      <footer className="mt-12 bg-white border-t border-zinc-200 px-6 py-12 pb-32 text-center">
        <h2 className="text-xl font-black text-zinc-300 mb-6 tracking-tighter">NEON.</h2>
        
        <div className="flex justify-center gap-6 mb-8">
          <a href="#" className="flex flex-col items-center gap-2 text-zinc-400 hover:text-indigo-600 transition">
            <Globe className="w-6 h-6" />
            <span className="text-[10px] uppercase font-bold">Redes</span>
          </a>
          <a href="#" className="flex flex-col items-center gap-2 text-zinc-400 hover:text-indigo-600 transition">
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] uppercase font-bold">Suporte</span>
          </a>
          <a href="#" className="flex flex-col items-center gap-2 text-zinc-400 hover:text-indigo-600 transition">
            <MapPin className="w-6 h-6" />
            <span className="text-[10px] uppercase font-bold">Local</span>
          </a>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4 text-zinc-500 mb-6 text-sm">
          <span className="flex items-center gap-2 border border-zinc-200 px-4 py-2 rounded-full bg-zinc-50 font-medium text-xs">
            <ShieldCheck className="w-4 h-4 text-green-500" /> Compra Segura
          </span>
          <span className="flex items-center gap-2 border border-zinc-200 px-4 py-2 rounded-full bg-zinc-50 font-medium text-xs">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Para maiores de 18
          </span>
        </div>

        <p className="text-xs text-zinc-400">© 2026 Neon Club. Todos os direitos reservados.</p>
      </footer>
      <BottomNav />
    </div>
  );
}