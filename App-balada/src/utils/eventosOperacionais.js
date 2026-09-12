
export const ordenarEventosPorHorario = (eventos = []) =>
  [...eventos].sort(
    (a, b) =>
      new Date(a.data || 0) - new Date(b.data || 0)
  );

export const eventoAconteceHoje = (
  evento,
  agora = new Date()
) => {
  if (!evento?.data) return false;

  const dataEvento = new Date(evento.data);

  if (Number.isNaN(dataEvento.getTime())) {
    return false;
  }

  return (
    dataEvento.getFullYear() === agora.getFullYear() &&
    dataEvento.getMonth() === agora.getMonth() &&
    dataEvento.getDate() === agora.getDate()
  );
};

export const eventosOperacionaisDeHoje = (
  eventos = [],
  agora = new Date()
) =>
  ordenarEventosPorHorario(
    eventos.filter(
      (evento) =>
        evento.status !== 'cancelado' &&
        evento.status !== 'encerrado' &&
        eventoAconteceHoje(evento, agora)
    )
  );

