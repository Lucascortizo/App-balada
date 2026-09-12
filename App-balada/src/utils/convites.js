export const gerarTokenConvite = () => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
};

export const urlConvite = (tipo, ...partes) => {
  const base = `${window.location.origin}${window.location.pathname}`;

  const caminho = partes
    .map((parte) => encodeURIComponent(String(parte)))
    .join('/');

  return `${base}#/convite/${tipo}/${caminho}`;
};

export const compartilharOuCopiar = async ({
  url,
  titulo,
  texto,
  sucesso = 'Link copiado.',
}) => {
  if (!url) {
    throw new Error('URL do convite não informada.');
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: titulo,
        text: texto,
        url,
      });

      return 'compartilhado';
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'cancelado';
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return sucesso;
    } catch (error) {
      console.error('Erro ao copiar link:', error);
    }
  }

  window.prompt('Copie o link do convite:', url);

  return 'manual';
};