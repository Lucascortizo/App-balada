import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Cardapio from './pages/Cardapio';
import PainelBar from './pages/PainelBar';
import Catraca from './pages/Catraca'; // Nova tela!

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/cardapio" element={<Cardapio />} />
        <Route path="/bar" element={<PainelBar />} />
        <Route path="/catraca" element={<Catraca />} />
      </Routes>
    </BrowserRouter>
  );
}