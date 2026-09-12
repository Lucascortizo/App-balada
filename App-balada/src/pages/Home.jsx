import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import { AuthContext } from '../contexts/AuthContext';
import { useComanda } from '../hooks/useComanda';
import {
  User,
  Ticket,
  LogOut,
  ChevronDown,
  Wine,
  ReceiptText,
  ArrowRight,
  MapPin,
  Clock3,
  CalendarDays,
  Sparkles,
} from 'lucide-react';

const APP_NAME = 'Rolê';

const dinheiro = (valor) =>
  `R$ ${(Number(valor) || 0).toFixed(2)}`;

const dataEventoValida = (evento) => {
  if (!evento?.data) return false;
  const data = new Date(evento.data).getTime();
  return Number.isFinite(data) && data > 0;
};

const eventoDisponivelNaHome = (evento) => {
  if (!dataEventoValida(evento)) return false;

  const data = new Date(evento.data).getTime();
  const agora = Date.now();

  return (
    data >= agora - 24 * 60 * 60 * 1000 &&
    evento.status !== 'encerrado' &&
    evento.status !== 'cancelado'
  );
};

const menorPrecoEvento = (evento) => {
  if (evento?.vendaIngressosOnline === false) return null;

  const ingressos = evento?.ingressos || [];

  const precos = ingressos.flatMap((ingresso) => {
    if (ingresso.tipoPreco === 'separado') {
      return [
        Number(ingresso.precoFem),
        Number(ingresso.precoMasc),
      ];
    }

    return [Number(ingresso.preco)];
  }).filter((preco) => Number.isFinite(preco) && preco > 0);

  if (!precos.length) {
    const legado = Number(evento?.precoPista);
    return Number.isFinite(legado) && legado > 0
      ? legado
      : null;
  }

  return Math.min(...precos);
};

const dataCurta = (data) => {
  if (!data) return '';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).replace('.', '');
};

const horaEvento = (data) => {
  if (!data) return '';
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

function CardEvento({ evento, destaque = false, onAbrir }) {
  const preco = menorPrecoEvento(evento);
  const vendaOnline = evento.vendaIngressosOnline !== false;

  return (
    <button
      type="button"
      onClick={() => onAbrir(evento)}
      className={`group w-full overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-500/40 active:scale-[0.99] ${
        destaque ? 'shadow-[0_20px_60px_rgba(0,0,0,0.35)]' : ''
      }`}
    >
      <div className={`${destaque ? 'h-64 sm:h-80' : 'h-44'} relative overflow-hidden`}>
        <img
          src={
            evento.linkImagem ||
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7'
          }
          alt={evento.nome || 'Evento'}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
            {dataCurta(evento.data)}
          </span>

          {!vendaOnline && (
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 backdrop-blur">
              Portaria
            </span>
          )}
        </div>

        <div className="absolute bottom-5 left-5 right-5">
          <h3 className={`${destaque ? 'text-3xl sm:text-4xl' : 'text-xl'} font-black leading-tight text-white`}>
            {evento.nome}
          </h3>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-zinc-300">
            {evento.local && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {evento.local}
              </span>
            )}

            {evento.data && (
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                {horaEvento(evento.data)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          {vendaOnline && preco !== null ? (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                A partir de
              </p>
              <p className="mt-0.5 text-xl font-black text-white">
                {dinheiro(preco)}
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Ingressos
              </p>
              <p className="mt-0.5 text-sm font-black text-amber-300">
                Venda na portaria
              </p>
            </>
          )}
        </div>

        <span className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-zinc-900 transition group-hover:bg-indigo-500 group-hover:text-white">
          Ver evento
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

export default function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const menuRef = useRef(null);

  const {
    comandasProcessadas = [],
    cobrancasPendentes = [],
    carregando: carregandoComanda,
  } = useComanda(user);

  const comandaAtiva = comandasProcessadas.find(
    (comanda) =>
      comanda.isNoEvento &&
      !comanda.isHistorico
  ) || null;

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'eventos'),
      (snapshot) => {
        const lista = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setEventos(lista);
      },
      (error) => {
        console.error('Erro ao carregar eventos:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const aoClicarFora = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuAberto(false);
      }
    };

    document.addEventListener('mousedown', aoClicarFora);

    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
    };
  }, []);

  const sair = async () => {
    await logout();
    navigate('/login');
  };

  const abrirEvento = (evento) => {
    navigate('/ingressos', {
      state: {
        eventoId: evento.id,
      },
    });
  };

  const eventosAtuais = eventos
    .filter(eventoDisponivelNaHome)
    .sort(
      (a, b) =>
        new Date(a.data).getTime() -
        new Date(b.data).getTime()
    );

  const destaque = eventosAtuais[0] || null;
  const proximos = eventosAtuais.slice(1, 7);

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 pb-32 text-zinc-50">
        <header className="border-b border-zinc-800/80 bg-zinc-950/95">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
            <span className="text-xl font-black tracking-tight">
              {APP_NAME}
            </span>

            <button
              onClick={() => navigate('/login')}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-black text-zinc-900"
            >
              Entrar
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-6 pt-8">
          <section className="mb-8">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
              Descubra seu próximo rolê
            </p>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Encontre sua próxima noite.
            </h1>

            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-zinc-500">
              Veja os próximos eventos, confira os ingressos disponíveis
              e compre pelo aplicativo quando a venda online estiver ativa.
            </p>
          </section>

          {destaque ? (
            <CardEvento
              evento={destaque}
              destaque
              onAbrir={abrirEvento}
            />
          ) : (
            <section className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
              <CalendarDays className="mx-auto mb-4 h-10 w-10 text-zinc-700" />
              <h2 className="text-xl font-black text-white">
                Nenhum evento próximo
              </h2>
              <p className="mt-2 text-sm font-medium text-zinc-500">
                Novos eventos aparecerão aqui assim que forem publicados.
              </p>
            </section>
          )}

          {proximos.length > 0 && (
            <section className="mt-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    Agenda
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Próximos eventos
                  </h2>
                </div>

                <button
                  onClick={() => navigate('/eventos')}
                  className="text-xs font-black text-indigo-400"
                >
                  Ver todos
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {proximos.map((evento) => (
                  <CardEvento
                    key={evento.id}
                    evento={evento}
                    onAbrir={abrirEvento}
                  />
                ))}
              </div>
            </section>
          )}

          <button
            onClick={() => navigate('/eventos')}
            className="mt-8 flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition hover:border-zinc-700"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                <CalendarDays className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-black text-white">
                  Explorar eventos
                </p>
                <p className="mt-0.5 text-xs font-bold text-zinc-600">
                  Veja toda a programação disponível
                </p>
              </div>
            </div>

            <ArrowRight className="h-5 w-5 text-zinc-600" />
          </button>
        </main>

        <BottomNav />
      </div>
    );
  }

  const nome = user.nome?.split(' ')[0] || 'você';

  const eventoAtivo = comandaAtiva?.festa || null;
  const saldoDevedor = Number(
    comandaAtiva?.saldoDevedor || 0
  );

  const totalConsumacao = Number(
    comandaAtiva?.totalConsumacao || 0
  );

  const totalBar = Number(
    comandaAtiva?.totalBar || 0
  );

  const consumacaoRestante = Math.max(
    0,
    totalConsumacao - totalBar
  );

  const percentualConsumacao =
    totalConsumacao > 0
      ? Math.min(
          100,
          (Math.min(totalBar, totalConsumacao) /
            totalConsumacao) *
            100
        )
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 pb-32 text-zinc-50">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
              {APP_NAME}
            </p>

            <p className="text-base font-black text-white">
              Olá, {nome} 👋
            </p>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() =>
                setMenuAberto((aberto) => !aberto)
              }
              className="flex items-center gap-2 rounded-full px-1 py-1 transition hover:bg-zinc-800/70"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                {user.nome
                  ? user.nome.charAt(0).toUpperCase()
                  : <User className="h-4 w-4" />}
              </span>

              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition-transform ${
                  menuAberto ? 'rotate-180' : ''
                }`}
              />
            </button>

            {menuAberto && (
              <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
                <div className="border-b border-zinc-800 px-5 py-4">
                  <p className="truncate font-bold text-white">
                    {user.nome || 'Sua conta'}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {user.email}
                  </p>
                </div>

                <div className="space-y-1 p-2">
                  <button
                    onClick={() => {
                      setMenuAberto(false);
                      navigate('/meus-ingressos');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    <Ticket className="h-4 w-4 text-indigo-400" />
                    Meus ingressos
                  </button>

                  <button
                    onClick={() => {
                      setMenuAberto(false);
                      navigate('/meus-dados');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    <User className="h-4 w-4 text-indigo-400" />
                    Meu perfil
                  </button>

                  <button
                    onClick={() => {
                      setMenuAberto(false);
                      sair();
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pt-7">
        {carregandoComanda ? (
          <div className="space-y-4">
            <div className="h-52 animate-pulse rounded-[2rem] bg-zinc-900" />
            <div className="h-24 animate-pulse rounded-[2rem] bg-zinc-900" />
          </div>
        ) : comandaAtiva && eventoAtivo ? (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-[2rem] border border-indigo-500/30 bg-gradient-to-br from-indigo-950/80 via-zinc-900 to-zinc-900 shadow-[0_20px_60px_rgba(79,70,229,0.12)]">
              <div className="p-7">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Você está no evento
                  </span>

                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Comanda digital
                  </span>
                </div>

                <h1 className="text-3xl font-black tracking-tight text-white">
                  {eventoAtivo.nome}
                </h1>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="mb-2 flex items-center gap-2 text-zinc-500">
                      <Clock3 className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Evento
                      </span>
                    </div>

                    <p className="text-sm font-black text-white">
                      {eventoAtivo.data
                        ? new Date(eventoAtivo.data).toLocaleString(
                            'pt-BR',
                            {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )
                        : 'Agora'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="mb-2 flex items-center gap-2 text-zinc-500">
                      <MapPin className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Local
                      </span>
                    </div>

                    <p className="truncate text-sm font-black text-white">
                      {eventoAtivo.local || 'Local do evento'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    navigate('/minha-conta')
                  }
                  className="mt-5 flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-left text-zinc-900 transition active:scale-[0.99] hover:bg-zinc-100"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Comanda
                    </p>

                    <p className="mt-0.5 text-lg font-black">
                      {dinheiro(saldoDevedor)}
                    </p>

                    <p className="text-xs font-bold text-zinc-500">
                      {saldoDevedor > 0
                        ? 'saldo em aberto'
                        : 'conta quitada'}
                    </p>
                  </div>

                  <ArrowRight className="h-5 w-5 text-zinc-500" />
                </button>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  navigate('/cardapio', {
                    state: {
                      eventoId:
                        comandaAtiva.eventoId,
                    },
                  })
                }
                className="rounded-2xl border border-indigo-500/20 bg-indigo-600 p-5 text-left text-white transition hover:bg-indigo-500 active:scale-[0.99]"
              >
                <Wine className="mb-7 h-5 w-5" />

                <p className="text-base font-black">
                  Pedir no Bar
                </p>

                <p className="mt-1 text-xs font-medium text-indigo-200">
                  Faça seu pedido pelo app
                </p>
              </button>

              <button
                onClick={() =>
                  navigate('/minha-conta')
                }
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left text-white transition hover:border-zinc-700 active:scale-[0.99]"
              >
                <ReceiptText className="mb-7 h-5 w-5 text-zinc-400" />

                <p className="text-base font-black">
                  Ver consumo
                </p>

                <p className="mt-1 text-xs font-medium text-zinc-500">
                  Pedidos, racha e pagamento
                </p>
              </button>
            </div>

            <section className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Consumação
                  </p>

                  <p className="mt-1 text-2xl font-black text-white">
                    {dinheiro(consumacaoRestante)}
                  </p>

                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    disponível para consumir
                  </p>
                </div>

                <p className="text-sm font-black text-zinc-400">
                  {dinheiro(totalConsumacao)} total
                </p>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    consumacaoRestante > 0
                      ? 'bg-emerald-500'
                      : 'bg-zinc-500'
                  }`}
                  style={{
                    width: `${percentualConsumacao}%`,
                  }}
                />
              </div>
            </section>

            {cobrancasPendentes.length > 0 && (
              <button
                onClick={() =>
                  navigate('/minha-conta')
                }
                className="flex w-full items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-left"
              >
                <div>
                  <p className="text-sm font-black text-amber-300">
                    Você tem racha pendente
                  </p>

                  <p className="mt-1 text-xs font-bold text-amber-400/70">
                    Toque para responder
                  </p>
                </div>

                <ArrowRight className="h-5 w-5 text-amber-400" />
              </button>
            )}
          </div>
        ) : (
          <div>
            <section className="mb-8">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                Olá, {nome}
              </p>

              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Qual vai ser seu próximo rolê?
              </h1>

              <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-zinc-500">
                Explore os próximos eventos e garanta seu ingresso pelo app.
              </p>
            </section>

            {destaque ? (
              <>
                <section className="mb-10">
                  <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                        Destaque
                      </p>

                      <h2 className="mt-1 text-2xl font-black text-white">
                        Próximo evento
                      </h2>
                    </div>
                  </div>

                  <CardEvento
                    evento={destaque}
                    destaque
                    onAbrir={abrirEvento}
                  />
                </section>

                {proximos.length > 0 && (
                  <section>
                    <div className="mb-5 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                          Agenda
                        </p>

                        <h2 className="mt-1 text-2xl font-black text-white">
                          Próximos eventos
                        </h2>
                      </div>

                      <button
                        onClick={() =>
                          navigate('/eventos')
                        }
                        className="text-xs font-black text-indigo-400"
                      >
                        Ver todos
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {proximos.map((evento) => (
                        <CardEvento
                          key={evento.id}
                          evento={evento}
                          onAbrir={abrirEvento}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <section className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
                <CalendarDays className="mx-auto mb-4 h-10 w-10 text-zinc-700" />

                <h2 className="text-xl font-black text-white">
                  Nenhum evento próximo
                </h2>

                <p className="mt-2 text-sm font-medium text-zinc-500">
                  Assim que uma nova festa for publicada, ela aparecerá aqui.
                </p>
              </section>
            )}

            {eventosAtuais.length > 0 && (
              <button
                onClick={() =>
                  navigate('/eventos')
                }
                className="mt-8 flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition hover:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-sm font-black text-white">
                      Ver toda a programação
                    </p>

                    <p className="mt-0.5 text-xs font-bold text-zinc-600">
                      Explore todos os eventos disponíveis
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-5 w-5 text-zinc-600" />
              </button>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
