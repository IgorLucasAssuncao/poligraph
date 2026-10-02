import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { destinoSeguro } from './componentes/useEntrar';
import { BannerConsentimento } from './componentes/BannerConsentimento';
import { Layout } from './componentes/Layout';
import { Inicio } from './paginas/Inicio';
import { Login } from './paginas/Login';
import { Metodologia } from './paginas/Metodologia';
import { MinhaConta } from './paginas/MinhaConta';
import { Emendas } from './paginas/Emendas';
import { Entidade } from './paginas/Entidade';
import { Entidades } from './paginas/Entidades';
import { Governo } from './paginas/Governo';
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
  const { usuario, carregando, leituraPublica } = useSessao();

  // ⚠️ Sem isto, a tela de login pisca antes de a sessão ser verificada — e quem já
  //    está logado vê o próprio site sugerir que não está.
  if (carregando) return <div className="carregando-inicial">carregando…</div>;

  // ⭐ A política de privacidade é pública, DE PROPÓSITO: ela precisa estar acessível
  //    a quem ainda não entrou — inclusive para o Google, que exige a URL na tela de
  //    consentimento e a verifica sem estar logado.
  if (!usuario) {
    return (
      <Routes>
        <Route path="/privacidade" element={<DocumentoPublico><PoliticaDePrivacidade /></DocumentoPublico>} />
        <Route path="/metodologia" element={<DocumentoPublico><Metodologia /></DocumentoPublico>} />
        {/* ⭐ Com a leitura liberada, a conta é OPCIONAL (2026-10-02, decisão do autor):
            o questionário funciona sem ela — as respostas ⛔ são gravadas, o cálculo é
            na requisição. Só seguir e a própria conta pedem login, e o login volta
            para onde a pessoa estava. 🔴 Desligado no período eleitoral (RNF-17). */}
        {leituraPublica ? (
          <>
            <Route path="/entrar" element={<Login />} />
            <Route path="/conta" element={<Login />} />
            <Route path="*" element={<LeituraSemConta />} />
          </>
        ) : (
          <Route path="*" element={<Login />} />
        )}
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/parlamentares" element={<Parlamentares />} />
        <Route path="/resultado" element={<Questionario />} />
        <Route path="/parlamentar/:id/:aba?" element={<Parlamentar />} />
        <Route path="/governo" element={<Governo />} />
        <Route path="/emendas" element={<Emendas />} />
        <Route path="/entidades" element={<Entidades />} />
        <Route path="/entidades/:cnpj" element={<Entidade />} />
        <Route path="/orcamento" element={<Navigate to="/governo" replace />} />
        <Route path="/dinheiro" element={<Navigate to="/emendas" replace />} />
        <Route path="/conta" element={<MinhaConta />} />
        <Route path="/entrar" element={<VoltarDepoisDeEntrar />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidade />} />
        <Route path="/metodologia" element={<Metodologia />} />

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

/** O site para quem não entrou, quando a leitura está liberada: só as páginas de dado público. */
function LeituraSemConta() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/parlamentares" element={<Parlamentares />} />
        <Route path="/resultado" element={<Questionario />} />
        <Route path="/parlamentar/:id/:aba?" element={<Parlamentar />} />
        <Route path="/governo" element={<Governo />} />
        <Route path="/emendas" element={<Emendas />} />
        <Route path="/entidades" element={<Entidades />} />
        <Route path="/entidades/:cnpj" element={<Entidade />} />
        <Route path="/questionario" element={<Navigate to="/resultado" replace />} />
        <Route path="/explorar" element={<Navigate to="/parlamentares" replace />} />
        <Route path="/grafo" element={<Navigate to="/parlamentares?vista=grafo" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

/** Depois de entrar, de volta para onde a pessoa estava — seguir alguém, a própria conta. */
function VoltarDepoisDeEntrar() {
  const [parametros] = useSearchParams();
  return <Navigate to={destinoSeguro(parametros.get('voltar'))} replace />;
}

/**
 * Página acessível sem login, com o mínimo de moldura: a política de privacidade e o
 * "Como calculamos". Nenhuma das duas mostra dado de ninguém.
 */
function DocumentoPublico({ children }: { children: ReactNode }) {
  return (
    <div className="documento-publico">
      <header className="cabecalho-publico">
        <Link to="/" className="marca-link">
          Registro Aberto
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
