import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import BottomNav from '../components/BottomNav';

export default function MinhaConta() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [ingressos, setIngressos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [pedidos, setPedidos] = useState([]); 

  useEffect(() => {
    if (!user) return; 

    const unsubEventos = onSnapshot(collection(db, "eventos"), (snapshot) => {
      setEventosGlobais(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qIngressos = query(collection(db, "ingressos_vendidos"), where("donoId", "==", user.uid));
    const unsubIngressos = onSnapshot(qIngressos, (snapshot) => setIngressos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    const qReservas = query(collection(db, "espacos"), where("donoId", "==", user.uid));
    const unsubReservas = onSnapshot(qReservas, (snapshot) => setReservas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    const qPedidos = query(collection(db, "pedidos"), where("clienteId", "==", user.uid));
    const unsubPedidos = onSnapshot(qPedidos, (snapshot) => setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    return () => { unsubEventos(); unsubIngressos(); unsubReservas(); unsubPedidos(); };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6">
        <span className="text-4xl mb-4 animate-pulse">⏳</span>
        <p className="text-purple-400 font-bold mb-6">Verificando sua conta...</p>
        <button onClick={() => navigate('/login')} className="text-xs bg-gray-800 text-gray-400 px-4 py-2 rounded-full">
          Fazer Login
        </button>
      </div>
    );
  }

  // Descobre em quais eventos o usuário participou
  const IDsDeEventosDoUsuario = Array.from(new Set([
    ...ingressos.map(i => i.eventoId),
    ...reservas.map(r => r.eventoId),
    ...pedidos.map(p => p.eventoId)
  ])).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-6 pb-32">
      <header className="mb-8 flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <p className="text-xs text-gray-400">Minha Conta</p>
          <h1 className="text-xl font-bold text-purple-400">{user.nome || user.email}</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="text-xs bg-gray-800 text-red-400 px-3 py-1.5 rounded-lg hover:bg-gray-700">
          Sair
        </button>
      </header>

      {/* QR CODE UNIVERSAL */}
      <section className="mb-8 flex flex-col items-center justify-center p-6 bg-gray-800 rounded-2xl border border-gray-700 shadow-xl">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">QR Code de Identidade (Portaria / Bar)</p>
        <div className="bg-white p-3 rounded-xl shadow-lg">
          <QRCode value={user?.uid || 'erro'} size={130} />
        </div>
      </section>

      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>🎟️</span> Meus Eventos e Comandas
      </h2>

      {IDsDeEventosDoUsuario.length === 0 ? (
        <div className="text-center p-10 border border-dashed border-gray-700 rounded-2xl bg-gray-800/30">
          <p className="text-gray-400 mb-4">Você ainda não garantiu presença em nenhum evento.</p>
          <button onClick={() => navigate('/home')} className="bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg">
            Explorar Festas
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {IDsDeEventosDoUsuario.map(eventoId => {
            const dadosEvento = eventosGlobais.find(e => e.id === eventoId);
            const nomeFesta = dadosEvento ? dadosEvento.nome : "Evento Especial";
            
            const ingressosDestaFesta = ingressos.filter(i => i.eventoId === eventoId);
            const reservasDestaFesta = reservas.filter(r => r.eventoId === eventoId);
            const pedidosDestaFesta = pedidos.filter(p => p.eventoId === eventoId);

            const totalVIP = reservasDestaFesta.reduce((acc, r) => acc + (Number(r.consumacao)||0), 0);
            const totalBar = pedidosDestaFesta.reduce((acc, p) => acc + (Number(p.total)||0), 0);
            const aPagar = Math.max(0, totalBar - totalVIP);

            return (
              <div key={eventoId} className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{nomeFesta}</h3>
                    <p className="text-xs text-purple-400 mt-0.5">Acesso Liberado</p>
                  </div>
                  {/* BOTÃO DIRETO PARA O CARDÁPIO DAQUELA FESTA */}
                  <button 
                    onClick={() => navigate('/cardapio', { state: { eventoId } })}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition active:scale-95 flex items-center gap-1"
                  >
                    <span>🍻</span> Abrir Bar
                  </button>
                </div>

                {/* RESUMO DA COMANDA DESTA FESTA */}
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 mb-4 text-sm space-y-2">
                  <div className="flex justify-between text-gray-400">
                    <span>Consumação VIP:</span>
                    <span className="text-green-400">+ R$ {totalVIP.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 border-b border-gray-800 pb-2">
                    <span>Gasto no Bar:</span>
                    <span className="text-red-400">- R$ {totalBar.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-1">
                    <span>Total a Pagar na Saída:</span>
                    <span className="text-white">R$ {aPagar.toFixed(2)}</span>
                  </div>
                </div>

                {/* LISTA DE ITENS */}
                <div className="text-xs text-gray-400 space-y-1">
                  {ingressosDestaFesta.length > 0 && <p>✓ {ingressosDestaFesta.length} Ingresso(s) Pista</p>}
                  {reservasDestaFesta.map(r => (
                    <p key={r.id}>✓ {r.tipo} ({r.sigla}) - Garantido</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
      <BottomNav />
    </div>
  );
}