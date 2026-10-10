import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { destinoSeguro } from './componentes/useEntrar';
import { BannerConsentimentoComponent } from './componentes/BannerConsentimento';
import { LayoutComponent } from './componentes/Layout';
import { ProvedorDeSessaoComponent } from './componentes/ProvedorDeSessao';
import { EsqueletoDeTextoComponent } from './componentes/Esqueleto';
import { useSessao } from './sessao';
import './App.css';
import { TEXTOS_DO_SITE as T } from './textos/site';

/**
 * Cada página vem num pacote próprio, baixado na primeira visita a ela (auditoria de 2026-10-03:
 * o pacote único tinha 507 KB, e quem abria só a ficha baixava também o grafo, o mapa e o governo).
 */
const InicioComponent = lazy(() => import('./paginas/Inicio').then((m) => ({ default: m.InicioComponent })));
const LoginComponent = lazy(() => import('./paginas/Login').then((m) => ({ default: m.LoginComponent })));
const MetodologiaComponent = lazy(() => import('./paginas/Metodologia').then((m) => ({ default: m.MetodologiaComponent })));
const MinhaContaComponent = lazy(() => import('./paginas/MinhaConta').then((m) => ({ default: m.MinhaContaComponent })));
const EmendasComponent = lazy(() => import('./paginas/Emendas').then((m) => ({ default: m.EmendasComponent })));
const EntidadeComponent = lazy(() => import('./paginas/Entidade').then((m) => ({ default: m.EntidadeComponent })));
const EntidadesComponent = lazy(() => import('./paginas/Entidades').then((m) => ({ default: m.EntidadesComponent })));
const GovernoComponent = lazy(() => import('./paginas/Governo').then((m) => ({ default: m.GovernoComponent })));
const ComprasDoGovernoComponent = lazy(() => import('./paginas/ComprasDoGoverno').then((m) => ({ default: m.ComprasDoGovernoComponent })));
const ViagensDoGovernoComponent = lazy(() => import('./paginas/ViagensDoGoverno').then((m) => ({ default: m.ViagensDoGovernoComponent })));
const ParlamentarComponent = lazy(() => import('./paginas/Parlamentar').then((m) => ({ default: m.ParlamentarComponent })));
const ParlamentaresComponent = lazy(() => import('./paginas/Parlamentares').then((m) => ({ default: m.ParlamentaresComponent })));
const PoliticaDePrivacidadeComponent = lazy(() => import('./paginas/PoliticaDePrivacidade').then((m) => ({ default: m.PoliticaDePrivacidadeComponent })));
const QuestionarioComponent = lazy(() => import('./paginas/Questionario').then((m) => ({ default: m.QuestionarioComponent })));

export default function AppComponent() {
  return (
    <BrowserRouter>
      <ProvedorDeSessaoComponent>
        <BannerConsentimentoComponent />
        <RoteadorComponent />
      </ProvedorDeSessaoComponent>
    </BrowserRouter>
  );
}

/**
 * ATENÇÃO: Sem isto, a tela de login pisca antes de a sessão ser verificada — e quem já
 * está logado vê o próprio site sugerir que não está.
 *
 * DECISÃO: A política de privacidade é pública, DE PROPÓSITO: ela precisa estar acessível
 * a quem ainda não entrou — inclusive para o Google, que exige a URL na tela de
 * consentimento e a verifica sem estar logado.
 *
 * DECISÃO: Com a leitura liberada, a conta é OPCIONAL (2026-10-02, decisão do autor):
 * o questionário funciona sem ela — as respostas não são gravadas, o cálculo é
 * na requisição. Só seguir e a própria conta pedem login, e o login volta
 * para onde a pessoa estava. RISCO: Desligado no período eleitoral (RNF-17).
 *
 * ATENÇÃO: Os endereços antigos continuam funcionando. Cinco destinos viraram três,
 * e quem tiver um link salvo não pode cair num 404 — nem ser mandado para a
 * home, que perderia a intenção de quem clicou.
 */
function RoteadorComponent() {
  const { usuario, carregando, leituraPublica } = useSessao();

  if (carregando) return <div className="carregando-inicial">{T.carregando}</div>;

  if (!usuario) {
    return (
      <Suspense fallback={<EsqueletoDeTextoComponent rotulo={T.carregandoAPagina} />}>
      <Routes>
        <Route path="/privacidade" element={<DocumentoPublicoComponent><PoliticaDePrivacidadeComponent /></DocumentoPublicoComponent>} />
        <Route path="/metodologia" element={<DocumentoPublicoComponent><MetodologiaComponent /></DocumentoPublicoComponent>} />
        {leituraPublica ? (
          <>
            <Route path="/entrar" element={<LoginComponent />} />
            <Route path="/conta" element={<LoginComponent />} />
            <Route path="*" element={<LeituraSemContaComponent />} />
          </>
        ) : (
          <Route path="*" element={<LoginComponent />} />
        )}
      </Routes>
      </Suspense>
    );
  }

  return (
    <LayoutComponent>
      <Suspense fallback={<EsqueletoDeTextoComponent rotulo={T.carregandoAPagina} />}>
      <Routes>
        <Route path="/" element={<InicioComponent />} />
        <Route path="/parlamentares" element={<ParlamentaresComponent />} />
        <Route path="/resultado" element={<QuestionarioComponent />} />
        <Route path="/parlamentar/:idPessoa/:aba?" element={<ParlamentarComponent />} />
        <Route path="/governo" element={<GovernoComponent />} />
        <Route path="/governo/cartoes" element={<GovernoComponent secao="cartoes" />} />
        <Route path="/governo/viagens" element={<ViagensDoGovernoComponent />} />
        <Route path="/governo/compras" element={<ComprasDoGovernoComponent />} />
        <Route path="/emendas" element={<EmendasComponent />} />
        <Route path="/entidades" element={<EntidadesComponent />} />
        <Route path="/entidades/:cnpj" element={<EntidadeComponent />} />
        <Route path="/orcamento" element={<Navigate to="/governo" replace />} />
        <Route path="/dinheiro" element={<Navigate to="/emendas" replace />} />
        <Route path="/conta" element={<MinhaContaComponent />} />
        <Route path="/entrar" element={<VoltarDepoisDeEntrarComponent />} />
        <Route path="/privacidade" element={<PoliticaDePrivacidadeComponent />} />
        <Route path="/metodologia" element={<MetodologiaComponent />} />

        <Route path="/explorar" element={<Navigate to="/parlamentares" replace />} />
        <Route
          path="/grafo"
          element={<Navigate to="/parlamentares?vista=grafo" replace />}
        />
        <Route path="/seguindo" element={<Navigate to="/" replace />} />
        <Route path="/questionario" element={<Navigate to="/resultado" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </LayoutComponent>
  );
}

/** O site para quem não entrou, quando a leitura está liberada: só as páginas de dado público. */
function LeituraSemContaComponent() {
  return (
    <LayoutComponent>
      <Suspense fallback={<EsqueletoDeTextoComponent rotulo={T.carregandoAPagina} />}>
      <Routes>
        <Route path="/" element={<InicioComponent />} />
        <Route path="/parlamentares" element={<ParlamentaresComponent />} />
        <Route path="/resultado" element={<QuestionarioComponent />} />
        <Route path="/parlamentar/:idPessoa/:aba?" element={<ParlamentarComponent />} />
        <Route path="/governo" element={<GovernoComponent />} />
        <Route path="/governo/cartoes" element={<GovernoComponent secao="cartoes" />} />
        <Route path="/governo/viagens" element={<ViagensDoGovernoComponent />} />
        <Route path="/governo/compras" element={<ComprasDoGovernoComponent />} />
        <Route path="/emendas" element={<EmendasComponent />} />
        <Route path="/entidades" element={<EntidadesComponent />} />
        <Route path="/entidades/:cnpj" element={<EntidadeComponent />} />
        <Route path="/questionario" element={<Navigate to="/resultado" replace />} />
        <Route path="/explorar" element={<Navigate to="/parlamentares" replace />} />
        <Route path="/grafo" element={<Navigate to="/parlamentares?vista=grafo" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </LayoutComponent>
  );
}

/** Depois de entrar, de volta para onde a pessoa estava — seguir alguém, a própria conta. */
function VoltarDepoisDeEntrarComponent() {
  const [parametros] = useSearchParams();
  return <Navigate to={destinoSeguro(parametros.get('voltar'))} replace />;
}

/**
 * Página acessível sem login, com o mínimo de moldura: a política de privacidade e o
 * "Como calculamos". Nenhuma das duas mostra dado de ninguém.
 */
function DocumentoPublicoComponent({ children }: { children: ReactNode }) {
  return (
    <div className="documento-publico">
      <header className="cabecalho-publico">
        <Link to="/" className="marca-link">
          {T.marca}
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
