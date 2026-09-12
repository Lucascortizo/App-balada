export const calcularResumoComanda = ({
  ingressos = [],
  espacos = [],
  pedidos = [],
  pagamentos = [],
  splitsEnviados = [],
  splitsRecebidos = [],
}) => {
  const ingressosValidos = ingressos.filter(
    (ingresso) =>
      !['estornado', 'cancelado'].includes(ingresso.status)
  );

  const espacosValidos = espacos.filter(
    (espaco) =>
      !['estornado', 'cancelado'].includes(espaco.status)
  );

  const pedidosValidos = pedidos.filter(
    (pedido) =>
      !['cancelado', 'cancelado_pelo_cliente'].includes(
        pedido.status
      )
  );

  const pagamentosValidos = pagamentos.filter(
    (pagamento) => pagamento.status !== 'cancelado'
  );

  const splitsDescontados = splitsEnviados
    .filter((split) => split.status === 'aceito')
    .reduce(
      (total, split) =>
        total + (Number(split.valor) || 0),
      0
    );

  const splitsAssumidos = splitsRecebidos
    .filter((split) => split.status === 'aceito')
    .reduce(
      (total, split) =>
        total + (Number(split.valor) || 0),
      0
    );

  const totalConsumacao =
    ingressosValidos.reduce(
      (total, ingresso) =>
        total + (Number(ingresso.consumacao) || 0),
      0
    ) +
    espacosValidos.reduce(
      (total, espaco) =>
        total + (Number(espaco.consumacao) || 0),
      0
    );

  const totalBar = pedidosValidos.reduce(
    (total, pedido) =>
      total + (Number(pedido.total) || 0),
    0
  );

  const totalEntradaPosPaga = ingressosValidos
    .filter(
      (ingresso) =>
        ingresso.pagamentoNaSaida === true
    )
    .reduce(
      (total, ingresso) =>
        total + (Number(ingresso.preco) || 0),
      0
    );

  const totalPago = pagamentosValidos.reduce(
    (total, pagamento) =>
      total + (Number(pagamento.valorPago) || 0),
    0
  );

  const gastoExtraBar = Math.max(
    0,
    totalBar - totalConsumacao
  );

  const saldoDevedor = Math.max(
    0,
    gastoExtraBar +
      totalEntradaPosPaga +
      splitsAssumidos -
      totalPago -
      splitsDescontados
  );

  return {
    totalConsumacao,
    totalBar,
    totalEntradaPosPaga,
    totalPago,
    splitsAssumidos,
    splitsDescontados,
    gastoExtra: gastoExtraBar,
    saldoDevedor,
    isPago: saldoDevedor <= 0.009,
  };
};