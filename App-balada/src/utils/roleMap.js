export const ROLE_REDIRECTS = {
  admin: '/admin',
  seguranca: '/catraca',
  barman: '/bar',
  garcom: '/garcom',
  caixa: '/caixa',
  cliente: '/home',
};

export const getRedirectPath = (role) => {
  return ROLE_REDIRECTS[role] || '/home';
};