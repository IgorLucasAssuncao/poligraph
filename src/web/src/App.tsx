import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { BannerConsentimento } from './componentes/BannerConsentimento';
import { Layout } from './componentes/Layout';
import { Explorar } from './paginas/Explorar';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { MinhaConta } from './paginas/MinhaConta';
import { Parlamentar } from './paginas/Parlamentar';
import { PoliticaDePrivacidade } from './paginas/PoliticaDePrivacidade';
import { Questionario } from './paginas/Questionario';
import { Seguindo } from './paginas/Seguindo';
import { ProvedorDeSessao, useSessao } from './sessao';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorDeSessao>
        <BannerConsentimento />
        <Roteador />
      </ProvedorDeSessao>
    </BrowserRouter>
  );
}

// ═══════════════════════════════════════════════════════════════════

function Roteador() {
  const { usuario, carregando } = useSessao();

  // ⚠️ Sem isto, a tela de login pisca antes de a sessão ser verificada — e quem já
  //    está logado vê o próprio site sugerir que não está.
  if (carregando) return <div className="carregando-inicial">carregando…</div>;

  // ⭐ A política de privacidade é pública, DE PROPÓSITO: ela precisa estar acessível
  //    a quem ainda não entrou — inclusive para o Google, que exige a URL na tela de
  //    consentimento e a verifica sem estar logado.
  if (!usuario) {
    return (
      <Routes>
        <Route path="/privacidade" element={<DocumentoPublico />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/explorar" element={<Explorar />} />
        <Route path="/seguindo" element={<Seguindo />} />
        <Route path="/questionario" element={<Questionario />} />
        <Route path="/parlamentar/:id" element={<Parlamentar />} />
        <Route path="/conta" element={<MinhaConta />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidade />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

/** A política acessível sem login, com o mínimo de moldura. */
function DocumentoPublico() {
  return (
    <div className="documento-publico">
      <header className="cabecalho-publico">
        <Link to="/" className="marca-link">
          poligraph
        </Link>
      </header>
      <main>
        <PoliticaDePrivacidade />
      </main>
    </div>
  );
}
