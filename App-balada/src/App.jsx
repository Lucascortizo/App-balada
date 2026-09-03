import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

import Login from './pages/Login';
import Home from './pages/Home';
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

// ================= 1. LEÃO DE CHÁCARA (ROTAS RESTRITAS) =================
const RotaProtegida = ({ children, cargosPermitidos }) => {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" replace />;

  const temPermissao = user.role === 'admin' || cargosPermitidos.includes(user.role);
  
  // Se não tem permissão, joga o funcionário direto de volta pro painel de trabalho dele
  if (!temPermissao) {
    if (user.role === 'garcom') return <Navigate to="/garcom" replace />;
    if (user.role === 'barman') return <Navigate to="/bar" replace />;
    if (user.role === 'seguranca') return <Navigate to="/catraca" replace />;
    if (user.role === 'caixa') return <Navigate to="/caixa" replace />;
    return <Navigate to="/home" replace />; 
  }
  
  return children;
};

// ================= 2. DESVIADOR DE EQUIPE (TIRA FUNCIONÁRIOS DA VITRINE PÚBLICA) =================
const RotaClienteOuAdmin = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  // Impede que funcionários vejam as telas de Home e Cardápio do Cliente
  if (user) {
    if (user.role === 'garcom') return <Navigate to="/garcom" replace />;
    if (user.role === 'barman') return <Navigate to="/bar" replace />;
    if (user.role === 'seguranca') return <Navigate to="/catraca" replace />;
    if (user.role === 'caixa') return <Navigate to="/caixa" replace />;
  }
  
  return children;
};

export default function App() {
  return (
    <div className="w-full min-h-screen bg-[#FAFAFA] font-sans antialiased text-zinc-900">
      <AuthProvider>
        <BrowserRouter>
          <Toaster 
            position="top-center" 
            reverseOrder={false} 
            toastOptions={{
              className: 'font-bold text-sm shadow-xl rounded-2xl border border-zinc-100',
              duration: 3000,
            }}
          />
          
          <Routes>
            {/* =============== ROTAS PÚBLICAS (VITRINE ABERTA) =============== */}
            <Route path="/" element={<RotaClienteOuAdmin><Home /></RotaClienteOuAdmin>} />
            <Route path="/home" element={<RotaClienteOuAdmin><Home /></RotaClienteOuAdmin>} />
            <Route path="/login" element={<Login />} />
            <Route path="/cardapio" element={<RotaClienteOuAdmin><Cardapio /></RotaClienteOuAdmin>} />
            
            {/* =============== ROTAS PRIVADAS DO CLIENTE =============== */}
            <Route path="/ingressos" element={<RotaProtegida cargosPermitidos={['cliente']}><Ingressos /></RotaProtegida>} /> 
            <Route path="/meus-ingressos" element={<RotaProtegida cargosPermitidos={['cliente']}><MeusIngressos /></RotaProtegida>} /> 
            <Route path="/minha-conta" element={<RotaProtegida cargosPermitidos={['cliente']}><MinhaConta /></RotaProtegida>} />
            <Route path="/meus-dados" element={<RotaProtegida cargosPermitidos={['cliente', 'garcom', 'barman', 'seguranca', 'caixa']}><MeusDados /></RotaProtegida>} />
            
            {/* =============== ROTAS DA OPERAÇÃO =============== */}
            <Route path="/garcom" element={<RotaProtegida cargosPermitidos={['garcom']}><PainelGarcom /></RotaProtegida>} />
            <Route path="/bar" element={<RotaProtegida cargosPermitidos={['barman']}><PainelBar /></RotaProtegida>} />
            <Route path="/catraca" element={<RotaProtegida cargosPermitidos={['seguranca']}><Catraca /></RotaProtegida>} />
            <Route path="/caixa" element={<RotaProtegida cargosPermitidos={['caixa']}><Caixa /></RotaProtegida>} />
            <Route path="/admin" element={<RotaProtegida cargosPermitidos={['admin']}><Admin /></RotaProtegida>} />
            
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}