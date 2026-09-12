import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import BottomNav from '../components/BottomNav';
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  MapPin,
  Ticket,
  Search,
  Store,
} from 'lucide-react';

const dataEventoValida = (evento) => {
  if (!evento?.data) return false;
  const time = new Date(evento.data).getTime();
  return Number.isFinite(time);
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

const dataFormatada = (data) => {
  if (!data) return '';

  return new Date(data).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).replace('.', '');
};

const horaFormatada = (data) => {
  if (!data) return '';

  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const valor = (numero) =>
  `R$ ${(Number(numero) || 0).toFixed(2)}`;

export default function Eventos() {
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('proximos');

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'eventos'),
      (snapshot) => {
        setEventos(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      },
      (error) => {
        console.error('Erro ao carregar eventos:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const eventosFiltrados = useMemo(() => {
    const agora = Date.now();
    const termo = busca.trim().toLowerCase();

    let lista = eventos
      .filter(dataEventoValida)
      .filter(
        (evento) =>
          evento.status !== 'encerrado' &&
          evento.status !== 'cancelado'
      )
      .filter((evento) => {
        if (!termo) return true;

        return [
          evento.nome,
          evento.local,
          evento.descricao,
        ]
          .filter(Boolean)
          .some((valorTexto) =>
            String(valorTexto)
              .toLowerCase()
              .includes(termo)
          );
      });

    if (filtro === 'proximos') {
      lista = lista.filter(
        (evento) =>
          new Date(evento.data).getTime() >=
          agora - 24 * 60 * 60 * 1000
      );
    }

    if (filtro === 'online') {
      lista = lista.filter(
        (evento) =>
          evento.vendaIngressosOnline !== false
      );
    }

    return lista.sort(
      (a, b) =>
        new Date(a.data).getTime() -
        new Date(b.data).getTime()
    );
  }, [eventos, busca, filtro]);

  const abrirEvento = (evento) => {
    navigate('/ingressos', {
      state: {
        eventoId: evento.id,
      },
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-32 text-zinc-50">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
            Descobrir
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Eventos
          </h1>

          <div className="relative mt-5">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar evento ou local"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 py-3.5 pl-11 pr-4 text-sm font-bold text-white outline-none transition focus:border-indigo-500"
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ['proximos', 'Próximos'],
              ['online', 'Venda online'],
              ['todos', 'Todos'],
            ].map(([valorFiltro, nome]) => (
              <button
                key={valorFiltro}
                onClick={() => setFiltro(valorFiltro)}
                className={`whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-black transition ${
                  filtro === valorFiltro
                    ? 'bg-indigo-600 text-white'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 pt-7">
        {eventosFiltrados.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
            <CalendarDays className="mx-auto mb-4 h-10 w-10 text-zinc-700" />

            <h2 className="text-xl font-black text-white">
              Nenhum evento encontrado
            </h2>

            <p className="mt-2 text-sm font-medium text-zinc-500">
              Tente outro termo de busca ou altere o filtro.
            </p>
          </section>
        ) : (
          <div className="grid gap-5">
            {eventosFiltrados.map((evento) => {
              const preco = menorPrecoEvento(evento);
              const vendaOnline =
                evento.vendaIngressosOnline !== false;

              return (
                <article
                  key={evento.id}
                  className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => abrirEvento(evento)}
                    className="group w-full text-left"
                  >
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={
                          evento.linkImagem ||
                          'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7'
                        }
                        alt={evento.nome || 'Evento'}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                      <div className="absolute left-5 right-5 top-5 flex items-start justify-between gap-3">
                        <span className="rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white backdrop-blur">
                          {dataFormatada(evento.data)}
                        </span>

                        {!vendaOnline && (
                          <span className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 backdrop-blur">
                            <Store className="h-3.5 w-3.5" />
                            Portaria
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-5 left-5 right-5">
                        <h2 className="text-2xl font-black text-white">
                          {evento.nome}
                        </h2>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-zinc-300">
                          <span className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {horaFormatada(evento.data)}
                          </span>

                          {evento.local && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {evento.local}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-between gap-4 p-5">
                    <div>
                      {vendaOnline && preco !== null ? (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                            Ingressos a partir de
                          </p>

                          <p className="mt-1 text-xl font-black text-white">
                            {valor(preco)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                            Venda
                          </p>

                          <p className="mt-1 text-sm font-black text-amber-300">
                            Na portaria
                          </p>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => abrirEvento(evento)}
                      className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-zinc-900 transition hover:bg-indigo-500 hover:text-white"
                    >
                      {vendaOnline ? (
                        <Ticket className="h-4 w-4" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                      Ver evento
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
