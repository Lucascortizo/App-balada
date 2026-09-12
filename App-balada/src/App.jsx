// src/App.jsx

import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { getRedirectPath } from './utils/roleMap';

import Login from './pages/Login';
import Home from './pages/Home';
import Eventos from './pages/Eventos';
import Cardapio from './pages/Cardapio';
import PainelBar from './pages/PainelBar';
import PainelGarcom from './pages/PainelGarcom';
import Catraca from './pages/Catraca';
import Admin from './pages/Admin';
import Ingressos from './pages/Ingressos';
import MeusIngressos from './pages/MeusIngressos';
import MinhaConta from './pages/MinhaConta';
import MeusDados from './pages/MeusDados';
import Caixa from './pages/Caixa';
import ConviteVIP from './pages/ConviteVIP';
import ConviteTransferencia from './pages/ConviteTransferencia';

// ================= 1. ROTAS RESTRITAS =================
const RotaProtegida = ({ children, cargosPermitidos }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const temPermissao =
    user.role === 'admin' || cargosPermitidos.includes(user.role);

  if (!temPermissao) {
    return <Navigate to={getRedirectPath(user.role)} replace />;
  }

  return children;
};

// ================= 2. VITRINE DO CLIENTE =================
const RotaClienteOuAdmin = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Funcionários que não são admin não acessam a vitrine do cliente.
  if (user && user.role !== 'admin' && user.role !== 'cliente') {
    return <Navigate to={getRedirectPath(user.role)} replace />;
  }

  return children;
};

export default function App() {
  return (
    <div className="w-full min-h-screen bg-zinc-950 font-sans antialiased text-zinc-50">
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-center"
            reverseOrder={false}
            toastOptions={{
              className:
                'font-bold text-sm shadow-2xl rounded-2xl border border-zinc-800 bg-zinc-900 text-white',
              duration: 3000,
            }}
          />

          <Routes>
            {/* =============== ROTAS PÚBLICAS / VITRINE =============== */}
            <Route
              path="/"
              element={
                <RotaClienteOuAdmin>
                  <Home />
                </RotaClienteOuAdmin>
              }
            />

            <Route
              path="/home"
              element={
                <RotaClienteOuAdmin>
                  <Home />
                </RotaClienteOuAdmin>
              }
            />

            <Route path="/login" element={<Login />} />

            <Route
              path="/eventos"
              element={
                <RotaClienteOuAdmin>
                  <Eventos />
                </RotaClienteOuAdmin>
              }
            />

            <Route
              path="/cardapio"
              element={
                <RotaClienteOuAdmin>
                  <Cardapio />
                </RotaClienteOuAdmin>
              }
            />

            {/* =============== CONVITES =============== */}
            <Route
              path="/convite/vip/:espacoId/:token"
              element={<ConviteVIP />}
            />

            <Route
              path="/convite/transferencia/:itemId/:token"
              element={<ConviteTransferencia />}
            />

            {/* =============== ROTAS PRIVADAS DO CLIENTE =============== */}
            <Route
              path="/ingressos"
              element={
                <RotaProtegida cargosPermitidos={['cliente']}>
                  <Ingressos />
                </RotaProtegida>
              }
            />

            <Route
              path="/meus-ingressos"
              element={
                <RotaProtegida cargosPermitidos={['cliente']}>
                  <MeusIngressos />
                </RotaProtegida>
              }
            />

            <Route
              path="/minha-conta"
              element={
                <RotaProtegida cargosPermitidos={['cliente']}>
                  <MinhaConta />
                </RotaProtegida>
              }
            />

            <Route
              path="/meus-dados"
              element={
                <RotaProtegida
                  cargosPermitidos={[
                    'cliente',
                    'garcom',
                    'barman',
                    'seguranca',
                    'caixa',
                  ]}
                >
                  <MeusDados />
                </RotaProtegida>
              }
            />

            {/* =============== ROTAS DA OPERAÇÃO =============== */}
            <Route
              path="/garcom"
              element={
                <RotaProtegida cargosPermitidos={['garcom']}>
                  <PainelGarcom />
                </RotaProtegida>
              }
            />

            <Route
              path="/bar"
              element={
                <RotaProtegida cargosPermitidos={['barman']}>
                  <PainelBar />
                </RotaProtegida>
              }
            />

            <Route
              path="/catraca"
              element={
                <RotaProtegida cargosPermitidos={['seguranca']}>
                  <Catraca />
                </RotaProtegida>
              }
            />

            <Route
              path="/caixa"
              element={
                <RotaProtegida cargosPermitidos={['caixa']}>
                  <Caixa />
                </RotaProtegida>
              }
            />

            <Route
              path="/admin"
              element={
                <RotaProtegida cargosPermitidos={['admin']}>
                  <Admin />
                </RotaProtegida>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
