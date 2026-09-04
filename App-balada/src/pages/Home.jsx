import { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';
import { User, CalendarX, Ticket, LogOut, ChevronDown, MapPin } from 'lucide-react';

const APP_NAME = "Rolê";

export default function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'eventos'), orderBy('data', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEventos(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const aoClicarFora = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuAberto(false);
    };
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const sair = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-28 text-zinc-900">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
        {/* Mantendo o tamanho máximo expansivo no header */}
        <div className="mx-auto flex w-full 2xl:max-w-[1600px] items-center justify-between px-6 py-4">
          <span className="text-xl font-black tracking-tight !text-zinc-900">{APP_NAME}</span>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuAberto((v) => !v)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-zinc-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {user.nome ? user.nome.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${menuAberto ? 'rotate-180' : ''}`} />
              </button>

              {menuAberto && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
                  <div className="border-b border-zinc-100 px-5 py-4">
                    <p className="truncate font-bold !text-zinc-900 leading-tight">{user.nome || 'Sua conta'}</p>
                    <p className="truncate text-sm text-zinc-500 font-medium">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setMenuAberto(false); navigate('/minha-conta'); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:!text-zinc-900"
                    >
                      <Ticket className="h-4 w-4 text-zinc-400" /> Ingressos e comanda
                    </button>
                    <button
                      onClick={() => { setMenuAberto(false); navigate('/meus-dados'); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:!text-zinc-900"
                    >
                      <User className="h-4 w-4 text-zinc-400" /> Meus dados
                    </button>
                    <button
                      onClick={() => { setMenuAberto(false); sair(); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              Entrar
            </button>
          )}
        </div>
      </header>

      {/* Mantendo o container expansivo no Main */}
      <main className="mx-auto w-full 2xl:max-w-[1600px] px-6 pt-8">
        {loading ? (
          <div className="h-96 animate-pulse rounded-3xl bg-zinc-200" />
        ) : eventos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white py-20 text-center shadow-sm">
            <CalendarX className="mx-auto mb-4 h-9 w-9 text-zinc-300" strokeWidth={1.5} />
            <p className="font-bold text-zinc-500">Nenhum evento no momento. Volte em breve.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="mb-4 text-2xl font-black !text-zinc-900 tracking-tight">Próximos eventos</h2>
            
            {/* GRID EXPANSIVO: Adapta de 1 a 4 colunas dependendo do monitor */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-6 md:gap-8">
              {eventos.map((evento) => {
                const data = new Date(evento.data);
                
                return (
                  <button
                    key={evento.id}
                    onClick={() => navigate('/ingressos', { state: { eventoId: evento.id } })}
                    // "flex-row md:flex-col": No celular é linha (horizontal), no PC é coluna (Pôster)
                    className="group flex flex-row md:flex-col w-full items-center md:items-start rounded-[2rem] border border-zinc-200 bg-white text-left shadow-sm transition-all hover:border-indigo-200 hover:-translate-y-1 hover:shadow-xl overflow-hidden"
                  >
                    {/* Imagem: Pequena no celular, Gigante e no topo no computador */}
                    <div className="relative h-28 w-28 sm:h-32 sm:w-32 md:h-56 md:w-full flex-shrink-0 bg-zinc-100 m-3 rounded-2xl md:m-0 md:rounded-none">
                      <img
                        src={evento.linkImagem || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7'}
                        alt="Capa do Evento"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>

                    {/* Informações: Ao lado no celular, abaixo da imagem no computador */}
                    <div className="flex-1 min-w-0 py-3 pr-4 md:p-6 md:w-full">
                      <p className="mb-1 text-[10px] sm:text-xs font-black uppercase tracking-widest text-indigo-600">
                        {data.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')}
                        {' · '}
                        {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      
                      <h3 className="mb-2 text-lg sm:text-xl md:text-2xl font-black !text-zinc-900 transition-colors group-hover:text-indigo-600 leading-tight">
                        {evento.nome}
                      </h3>
                      
                      {evento.local && (
                        <p className="flex items-start gap-1.5 text-xs sm:text-sm font-bold text-zinc-500">
                          <MapPin className="h-3.5 w-3.5 md:h-4 md:w-4 flex-shrink-0 mt-0.5" /> 
                          <span className="leading-tight">{evento.local}</span>
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Mantendo o tamanho máximo expansivo no footer */}
      <footer className="mx-auto mt-16 w-full 2xl:max-w-[1600px] px-6 pb-32 pt-10 text-center border-t border-zinc-200/60">
        <p className="text-xs font-bold text-zinc-400">{APP_NAME} · Evento +18 · Documento com foto obrigatório na entrada</p>
      </footer>

      <BottomNav />
    </div>
  );
}