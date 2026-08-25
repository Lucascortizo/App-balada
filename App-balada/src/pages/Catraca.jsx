import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Catraca() {
  const [status, setStatus] = useState('aguardando'); // aguardando, validando, sucesso, erro
  const [mensagem, setMensagem] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const eventoId = location.state?.eventoId;

  if (!eventoId) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white gap-4">
        <p className="text-red-400 font-bold">Nenhum evento selecionado para a portaria.</p>
        <button onClick={() => navigate('/admin')} className="bg-purple-600 px-4 py-2 rounded-lg font-bold">
          Voltar ao Admin
        </button>
      </div>
    );
  }

  const resetar = (delay = 3000) => {
    setTimeout(() => {
      setStatus('aguardando');
      setMensagem('');
    }, delay);
  };

  const aoLerCodigo = async (codigos) => {
    if (status !== 'aguardando') return;
    const uidCliente = codigos[0]?.rawValue;
    if (!uidCliente) return;

    setStatus('validando');

    try {
      // 1. Procura ingresso de pista válido e não utilizado para ESTE evento
      const qIngresso = query(
        collection(db, 'ingressos_vendidos'),
        where('donoId', '==', uidCliente),
        where('eventoId', '==', eventoId),
        where('status', '==', 'valido')
      );
      const snapIngresso = await getDocs(qIngresso);

      if (!snapIngresso.empty) {
        const ingressoDoc = snapIngresso.docs[0];
        await updateDoc(doc(db, 'ingressos_vendidos', ingressoDoc.id), {
          status: 'usado',
          checkinEm: new Date().toISOString(),
        });
        setMensagem('Pista — acesso liberado');
        setStatus('sucesso');
        resetar();
        return;
      }

      // 2. Procura espaço VIP (camarote/bistrô/lounge) reservado por essa pessoa neste evento
      const qEspaco = query(
        collection(db, 'espacos'),
        where('donoId', '==', uidCliente),
        where('eventoId', '==', eventoId),
        where('status', '==', 'reservado')
      );
      const snapEspaco = await getDocs(qEspaco);

      if (!snapEspaco.empty) {
        const espaco = snapEspaco.docs[0].data();
        setMensagem(`${espaco.sigla} — acesso liberado`);
        setStatus('sucesso');
        resetar();
        return;
      }

      // 3. Nada encontrado: ingresso inválido, já usado, ou de outro evento
      setMensagem('Ingresso não encontrado ou já utilizado para este evento');
      setStatus('erro');
      resetar(2500);
    } catch (error) {
      console.error(error);
      setMensagem('Erro ao validar. Tente novamente.');
      setStatus('erro');
      resetar(2500);
    }
  };

  const corFundo =
    status === 'sucesso' ? 'bg-green-600' : status === 'erro' ? 'bg-red-600' : 'bg-gray-900';

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans transition-colors duration-500 ${corFundo}`}>
      <div className="w-full max-w-md bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-gray-700">
        <header className="p-5 bg-gray-900 text-center border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white">Controle de Portaria</h1>
          <p className="text-gray-400">Aponte para o ingresso do cliente</p>
        </header>

        <div className="relative bg-black aspect-square">
          {status === 'aguardando' ? (
            <Scanner
              onScan={aoLerCodigo}
              onError={(error) => console.log(error)}
              formats={['qr_code']}
              components={{ audio: false, finder: false }}
              styles={{ container: { width: '100%', height: '100%' } }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
              <span className="text-7xl mb-4">
                {status === 'validando' ? '⏳' : status === 'sucesso' ? '✅' : '⛔'}
              </span>
              <h2 className="text-2xl font-bold text-white tracking-widest uppercase text-center px-4">
                {status === 'validando' ? 'Validando...' : status === 'sucesso' ? 'Liberado' : 'Negado'}
              </h2>
            </div>
          )}
          {status === 'aguardando' && (
            <div className="absolute inset-0 border-[40px] border-black/50 flex items-center justify-center">
              <div className="w-full h-full border-2 border-purple-500 rounded-lg"></div>
            </div>
          )}
        </div>

        <div className="p-6 text-center">
          {status === 'aguardando' ? (
            <p className="text-gray-400 animate-pulse">Aguardando leitura...</p>
          ) : (
            <p className={status === 'sucesso' ? 'text-green-400 font-bold' : 'text-red-300 font-bold'}>
              {mensagem}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}