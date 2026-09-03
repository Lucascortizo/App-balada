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

  const [destaque, ...proximos] = eventos;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-28 text-zinc-900">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-4 backdrop-blur-md">
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
      </header>

      <main className="mx-auto max-w-5xl px-6 pt-8">
        {loading ? (
          <div className="h-96 animate-pulse rounded-3xl bg-zinc-200" />
        ) : eventos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-white py-20 text-center">
            <CalendarX className="mx-auto mb-4 h-9 w-9 text-zinc-300" strokeWidth={1.5} />
            <p className="font-bold text-zinc-500">Nenhum evento no momento. Volte em breve.</p>
          </div>
        ) : (
          <div className="space-y-10">
            <div>
              <h2 className="mb-4 text-xl font-black !text-zinc-900 tracking-tight">Próximo evento</h2>
              <button
                onClick={() => navigate('/ingressos', { state: { eventoId: destaque.id } })}
                className="group block w-full overflow-hidden rounded-3xl bg-black text-left shadow-md relative"
              >
                <div className="relative h-56 w-full sm:h-72">
                  <img
                    src={destaque.linkImagem || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7'}
                    alt=""
                    style={{ objectFit: destaque.estiloEnquadramento || 'cover' }}
                    className="h-full w-full opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                  
                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                    <p className="mb-1.5 text-xs font-bold tracking-wide text-white drop-shadow-md">
                      {new Date(destaque.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
                      {' · '}
                      {new Date(destaque.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-white drop-shadow-lg">
                      {destaque.nome}
                    </h1>
                    {destaque.local && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white drop-shadow-md">
                        <MapPin className="h-3.5 w-3.5" /> {destaque.local}
                      </p>
                    )}
                    <span className="mt-4 inline-flex items-center rounded-full bg-white px-5 py-2 text-xs font-black !text-zinc-900 transition group-hover:bg-zinc-200 shadow-lg">
                      Ver ingressos
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {proximos.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-4 text-xl font-black !text-zinc-900 tracking-tight">Mais eventos</h2>
                <div className="divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
                  {proximos.map((evento) => {
                    const data = new Date(evento.data);
                    return (
                      <button
                        key={evento.id}
                        onClick={() => navigate('/ingressos', { state: { eventoId: evento.id } })}
                        className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-zinc-50"
                      >
                        <img
                          src={evento.linkImagem || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7'}
                          alt=""
                          loading="lazy"
                          style={{ objectFit: evento.estiloEnquadramento || 'cover' }}
                          className="h-16 w-16 flex-shrink-0 rounded-2xl border border-zinc-100 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black !text-zinc-900 text-lg">{evento.nome}</p>
                          <p className="truncate text-sm font-bold text-zinc-500 mt-0.5">
                            {data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            {evento.local ? ` · ${evento.local}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mx-auto mt-16 max-w-5xl px-6 pb-32 pt-10 text-center border-t border-zinc-200/60">
        <p className="text-xs font-bold text-zinc-400">{APP_NAME} · Evento +18 · Documento com foto obrigatório na entrada</p>
      </footer>

      <BottomNav />
    </div>
  );
}