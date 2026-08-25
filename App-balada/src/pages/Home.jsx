import { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';

export default function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("data", "asc"));
    const unsub = onSnapshot(q, (snapshot) => {
      setEventos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const gerenciarAutenticacao = async () => {
    if (user) { await logout(); navigate('/login'); } 
    else { navigate('/login'); }
  };

  const abrirComanda = (eventoId) => {
    if (!user) {
      alert("Faça login para acessar o bar deste evento.");
      navigate('/login');
    } else {
      navigate('/cardapio', { state: { eventoId } });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-6 pb-24">
      <header className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
        <div>
          <p className="text-sm text-gray-400">Bem-vindo,</p>
          <h1 onClick={() => user && navigate('/minha-conta')} className="text-xl font-bold text-purple-400 cursor-pointer hover:text-purple-300">
            {user ? (user.nome || user.email.split('@')[0]) : "Visitante 👻"}
          </h1>
        </div>
        <button onClick={gerenciarAutenticacao} className="text-xs bg-gray-800 text-gray-400 px-4 py-2 rounded-full hover:bg-gray-700 transition">
          {user ? 'Sair' : 'Entrar'}
        </button>
      </header>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🔥</span>
        <h2 className="text-xl font-bold">Eventos Disponíveis</h2>
      </div>

      <div className="space-y-6">
        {eventos.map(evento => {
          const dataEvento = new Date(evento.data);
          return (
            <div key={evento.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 shadow-xl">
              <div className="h-48 relative">
                <img src={evento.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7"} alt={evento.nome} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
                <div className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg p-2 text-center min-w-[60px]">
                  <p className="text-xs text-purple-400 font-bold uppercase">{dataEvento.toLocaleDateString('pt-BR', { month: 'short' })}</p>
                  <p className="text-xl font-bold">{dataEvento.getDate()}</p>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-2xl font-bold text-white mb-1">{evento.nome}</h3>
                  <p className="text-sm text-gray-300">{dataEvento.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>

              <div className="p-5">
                <p className="text-sm text-gray-400 mb-4 line-clamp-2">{evento.descricao}</p>
                
                <div className="grid grid-cols-2 gap-3 border-t border-gray-700 pt-4">
                  <button onClick={() => navigate('/ingressos', { state: { eventoId: evento.id } })} className="bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold shadow-lg transition active:scale-95 text-sm">
                    🎟️ Ingressos
                  </button>
                  {/* O Botão de Comanda agora passa o ID do Evento! */}
                  <button onClick={() => abrirComanda(evento.id)} className="bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold shadow-lg transition active:scale-95 text-sm">
                    🍻 Bar / Comanda
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}