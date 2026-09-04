import { useState, useEffect, useContext } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import QRCode from 'react-qr-code';
import BottomNav from '../components/BottomNav';
import { Ticket, MapPin, CalendarDays, QrCode, X, Clock, CheckCircle2, Crown } from 'lucide-react';

export default function Ingressos() {
  const { user } = useContext(AuthContext);
  
  const [eventosGlobais, setEventosGlobais] = useState([]);
  const [ingressos, setIngressos] = useState([]);
  const [espacos, setEspacos] = useState([]); // Camarotes/Mesas VIP
  
  const [abaAtiva, setAbaAtiva] = useState('ativos'); // 'ativos' ou 'historico'
  const [qrModal, setQrModal] = useState(null);

  useEffect(() => {
    if (!user) return;
    
    // Busca os eventos
    const unsubEv = onSnapshot(collection(db, "eventos"), snap => {
      setEventosGlobais(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Busca Ingressos normais (Pista)
    const unsubIng = onSnapshot(query(collection(db, "ingressos_vendidos"), where("donoId", "==", user.uid)), snap => {
      setIngressos(snap.docs.map(d => ({ id: d.id, tipoAcesso: 'ingresso', ...d.data() })));
    });

    // Busca Camarotes/Mesas VIP (Titular)
    const unsubEsp = onSnapshot(query(collection(db, "espacos"), where("donoId", "==", user.uid)), snap => {
      setEspacos(snap.docs.map(d => ({ id: d.id, tipoAcesso: 'espaco', ...d.data() })));
    });

    return () => { unsubEv(); unsubIng(); unsubEsp(); };
  }, [user]);

  // ================= LÓGICA DE TRATAMENTO DE DADOS =================
  // Junta Ingressos e Espaços em uma lista só
  const todosAcessos = [...ingressos, ...espacos];

  const acessosProcessados = todosAcessos.map(item => {
    // RESOLVENDO O BUG DOS FANTASMAS: Acha o evento. Se o Admin deletou a festa, isso retorna null.
    const festa = eventosGlobais.find(e => e.id === item.eventoId);
    if (!festa) return null; // Ignora ingressos de festas apagadas

    // Verifica se a festa já passou (mais de 24h da data oficial)
    const eventoPassou = (Date.now() - new Date(festa.data).getTime()) > (24 * 60 * 60 * 1000);
    
    // Verifica se ele já usou tudo e foi embora
    const jaSaiu = item.status === 'saiu' || item.status === 'encerrado';
    
    // Vai para o Histórico se a festa acabou OU se ele já bateu o passe de saída
    const isHistorico = eventoPassou || jaSaiu;

    return { ...item, festa, isHistorico };
  }).filter(item => item !== null); // Remove os fantasmas nulos da lista

  // Separa as listas para as abas
  const acessosAtivos = acessosProcessados.filter(i => !i.isHistorico).sort((a, b) => new Date(a.festa.data) - new Date(b.festa.data));
  const acessosHistorico = acessosProcessados.filter(i => i.isHistorico).sort((a, b) => new Date(b.festa.data) - new Date(a.festa.data));

  const listaExibida = abaAtiva === 'ativos' ? acessosAtivos : acessosHistorico;

  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 pb-32">
      <header className="pt-10 pb-6 px-6 max-w-md mx-auto">
        <h1 className="text-3xl font-black tracking-tight !text-zinc-900">Meus Ingressos</h1>
      </header>

      <main className="px-6 max-w-md mx-auto space-y-6">
        
        {/* ================= ABAS DE NAVEGAÇÃO ================= */}
        <div className="flex bg-zinc-100 p-1.5 rounded-2xl shadow-inner">
          <button 
            onClick={() => setAbaAtiva('ativos')} 
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${abaAtiva === 'ativos' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Disponíveis
          </button>
          <button 
            onClick={() => setAbaAtiva('historico')} 
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 ${abaAtiva === 'historico' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Histórico
          </button>
        </div>

        {/* ================= ESTADO VAZIO ================= */}
        {listaExibida.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-zinc-300 rounded-[2rem] shadow-sm animate-fade-in">
            {abaAtiva === 'ativos' ? (
              <>
                <Ticket className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Nenhum ingresso ativo</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Explore os próximos eventos e garanta o seu.</p>
              </>
            ) : (
              <>
                <Clock className="w-10 h-10 mx-auto mb-4 text-zinc-300" />
                <h3 className="text-lg font-black text-zinc-800">Sem histórico</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Você ainda não curtiu nenhuma festa conosco.</p>
              </>
            )}
          </div>
        ) : (
          
          /* ================= LISTA DE INGRESSOS ================= */
          <div className="space-y-6 animate-fade-in">
            {listaExibida.map((acesso, index) => {
              const isVIP = acesso.tipoAcesso === 'espaco';
              const jaUsou = acesso.status === 'usado' || acesso.checkinFeito;

              return (
                <div key={`${acesso.id}-${index}`} className={`rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col transition-all ${acesso.isHistorico ? 'bg-zinc-50 opacity-90 grayscale-[0.3]' : 'bg-white'}`}>
                  
                  {/* Capa e Título */}
                  <div className="h-32 relative bg-zinc-900 flex-shrink-0">
                    <img 
                      src={acesso.festa.linkImagem || "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7"} 
                      className="w-full h-full object-cover opacity-60" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent"></div>
                    
                    {acesso.isHistorico && (
                      <span className="absolute top-4 right-4 bg-zinc-800/80 backdrop-blur-sm text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded text-zinc-300 border border-zinc-600">
                        Expirado / Usado
                      </span>
                    )}

                    <div className="absolute bottom-4 left-5 right-5">
                      <h3 className="font-black text-xl text-white truncate">{acesso.festa.nome}</h3>
                    </div>
                  </div>

                  {/* Informações do Ingresso */}
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-6 border-b border-zinc-100 pb-5">
                      <div>
                        <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-1">Tipo de Acesso</p>
                        {isVIP ? (
                          <p className="font-black text-lg text-indigo-600 flex items-center gap-1.5"><Crown className="w-4 h-4"/> {acesso.sigla} ({acesso.tipo})</p>
                        ) : (
                          <p className="font-black text-lg !text-zinc-900 flex items-center gap-1.5"><Ticket className="w-4 h-4 text-zinc-400"/> Pista - {acesso.nome}</p>
                        )}
                        <p className="text-xs font-bold text-zinc-500 mt-1 uppercase">{acesso.donoNome}</p>
                      </div>
                      
                      {!acesso.isHistorico && jaUsou && (
                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] uppercase font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3"/> Na Casa
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Data</p>
                          <p className="text-sm font-bold !text-zinc-900">{new Date(acesso.festa.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Local</p>
                          <p className="text-sm font-bold !text-zinc-900">{acesso.festa.local || 'Local não informado'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Botão de QR Code (Só aparece se estiver Ativo) */}
                    {!acesso.isHistorico && (
                      <button 
                        onClick={() => setQrModal(acesso)} 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase tracking-widest text-xs transition-colors shadow-md active:scale-95"
                      >
                        <QrCode className="w-5 h-5"/> Exibir Ingresso
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ================= MODAL DO QR CODE ================= */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/90 backdrop-blur-md p-6 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
            
            <div className="bg-zinc-900 p-6 text-center relative">
              <button onClick={() => setQrModal(null)} className="absolute top-6 right-6 text-zinc-400 hover:text-white transition">
                <X className="w-5 h-5"/>
              </button>
              <h2 className="text-xl font-black text-white mb-1">{qrModal.festa.nome}</h2>
              {qrModal.tipoAcesso === 'espaco' ? (
                <p className="text-indigo-400 font-black text-sm flex items-center justify-center gap-1"><Crown className="w-4 h-4"/> {qrModal.sigla} VIP</p>
              ) : (
                <p className="text-zinc-400 font-bold text-sm uppercase tracking-widest">{qrModal.nome}</p>
              )}
            </div>

            <div className="p-8 flex flex-col items-center bg-zinc-50 relative">
              {/* Efeito de Ticket picotado */}
              <div className="absolute top-0 left-0 w-full flex justify-between -mt-3 px-4 opacity-50">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="w-3 h-3 bg-zinc-900 rounded-full"></div>)}
              </div>

              <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-6">Apresente na Portaria</p>
              
              <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm mb-8">
                <QRCode 
                  value={`${qrModal.tipoAcesso}|${qrModal.id}|${user.uid}`} 
                  size={200} 
                  level="H"
                />
              </div>

              <div className="w-full text-center border-t border-zinc-200 pt-6">
                <p className="text-xs font-bold text-zinc-500 uppercase">{qrModal.donoNome}</p>
                <p className="text-[10px] text-zinc-400 mt-1 font-mono">{qrModal.id}</p>
              </div>
            </div>
            
            <div className="p-4 bg-white">
              <button onClick={() => setQrModal(null)} className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}