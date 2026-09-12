import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { CheckCircle2, AlertTriangle, Loader2, Send } from 'lucide-react';

export default function ConviteTransferencia() {
  const { itemId, token } = useParams();
  const { user, loading: loadingAuth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const colecao = 'ingressos_vendidos';

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      navigate('/login', { replace: true, state: { returnTo: `/convite/transferencia/${itemId}/${token}` } });
      return;
    }

    const carregar = async () => {
      try {
        const snap = await getDoc(doc(db, colecao, itemId));
        if (!snap.exists()) throw new Error('Item não encontrado.');
        const dados = snap.data();
        const transferencia = dados.transferencia;

        if (!transferencia || transferencia.status !== 'pendente' || transferencia.token !== token) {
          throw new Error('Esta transferência não está mais disponível.');
        }

        const emailDestino = String(transferencia.paraEmail || '').trim().toLowerCase();
        const emailAtual = String(user.email || '').trim().toLowerCase();
        if (emailDestino && emailDestino !== emailAtual) {
          throw new Error(`Esta transferência foi enviada para ${transferencia.paraEmail}.`);
        }

        if (['usado', 'saiu', 'encerrado', 'cancelado', 'estornado'].includes(dados.status)) {
          throw new Error('Este ingresso não pode mais ser transferido.');
        }

        setItem({ id: snap.id, ...dados });
      } catch (error) {
        console.error('Erro ao carregar transferência:', error);
        setErro(error.message || 'Transferência inválida.');
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [loadingAuth, user, itemId, token, navigate]);

  const aceitarTransferencia = async () => {
    if (!item || !user) return;
    setProcessando(true);

    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, colecao, itemId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error('Item não encontrado.');

        const atual = snap.data();
        const transferencia = atual.transferencia;
        const emailDestino = String(transferencia?.paraEmail || '').trim().toLowerCase();
        const emailAtual = String(user.email || '').trim().toLowerCase();

        if (!transferencia || transferencia.status !== 'pendente' || transferencia.token !== token) {
          throw new Error('Esta transferência já foi utilizada ou cancelada.');
        }
        if (emailDestino && emailDestino !== emailAtual) {
          throw new Error(`Esta transferência foi enviada para ${transferencia.paraEmail}.`);
        }
        if (['usado', 'saiu', 'encerrado', 'cancelado', 'estornado'].includes(atual.status)) {
          throw new Error('Este ingresso não pode mais ser transferido.');
        }

        transaction.update(ref, {
          donoId: user.uid,
          donoNome: user.nome || user.email,
          transferencia: {
            ...transferencia,
            status: 'aceita',
            aceitaEm: new Date().toISOString(),
            aceitaPor: user.uid,
          },
        });
      });

      toast.success('Ingresso transferido para você!');
      navigate('/meus-ingressos', { replace: true });
    } catch (error) {
      console.error('Erro ao aceitar transferência:', error);
      toast.error(error.message || 'Não foi possível aceitar a transferência.');
    } finally {
      setProcessando(false);
    }
  };

  if (loadingAuth || carregando) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-[2rem] p-7 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
          <Send className="w-8 h-8" />
        </div>

        {erro ? (
          <>
            <h1 className="text-2xl font-black mb-2">Transferência indisponível</h1>
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl p-4 flex gap-3 text-sm font-bold">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{erro}</span>
            </div>
            <button onClick={() => navigate('/home')} className="w-full mt-6 bg-white text-zinc-900 font-black py-4 rounded-2xl">
              Voltar para o início
            </button>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-black">Transferência</p>
            <h1 className="text-3xl font-black mt-2">Receber ingresso</h1>
            <p className="text-zinc-400 mt-3 font-medium">
              Este link transfere a titularidade do ingresso para a sua conta.
            </p>
            <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Titular atual</p>
              <p className="text-xl font-black mt-1">{item?.donoNome || 'Cliente'}</p>
            </div>
            <button
              onClick={aceitarTransferencia}
              disabled={processando}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              {processando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Aceitar transferência
            </button>
          </>
        )}
      </div>
    </div>
  );
}
