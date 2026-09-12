import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';

import { db } from '../services/firebase';
import { calcularResumoComanda } from '../domain/comanda';

const estadoInicial = {
  eventosGlobais: [],
  ingressos: [],
  reservas: [],
  pedidos: [],
  pagamentos: [],
  passesSaida: [],
  comandas: [],
  splitsEnviados: [],
  splitsRecebidos: [],
};

export function useComanda(user) {
  const [dados, setDados] =
    useState(estadoInicial);

  const [carregando, setCarregando] =
    useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setDados(estadoInicial);
      setCarregando(false);
      return;
    }

    setCarregando(true);

    /*
     * Controla o carregamento inicial.
     *
     * Temos 10 listeners:
     *
     * 1. eventos
     * 2. ingressos
     * 3. reservas do titular
     * 4. reservas como convidado
     * 5. pedidos
     * 6. pagamentos
     * 7. passes
     * 8. comandas
     * 9. splits enviados
     * 10. splits recebidos
     */
    const snapshotsRecebidos =
      new Set();

    const marcarSnapshotRecebido =
      (nome) => {
        snapshotsRecebidos.add(nome);

        if (
          snapshotsRecebidos.size >= 10
        ) {
          setCarregando(false);
        }
      };

    /*
     * EVENTOS
     */
    const unsubEv = onSnapshot(
      collection(db, 'eventos'),
      (snap) => {
        setDados((prev) => ({
          ...prev,
          eventosGlobais:
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })),
        }));

        marcarSnapshotRecebido(
          'eventos'
        );
      },
      (error) => {
        console.error(
          'Erro ao carregar eventos:',
          error
        );

        marcarSnapshotRecebido(
          'eventos'
        );
      }
    );

    /*
     * INGRESSOS DO USUÁRIO
     */
    const unsubIn = onSnapshot(
      query(
        collection(
          db,
          'ingressos_vendidos'
        ),
        where(
          'donoId',
          '==',
          user.uid
        )
      ),
      (snap) => {
        setDados((prev) => ({
          ...prev,
          ingressos:
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })),
        }));

        marcarSnapshotRecebido(
          'ingressos'
        );
      },
      (error) => {
        console.error(
          'Erro ao carregar ingressos:',
          error
        );

        marcarSnapshotRecebido(
          'ingressos'
        );
      }
    );

    /*
     * CAMAROTES DO TITULAR
     */
    const unsubReTitular =
      onSnapshot(
        query(
          collection(db, 'espacos'),
          where(
            'donoId',
            '==',
            user.uid
          )
        ),
        (snap) => {
          const reservasTitular =
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

          setDados((prev) => {
            /*
             * Preserva os camarotes em que
             * o usuário é convidado.
             */
            const reservasConvidado =
              prev.reservas.filter(
                (item) =>
                  item.donoId !==
                    user.uid &&
                  item.convidadosIds?.includes(
                    user.uid
                  )
              );

            const reservasMap =
              new Map();

            reservasTitular.forEach(
              (item) => {
                reservasMap.set(
                  item.id,
                  item
                );
              }
            );

            reservasConvidado.forEach(
              (item) => {
                reservasMap.set(
                  item.id,
                  item
                );
              }
            );

            return {
              ...prev,
              reservas:
                Array.from(
                  reservasMap.values()
                ),
            };
          });

          marcarSnapshotRecebido(
            'reservasTitular'
          );
        },
        (error) => {
          console.error(
            'Erro ao carregar reservas do titular:',
            error
          );

          marcarSnapshotRecebido(
            'reservasTitular'
          );
        }
      );

    /*
     * CAMAROTES EM QUE O USUÁRIO É CONVIDADO
     */
    const unsubReConvidado =
      onSnapshot(
        query(
          collection(db, 'espacos'),
          where(
            'convidadosIds',
            'array-contains',
            user.uid
          )
        ),
        (snap) => {
          const reservasConvidado =
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));

          setDados((prev) => {
            const reservasMap =
              new Map();

            /*
             * Mantém tudo que já existe.
             */
            prev.reservas.forEach(
              (item) => {
                reservasMap.set(
                  item.id,
                  item
                );
              }
            );

            /*
             * Sobrescreve com os dados
             * mais recentes dos camarotes
             * onde o usuário é convidado.
             */
            reservasConvidado.forEach(
              (item) => {
                reservasMap.set(
                  item.id,
                  item
                );
              }
            );

            return {
              ...prev,
              reservas:
                Array.from(
                  reservasMap.values()
                ),
            };
          });

          marcarSnapshotRecebido(
            'reservasConvidado'
          );
        },
        (error) => {
          console.error(
            'Erro ao carregar convites VIP:',
            error
          );

          marcarSnapshotRecebido(
            'reservasConvidado'
          );
        }
      );

    /*
     * PEDIDOS
     */
    const unsubPe = onSnapshot(
      query(
        collection(db, 'pedidos'),
        where(
          'clienteId',
          '==',
          user.uid
        )
      ),
      (snap) => {
        setDados((prev) => ({
          ...prev,
          pedidos:
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })),
        }));

        marcarSnapshotRecebido(
          'pedidos'
        );
      },
      (error) => {
        console.error(
          'Erro ao carregar pedidos:',
          error
        );

        marcarSnapshotRecebido(
          'pedidos'
        );
      }
    );

    /*
     * PAGAMENTOS
     */
    const unsubPa = onSnapshot(
      query(
        collection(
          db,
          'pagamentos_comanda'
        ),
        where(
          'clienteId',
          '==',
          user.uid
        )
      ),
      (snap) => {
        setDados((prev) => ({
          ...prev,
          pagamentos:
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })),
        }));

        marcarSnapshotRecebido(
          'pagamentos'
        );
      },
      (error) => {
        console.error(
          'Erro ao carregar pagamentos:',
          error
        );

        marcarSnapshotRecebido(
          'pagamentos'
        );
      }
    );

    /*
     * PASSES DE SAÍDA
     */
    const unsubPasses =
      onSnapshot(
        query(
          collection(
            db,
            'passes_saida'
          ),
          where(
            'clienteId',
            '==',
            user.uid
          )
        ),
        (snap) => {
          setDados((prev) => ({
            ...prev,
            passesSaida:
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })),
          }));

          marcarSnapshotRecebido(
            'passesSaida'
          );
        },
        (error) => {
          console.error(
            'Erro ao carregar passes de saída:',
            error
          );

          marcarSnapshotRecebido(
            'passesSaida'
          );
        }
      );

    /*
     * COMANDAS
     */
    const unsubComandas =
      onSnapshot(
        query(
          collection(
            db,
            'comandas_ativas'
          ),
          where(
            'clienteId',
            '==',
            user.uid
          )
        ),
        (snap) => {
          setDados((prev) => ({
            ...prev,
            comandas:
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })),
          }));

          marcarSnapshotRecebido(
            'comandas'
          );
        },
        (error) => {
          console.error(
            'Erro ao carregar comandas:',
            error
          );

          marcarSnapshotRecebido(
            'comandas'
          );
        }
      );

    /*
     * SPLITS ENVIADOS
     */
    const unsubSe =
      onSnapshot(
        query(
          collection(
            db,
            'cobrancas_split'
          ),
          where(
            'deId',
            '==',
            user.uid
          )
        ),
        (snap) => {
          setDados((prev) => ({
            ...prev,
            splitsEnviados:
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })),
          }));

          marcarSnapshotRecebido(
            'splitsEnviados'
          );
        },
        (error) => {
          console.error(
            'Erro ao carregar splits enviados:',
            error
          );

          marcarSnapshotRecebido(
            'splitsEnviados'
          );
        }
      );

    /*
     * SPLITS RECEBIDOS
     */
    const unsubSr =
      onSnapshot(
        query(
          collection(
            db,
            'cobrancas_split'
          ),
          where(
            'paraId',
            '==',
            user.uid
          )
        ),
        (snap) => {
          setDados((prev) => ({
            ...prev,
            splitsRecebidos:
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })),
          }));

          marcarSnapshotRecebido(
            'splitsRecebidos'
          );
        },
        (error) => {
          console.error(
            'Erro ao carregar splits recebidos:',
            error
          );

          marcarSnapshotRecebido(
            'splitsRecebidos'
          );
        }
      );

    return () => {
      unsubEv();
      unsubIn();
      unsubReTitular();
      unsubReConvidado();
      unsubPe();
      unsubPa();
      unsubPasses();
      unsubComandas();
      unsubSe();
      unsubSr();
    };
  }, [user?.uid]);

  const resultado = useMemo(() => {
    const {
      eventosGlobais,
      ingressos,
      reservas,
      pedidos,
      pagamentos,
      passesSaida,
      comandas,
      splitsEnviados,
      splitsRecebidos,
    } = dados;

    /*
     * Todos os eventos que possuem algum
     * vínculo com o usuário.
     */
    const IDsEventos =
      Array.from(
        new Set([
          ...ingressos.map(
            (item) =>
              item.eventoId
          ),

          ...reservas.map(
            (item) =>
              item.eventoId
          ),

          ...pedidos.map(
            (item) =>
              item.eventoId
          ),

          ...pagamentos.map(
            (item) =>
              item.eventoId
          ),

          ...passesSaida.map(
            (item) =>
              item.eventoId
          ),

          ...comandas.map(
            (item) =>
              item.eventoId
          ),

          ...splitsEnviados.map(
            (item) =>
              item.eventoId
          ),

          ...splitsRecebidos.map(
            (item) =>
              item.eventoId
          ),
        ])
      ).filter(Boolean);

    const comandasProcessadas =
      IDsEventos
        .map((eventoId) => {
          const festa =
            eventosGlobais.find(
              (evento) =>
                evento.id ===
                eventoId
            );

          if (!festa) {
            return null;
          }

          const ingressosFesta =
            ingressos.filter(
              (item) =>
                item.eventoId ===
                eventoId
            );

          const espacosFesta =
            reservas.filter(
              (item) =>
                item.eventoId ===
                eventoId
            );

          const pedidosFesta =
            pedidos
              .filter(
                (item) =>
                  item.eventoId ===
                  eventoId
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.data || 0
                  ) -
                  new Date(
                    a.data || 0
                  )
              );

          const pagamentosFesta =
            pagamentos.filter(
              (item) =>
                item.eventoId ===
                eventoId
            );

          const passesFesta =
            passesSaida.filter(
              (item) =>
                item.eventoId ===
                eventoId
            );

          const comandasFesta =
            comandas.filter(
              (item) =>
                item.eventoId ===
                eventoId
            );

          const splitsEnv =
            splitsEnviados.filter(
              (item) =>
                item.eventoId ===
                  eventoId &&
                item.status ===
                  'aceito'
            );

          const splitsRec =
            splitsRecebidos.filter(
              (item) =>
                item.eventoId ===
                  eventoId &&
                item.status ===
                  'aceito'
            );

          /*
           * CAMAROTE DO QUAL O USUÁRIO É CONVIDADO
           */
          const conviteNoEvento =
            espacosFesta.find(
              (espaco) =>
                espaco.donoId !==
                  user.uid &&
                espaco.convidadosIds?.includes(
                  user.uid
                )
            ) || null;

          /*
           * CAMAROTE DO QUAL O USUÁRIO É TITULAR
           */
          const espacoComoTitular =
            espacosFesta.find(
              (espaco) =>
                espaco.donoId ===
                user.uid
            ) || null;

          /*
           * Espaço principal mostrado na tela.
           *
           * Titular:
           *   usa seu próprio camarote.
           *
           * Convidado:
           *   usa o camarote onde foi convidado.
           */
          const espacoVIP =
            espacoComoTitular ||
            conviteNoEvento ||
            espacosFesta[0] ||
            null;

          /*
           * Registro individual do convidado
           * dentro do camarote.
           */
          const registroConvidado =
            conviteNoEvento?.convidados?.find(
              (convidado) =>
                convidado.uid ===
                user.uid
            ) || null;

          /*
           * Convidado está fisicamente dentro
           * somente quando entrou e ainda não saiu.
           */
          const convidadoEntrou =
            registroConvidado?.entrou ===
              true &&
            registroConvidado?.saiu !==
              true;

          /*
           * Convidado já saiu.
           */
          const convidadoSaiu =
            registroConvidado?.saiu ===
            true;

          /*
           * IMPORTANTE:
           *
           * Se for titular, a consumação do
           * camarote participa da conta dele.
           *
           * Se for convidado, NÃO colocamos
           * o camarote do titular no cálculo
           * financeiro individual.
           */
          const espacosParaCalculo =
            espacoComoTitular
              ? [espacoComoTitular]
              : [];

          const calculos =
            calcularResumoComanda({
              ingressos:
                ingressosFesta,

              espacos:
                espacosParaCalculo,

              pedidos:
                pedidosFesta,

              pagamentos:
                pagamentosFesta,

              splitsEnviados:
                splitsEnv,

              splitsRecebidos:
                splitsRec,
            });

          /*
           * TITULAR:
           *
           * ingresso usado
           * OU
           * check-in do próprio camarote.
           */
          const titularNoEvento =
            ingressosFesta.some(
              (ingresso) =>
                ingresso.status ===
                'usado'
            ) ||
            Boolean(
              espacoComoTitular?.checkinFeito ===
                true
            );

          /*
           * CONVIDADO:
           *
           * entrou no camarote e
           * ainda não registrou saída.
           */
          const isNoEvento =
            titularNoEvento ||
            convidadoEntrou;

          /*
           * HISTÓRICO
           *
           * O evento entra no histórico quando:
           *
           * - ingresso saiu;
           * - ingresso foi encerrado;
           * - ingresso foi finalizado;
           * - comanda foi encerrada;
           * - convidado já saiu.
           */
          const isHistorico =
            ingressosFesta.some(
              (ingresso) =>
                [
                  'saiu',
                  'encerrado',
                  'finalizado',
                ].includes(
                  ingresso.status
                )
            ) ||
            comandasFesta.some(
              (comanda) =>
                comanda.status ===
                'encerrada'
            ) ||
            convidadoSaiu;

          /*
           * Comanda aberta ou paga.
           */
          const comandaAtiva =
            comandasFesta.find(
              (comanda) =>
                [
                  'aberta',
                  'paga',
                ].includes(
                  comanda.status
                )
            ) || null;

          /*
           * Passe de saída disponível.
           */
          const passeSaidaAtivo =
            passesFesta.find(
              (passe) =>
                passe.status ===
                'disponivel'
            ) || null;

          return {
            eventoId,

            festa,

            espacoVIP,

            /*
             * Dados específicos do convidado.
             */
            convidadoNoEvento:
              Boolean(
                conviteNoEvento
              ),

            registroConvidado,

            convidadoEntrou,

            convidadoSaiu,

            /*
             * Estado físico do usuário
             * dentro da festa.
             */
            isNoEvento,

            /*
             * Estado histórico.
             */
            isHistorico,

            /*
             * Comanda atual.
             */
            comandaAtiva,

            /*
             * Passe atual.
             */
            passeSaidaAtivo,

            /*
             * Todas as comandas daquele evento
             * pertencentes ao usuário.
             */
            comandasFesta,

            /*
             * Pedidos do próprio usuário naquele evento.
             */
            meusPedidosNaFesta:
              pedidosFesta,

            /*
             * totalConsumacao
             * totalBar
             * saldoDevedor
             * gastoExtra
             * isPago
             * etc.
             */
            ...calculos,
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            new Date(
              b.festa?.data ||
                0
            ) -
            new Date(
              a.festa?.data ||
                0
            )
        );

    /*
     * Remove eventos duplicados.
     *
     * Isso é importante porque o usuário pode
     * aparecer simultaneamente em mais de uma
     * fonte relacionada ao mesmo evento.
     */
    const comandasSemDuplicidade =
      comandasProcessadas.reduce(
        (acc, item) => {
          const existente =
            acc.find(
              (evento) =>
                evento.eventoId ===
                item.eventoId
            );

          /*
           * Primeiro registro do evento.
           */
          if (!existente) {
            acc.push(item);
            return acc;
          }

          /*
           * Caso existam dois registros
           * do mesmo evento, preserva as
           * informações mais completas.
           */
          const convidadoEntrouMaisAtual =
            item.convidadoEntrou ===
              true ||
            existente.convidadoEntrou ===
              true;

          const convidadoSaiuMaisAtual =
            item.convidadoSaiu ===
              true ||
            existente.convidadoSaiu ===
              true;

          Object.assign(
            existente,
            {
              convidadoNoEvento:
                existente.convidadoNoEvento ||
                item.convidadoNoEvento,

              registroConvidado:
                existente.registroConvidado ||
                item.registroConvidado,

              convidadoEntrou:
                convidadoEntrouMaisAtual,

              convidadoSaiu:
                convidadoSaiuMaisAtual,

              isNoEvento:
                existente.isNoEvento ||
                item.isNoEvento,

              comandaAtiva:
                existente.comandaAtiva ||
                item.comandaAtiva,

              passeSaidaAtivo:
                existente.passeSaidaAtivo ||
                item.passeSaidaAtivo,

              espacoVIP:
                existente.espacoVIP ||
                item.espacoVIP,
            }
          );

          return acc;
        },
        []
      );

    return {
      comandasProcessadas:
        comandasSemDuplicidade,

      cobrancasPendentes:
        splitsRecebidos.filter(
          (split) =>
            split.status ===
            'pendente'
        ),
    };
  }, [dados, user?.uid]);

  return {
    ...resultado,

    carregando,

    passesSaida:
      dados.passesSaida,
  };
}