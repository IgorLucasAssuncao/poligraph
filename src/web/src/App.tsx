import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { BannerConsentimento } from './componentes/BannerConsentimento';
import { Layout } from './componentes/Layout';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { MinhaConta } from './paginas/MinhaConta';
import { Parlamentar } from './paginas/Parlamentar';
import { Parlamentares } from './paginas/Parlamentares';
import { PoliticaDePrivacidade } from './paginas/PoliticaDePrivacidade';
import { Questionario } from './paginas/Questionario';
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
        <Route path="/parlamentares" element={<Parlamentares />} />
        <Route path="/resultado" element={<Questionario />} />
        <Route path="/parlamentar/:id" element={<Parlamentar />} />
        <Route path="/conta" element={<MinhaConta />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidade />} />

        {/* ⚠️ Os endereços antigos continuam funcionando. Cinco destinos viraram três,
            e quem tiver um link salvo ⛔ não pode cair num 404 — nem ser mandado para a
            home, que perderia a intenção de quem clicou. */}
        <Route path="/explorar" element={<Navigate to="/parlamentares" replace />} />
        <Route
          path="/grafo"
          element={<Navigate to="/parlamentares?vista=grafo" replace />}
        />
        <Route path="/seguindo" element={<Navigate to="/" replace />} />
        <Route path="/questionario" element={<Navigate to="/resultado" replace />} />

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
          Registro Aberto
        </Link>
      </header>
      <main>
        <PoliticaDePrivacidade />
      </main>
    </div>
  );
}
