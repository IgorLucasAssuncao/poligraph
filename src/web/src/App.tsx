import { BrowserRouter, Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { BannerConsentimento } from './componentes/BannerConsentimento';
import { Avatar } from './componentes/Avatar';
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
        <Route path="/privacidade" element={<Documento />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <BarraDeNavegacao />

      <main className="conteudo">
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
      </main>

      <Rodape />
    </div>
  );
}

function BarraDeNavegacao() {
  const { usuario, sair } = useSessao();

  return (
    <nav className="barra">
      <Link to="/" className="marca">
        poligraph
      </Link>

      <div className="menu">
        <NavLink to="/">Início</NavLink>
        <NavLink to="/explorar">Explorar</NavLink>
        <NavLink to="/seguindo">Acompanhando</NavLink>
        <NavLink to="/questionario">Questionário</NavLink>
      </div>

      <div className="usuario">
        <Link to="/conta" className="atalho-conta" title="Minha conta">
          <Avatar nome={usuario?.nome ?? '?'} fotoUrl={usuario?.fotoUrl} tamanho="pequeno" />
          <span className="usuario-nome">{usuario?.nome?.split(' ')[0]}</span>
        </Link>
        <button type="button" className="botao-texto" onClick={sair}>
          Sair
        </button>
      </div>
    </nav>
  );
}

function Rodape() {
  return (
    <footer className="rodape">
      <small>
        Dados abertos da Câmara dos Deputados · Trabalho de conclusão de curso ·{' '}
        <Link to="/privacidade">Privacidade</Link>
      </small>
      {/* RNF-14 — obrigatório, e não só na tela de resultado */}
      <small className="rodape-aviso">
        Ferramenta acadêmica de comparação de votos. <strong>Não é recomendação de voto.</strong>
      </small>
    </footer>
  );
}

/** A política acessível sem login, com o mínimo de moldura. */
function Documento() {
  return (
    <div className="app">
      <nav className="barra">
        <Link to="/" className="marca">
          poligraph
        </Link>
      </nav>
      <main className="conteudo">
        <PoliticaDePrivacidade />
      </main>
    </div>
  );
}
