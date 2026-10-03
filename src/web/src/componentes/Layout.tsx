import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ehDinheiroPublico } from '../navegacao';
import { useSessao } from '../sessao';
import { BuscaDoCabecalho } from './BuscaDoCabecalho';
import { FaixaDeProcedencia } from './FaixaDeProcedencia';
import { IconeExplorar, IconeOrcamento, IconeQuestionario, IconeVoltar, Marca } from './Icones';
import { MenuDaConta } from './MenuDaConta';
import { InterruptorDoModoAnalise, ProvedorDoModoAnalise } from './ModoAnalise';
import { ProvedorDoTour } from './Tour';
import { useLegislaturaDaUrl, useLegislaturas } from './useLegislatura';

/**
 * A largura útil de uma tela.
 *
 * DECISÃO: É por página, não global. A coluna única de 52rem servia a tudo, e cobrava caro
 * onde não devia: num monitor de 2560px o grafo desenhava 643 nós em 832px, com uma
 * barra de sugestões de 21rem ao lado.
 */
type Largura = 'ampla' | 'larga' | 'media' | 'estreita';

/**
 * Quanto espaço cada rota pede.
 *
 * ATENÇÃO: Mora aqui, e não numa prop passada por cada página: a moldura já conhece a
 * rota, e obrigar toda tela a declarar a própria largura significa que a próxima
 * esquece — e herda a errada em silêncio.
 *
 * DECISÃO (2026-10-03): `larga` (76rem) para a ficha e as telas de dinheiro. Em 60rem as duas
 * colunas das abas cortavam nomes de cidade e de doador, e sobrava um quarto da tela de cada lado.
 */
const LARGURA: { padrao: Largura; rotas: [string, Largura][] } = {
  padrao: 'media',
  rotas: [
    ['/', 'ampla'],                 // painel: números e o grafo lado a lado
    ['/parlamentares', 'ampla'],    // lista e grafo, os dois querem largura
    ['/resultado', 'estreita'],     // uma pergunta por vez — largo atrapalha ler
    ['/parlamentar/', 'larga'],
    ['/emendas', 'larga'],
    ['/entidades', 'larga'],
    ['/governo', 'larga'],
    ['/conta', 'estreita'],
    ['/privacidade', 'estreita'],   // texto corrido
  ],
};

/**
 * A moldura do site.
 *
 * ## Uma barra, não três
 *
 * Havia faixa de procedência, cabeçalho do site e cabeçalho da coluna — 136px antes de
 * qualquer conteúdo, 110px deles grudados na tela para sempre. Numa janela de 800px de
 * altura isso é 14% dela, permanente, para dizer três vezes onde a pessoa está.
 *
 * A procedência desceu para o rodapé, que já tinha uma seção sobre isso. O título da
 * página saiu: o item aceso da navegação já o diz, e repeti-lo logo abaixo era a
 * própria definição de moldura redundante.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  const largura =
    LARGURA.rotas.find(([rota]) =>
      rota === '/' ? pathname === '/' : pathname.startsWith(rota),
    )?.[1] ?? LARGURA.padrao;

  return (
    <ProvedorDoTour>
      <ProvedorDoModoAnalise>
        <div className="site">
          <FaixaDeProcedencia />
          <CabecalhoDoSite />

          <main className="corpo" data-largura={largura}>
            {children}
          </main>

          <RodapeDoSite />
        </div>
      </ProvedorDoModoAnalise>
    </ProvedorDoTour>
  );
}

/**
 * Título de uma tela que precisa de um.
 *
 * ATENÇÃO: A maioria não precisa: o item aceso da navegação já diz onde a pessoa está.
 * Sobra para as telas que a navegação não alcança — o perfil de um parlamentar, que
 * tem nome próprio e um caminho de volta.
 */
export function CabecalhoDaColuna({
  titulo,
  subtitulo,
  comVoltar,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  comVoltar?: boolean;
  /** À direita do título, no mesmo lugar em toda tela: o "Entenda esta tela". */
  acao?: React.ReactNode;
}) {
  const navegar = useNavigate();

  return (
    <header className="cabecalho-pagina">
      {comVoltar && (
        <button
          type="button"
          className="botao-icone"
          onClick={() => navegar(-1)}
          aria-label="Voltar"
        >
          <IconeVoltar />
        </button>
      )}

      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {acao && <div className="cabecalho-pagina-acao">{acao}</div>}
    </header>
  );
}

/**
 * DECISÃO: As três intenções de quem usa, não as fontes de dado que temos (ver `navegacao.ts`).
 *
 * Eram cinco destinos — Início, Parlamentares, Compare seu voto, Emendas, Governo — e
 * "Entidades" seria o sexto. Emendas, Entidades e Governo respondem a mesma pergunta,
 * "para onde vai o dinheiro", e viraram abas de um destino só. O Início continua na marca.
 */
const DESTINOS = [
  { para: '/parlamentares', rotulo: 'Parlamentares', icone: <IconeExplorar /> },
  { para: '/resultado', rotulo: 'Compare seu voto', icone: <IconeQuestionario /> },
  { para: '/emendas', rotulo: 'Dinheiro público', icone: <IconeOrcamento /> },
];

/**
 * Marca, as três intenções, a busca e a conta.
 *
 * DECISÃO: Eram onze elementos na barra. A busca responde a quem chega com um nome; o resto da
 * conta — tema, tour, sair — foi para o menu, porque se usa uma vez por visita, ou nenhuma.
 *
 * DECISÃO: O período escolhido acompanha quem vai do início para os parlamentares e volta.
 * Sem isto, a escolha feita na faixa se perdia no primeiro clique do menu.
 */
function CabecalhoDoSite() {
  const { pathname } = useLocation();
  const [escolha] = useLegislaturaDaUrl();
  const comPeriodo = (rota: string) => (escolha === undefined ? rota : `${rota}?legislatura=${escolha}`);

  return (
    <header className="cabecalho-site">
      <div className="cabecalho-conteudo">
        <Link to={comPeriodo('/')} className="marca-link" aria-label="Registro Aberto — início">
          <Marca />
          <span className="marca-texto">Registro Aberto</span>
        </Link>

        <nav className="nav-principal" aria-label="Navegação principal">
          {DESTINOS.map((destino) => (
            <NavLink
              key={destino.para}
              to={destino.para === '/parlamentares' ? comPeriodo(destino.para) : destino.para}
              className={({ isActive }) =>
                `nav-item ${isActive || (destino.para === '/emendas' && ehDinheiroPublico(pathname)) ? 'active' : ''}`
              }
              viewTransition
            >
              {destino.icone}
              <span>{destino.rotulo}</span>
            </NavLink>
          ))}
        </nav>

        <BuscaDoCabecalho />
        <InterruptorDoModoAnalise />
        <MenuDaConta />
      </div>
    </header>
  );
}

/**
 * RISCO: O aviso da RNF-14 vive aqui, e por isso aparece em TODA tela — não só na de
 * resultado, que era onde estava antes.
 *
 * DECISÃO: A procedência do dado desceu para cá. Ela precisa estar dita, e estava numa faixa
 * preta no topo de toda página: o lugar de maior custo da tela para uma informação que
 * se lê uma vez.
 *
 * RISCO: Pendência 35 — a legislatura vem do DADO, nunca de um literal. Escrita à
 * mão aqui, ela continuaria dizendo "57ª" depois de a 58ª entrar na base,
 * e o rodapé creditaria a procedência errada sem nada quebrar.
 *
 * ATENÇÃO: Dizia só a corrente. Com o histórico na base, o crédito é do intervalo.
 */
function RodapeDoSite() {
  const { usuario } = useSessao();
  const legislaturas = useLegislaturas();
  const maisAntiga = legislaturas?.at(-1)?.numero;
  const corrente = legislaturas?.[0]?.numero;

  return (
    <footer className="rodape-site">
      <div className="rodape-conteudo">
        <section>
          <h2>O que é</h2>
          <p>
            Compara sua posição com o voto registrado em plenário. A afinidade sai do
            comportamento revelado de voto, não de autodeclaração ideológica.
          </p>
        </section>

        <section>
          <h2>Procedência</h2>
          <p>
            Registro nominal de votação dos Dados Abertos da Câmara dos Deputados e do
            Senado Federal
            {maisAntiga && corrente
              ? maisAntiga === corrente
                ? `, ${corrente}ª legislatura`
                : `, da ${maisAntiga}ª à ${corrente}ª legislatura`
              : ''}
            . Nenhum voto é editado:
            a curadoria reescreve a ementa e registra a polaridade da votação.
          </p>
        </section>

        <section>
          <h2>Seus dados</h2>
          <p>
            <Link to="/metodologia">Como calculamos</Link>
            <br />
            <Link to="/privacidade">Política de privacidade</Link>
            {usuario && (
              <>
                <br />
                <Link to="/conta">Apagar minha conta</Link>
              </>
            )}
          </p>
        </section>
      </div>

      <div className="rodape-aviso">
        <p>
          Trabalho de conclusão de curso — ferramenta acadêmica de comparação de votos.{' '}
          <strong>Não é recomendação de voto</strong> e não representa o programa completo
          de nenhum parlamentar.
        </p>
      </div>
    </footer>
  );
}
