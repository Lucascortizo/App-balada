import { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function Catraca() {
  const [resultado, setResultado] = useState(null);
  const [status, setStatus] = useState('aguardando'); // aguardando, sucesso, erro

  const aoLerCodigo = (texto) => {
    // Evita ler o mesmo código 50 vezes por segundo
    if (status !== 'aguardando') return;

    // Aqui no futuro nós faríamos uma busca no Firebase para ver se o ingresso é válido.
    // Como geramos o QR Code com o UID do usuário, o 'texto' será esse UID.
    setResultado(texto[0].rawValue);
    setStatus('sucesso');

    // Depois de 3 segundos, a tela volta ao normal para bipar o próximo cliente
    setTimeout(() => {
      setResultado(null);
      setStatus('aguardando');
    }, 3000);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans transition-colors duration-500 ${
      status === 'sucesso' ? 'bg-green-600' : 'bg-gray-900'
    }`}>
      
      <div className="w-full max-w-md bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-gray-700">
        <header className="p-5 bg-gray-900 text-center border-b border-gray-700">
          <h1 className="text-2xl font-bold text-white">Controle de Portaria</h1>
          <p className="text-gray-400">Aponte para o ingresso do cliente</p>
        </header>

        {/* Câmera do Leitor */}
        <div className="relative bg-black aspect-square">
          {status === 'aguardando' ? (
            <Scanner 
              onScan={aoLerCodigo}
              onError={(error) => console.log(error)}
              formats={['qr_code']}
              components={{ audio: false, finder: false }}
              styles={{ container: { width: '100%', height: '100%' } }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-500/20">
              <span className="text-7xl mb-4">✅</span>
              <h2 className="text-3xl font-bold text-white tracking-widest uppercase">Liberado</h2>
            </div>
          )}

          {/* Mira visual na tela (quadrado no meio) */}
          {status === 'aguardando' && (
            <div className="absolute inset-0 border-[40px] border-black/50 flex items-center justify-center">
              <div className="w-full h-full border-2 border-purple-500 rounded-lg"></div>
            </div>
          )}
        </div>

        <div className="p-6 text-center">
          {status === 'sucesso' ? (
            <div>
              <p className="text-green-400 font-bold text-lg mb-1">Entrada Registrada!</p>
              <p className="text-xs text-gray-400 break-all">ID: {resultado}</p>
            </div>
          ) : (
            <p className="text-gray-400 animate-pulse">Aguardando leitura...</p>
          )}
        </div>
      </div>
    </div>
  );
}