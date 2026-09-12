import { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthContext } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Crown, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function ConviteVIP() {
  const { user, loading: loadingAuth } = useContext(AuthContext);
  const { espacoId, token } = useParams();
  const navigate = useNavigate();
  const [espaco, setEspaco] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      navigate('/login', { replace: true, state: { returnTo: `/convite/vip/${espacoId}/${token}` } });
      return;
    }

    const carregar = async () => {
      try {
        const snap = await getDoc(doc(db, 'espacos', espacoId));
        if (!snap.exists()) throw new Error('Camarote não encontrado.');

        const dados = snap.data();
        if (dados.status !== 'reservado') throw new Error('Este camarote não está mais reservado.');
        if (!dados.vipInvite || dados.vipInvite.status !== 'pendente' || dados.vipInvite.token !== token) {
          throw new Error('Este convite não é mais válido.');
        }

        const emailDestino = String(dados.vipInvite.paraEmail || '').trim().toLowerCase();
        const emailAtual = String(user.email || '').trim().toLowerCase();
        if (emailDestino && emailDestino !== emailAtual) {
          throw new Error(`Este convite foi enviado para ${dados.vipInvite.paraEmail}.`);
        }

        setEspaco({ id: snap.id, ...dados });
      } catch (error) {
        console.error('Erro ao carregar convite VIP:', error);
        setErro(error.message || 'Convite inválido.');
      } finally {
        setCarregando(false);
      }
    };

    carregar();
  }, [loadingAuth, user, espacoId, token, navigate]);

  const aceitarConvite = async () => {
    if (!espaco || !user) return;
    setProcessando(true);

    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, 'espacos', espacoId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error('Camarote não encontrado.');

        const atual = snap.data();
        if (atual.status !== 'reservado') throw new Error('Este camarote não está mais reservado.');
        if (atual.vipInvite?.status !== 'pendente' || atual.vipInvite?.token !== token) {
          throw new Error('Este convite já foi utilizado ou expirou.');
        }

        const emailDestino = String(atual.vipInvite?.paraEmail || '').trim().toLowerCase();
        const emailAtual = String(user.email || '').trim().toLowerCase();
        if (emailDestino && emailDestino !== emailAtual) {
          throw new Error(`Este convite foi enviado para ${atual.vipInvite.paraEmail}.`);
        }

        const convidados = Array.isArray(atual.convidados) ? atual.convidados : [];
        const convidadosIds = Array.isArray(atual.convidadosIds) ? atual.convidadosIds : [];
        if (atual.donoId === user.uid || convidadosIds.includes(user.uid)) {
          throw new Error('Você já faz parte deste camarote.');
        }

        const capacidade = Number(atual.capacidade) || 1;
        if (1 + convidadosIds.length >= capacidade) {
          throw new Error('A capacidade deste camarote já foi atingida.');
        }

        const convidado = {
          uid: user.uid,
          nome: user.nome || user.email || 'Convidado',
          email: user.email || '',
        };

        transaction.update(ref, {
          convidados: [...convidados, convidado],
          convidadosIds: [...convidadosIds, user.uid],
          vipInvite: {
            ...atual.vipInvite,
            status: 'aceito',
            aceitoEm: new Date().toISOString(),
            aceitoPor: user.uid,
          },
        });
      });

      toast.success('Você entrou na lista VIP!');
      navigate('/meus-ingressos', { replace: true });
    } catch (error) {
      console.error('Erro ao aceitar convite VIP:', error);
      toast.error(error.message || 'Não foi possível aceitar o convite.');
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
          <Crown className="w-8 h-8" />
        </div>

        {erro ? (
          <>
            <h1 className="text-2xl font-black mb-2">Convite indisponível</h1>
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
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-black">Convite VIP</p>
            <h1 className="text-3xl font-black mt-2">Você foi convidado</h1>
            <p className="text-zinc-400 mt-3 font-medium">
              Você foi convidado para entrar na lista VIP do camarote <b className="text-white">{espaco?.sigla}</b>.
            </p>
            <div className="mt-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-black">Capacidade</p>
              <p className="text-xl font-black mt-1">{espaco?.capacidade || 1} pessoas</p>
            </div>
            <button
              onClick={aceitarConvite}
              disabled={processando}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2"
            >
              {processando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Entrar na lista VIP
            </button>
          </>
        )}
      </div>
    </div>
  );
}
