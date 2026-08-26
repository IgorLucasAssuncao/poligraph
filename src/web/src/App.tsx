import { BannerConsentimento } from './BannerConsentimento';
import { PoliticaDePrivacidade } from './PoliticaDePrivacidade';
import { Questionario } from './Questionario';
import './App.css';

export default function App() {
  // Roteamento mínimo: o projeto tem duas telas. Router seria dependência sem problema.
  const emPrivacidade = window.location.pathname.startsWith('/privacidade');

  return (
    <>
      <BannerConsentimento />

      <main>
        <header>
          <a href="/"><h1>poligraph</h1></a>
          <p className="subtitulo">
            Afinidade política medida pelo voto — não pelo discurso.
          </p>
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
