import { useState } from 'react';
import { BannerConsentimento } from './BannerConsentimento';
import { BotaoGoogle, type UsuarioLogado } from './BotaoGoogle';
import { PoliticaDePrivacidade } from './PoliticaDePrivacidade';
import { Questionario } from './Questionario';
import './App.css';

export default function App() {
  // Roteamento mínimo: o projeto tem duas telas. Router seria dependência sem problema.
  const emPrivacidade = window.location.pathname.startsWith('/privacidade');
  const [usuario, setUsuario] = useState<UsuarioLogado | null>(null);

  return (
    <>
      <BannerConsentimento />

      <main>
        <header>
          <a href="/"><h1>poligraph</h1></a>
          <p className="subtitulo">
            Afinidade política medida pelo voto — não pelo discurso.
          </p>

          {/* ⚠️ Login NUNCA é obrigatório: o questionário, o grafo e as fichas
              funcionam sem entrar. Ele só habilita sincronia e e-mail. */}
          <div className="area-login">
            {usuario ? (
              <span>Olá, {usuario.nome ?? 'você'}</span>
            ) : (
              <BotaoGoogle aoEntrar={setUsuario} />
            )}
          </div>
        </header>

        {emPrivacidade ? <PoliticaDePrivacidade /> : <Questionario />}

        <footer>
          <small>
            Dados abertos da Câmara dos Deputados · Trabalho de conclusão de curso ·{' '}
            <a href="/privacidade">Política de privacidade</a>
          </small>
        </footer>
      </main>
    </>
  );
}
