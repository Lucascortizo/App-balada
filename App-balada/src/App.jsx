import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Cardapio from './pages/Cardapio';
import PainelBar from './pages/PainelBar';
import Catraca from './pages/Catraca';
import Admin from './pages/Admin';
import Ingressos from './pages/Ingressos';
import MinhaConta from './pages/MinhaConta'; 

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* A Vitrine Pública (Página Inicial) */}
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          
          {/* Tela de Login agora com o caminho correto */}
          <Route path="/login" element={<Login />} />
          
          {/* Fluxo do Cliente */}
          <Route path="/ingressos" element={<Ingressos />} />
          <Route path="/minha-conta" element={<MinhaConta />} />
          
          {/* Operação da Balada */}
          <Route path="/cardapio" element={<Cardapio />} />
          <Route path="/bar" element={<PainelBar />} />
          <Route path="/catraca" element={<Catraca />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}