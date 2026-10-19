import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ehDinheiroPublico } from '../navegacao';
import { useSessao } from '../sessao';
import { BuscaDoCabecalhoComponent } from './BuscaDoCabecalho';
import { FaixaDeProcedenciaComponent } from './FaixaDeProcedencia';
import { IconeExplorarComponent, IconeOrcamentoComponent, IconeQuestionarioComponent, IconeVoltarComponent, MarcaComponent } from './Icones';
import { MenuDaContaComponent } from './MenuDaConta';
import { SininhoComponent } from './Sininho';
import { AvisoDeSeguidosEncerradosComponent } from './AvisoDeSeguidosEncerrados';
import { InterruptorDoModoAuditoriaComponent, ProvedorDoModoAuditoriaComponent } from './ModoAuditoria';
import { ProvedorDoTourComponent } from './Tour';
import { useLegislaturaDaUrl, useLegislaturas } from './useLegislatura';
import { TEXTOS_DO_SITE as T } from '../textos/site';
import { useRef } from 'react';
import { useEntradaAoNavegar } from '../transicao';

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
    ['/', 'ampla'],
    ['/parlamentares', 'ampla'],
    ['/resultado', 'estreita'],
    ['/parlamentar/', 'larga'],
    ['/emendas', 'larga'],
    ['/entidades', 'larga'],
    ['/governo', 'larga'],
    ['/conta', 'estreita'],
    ['/privacidade', 'estreita'],
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
/**
 * A página de um endereço, sem a aba: `/parlamentar/154/cota` e `/parlamentar/154` são a mesma.
 *
 * DECISÃO (2026-10-10): trocar de aba não anima a página inteira; quem anima é o conteúdo da aba,
 * com o `AtualizandoComponent`.
 */
function paginaDoEndereco(pathname: string): string {
  const [primeiro, segundo] = pathname.split('/').filter(Boolean);
  return /^\d+$/.test(segundo ?? '') ? `${primeiro}/${segundo}` : (primeiro ?? '');
}

export function LayoutComponent({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const corpo = useRef<HTMLElement>(null);
  useEntradaAoNavegar(corpo, paginaDoEndereco(pathname));

  const largura =
    LARGURA.rotas.find(([rota]) =>
      rota === '/' ? pathname === '/' : pathname.startsWith(rota),
    )?.[1] ?? LARGURA.padrao;

  return (
    <ProvedorDoTourComponent>
      <ProvedorDoModoAuditoriaComponent>
        <div className="site">
          <FaixaDeProcedenciaComponent />
          <CabecalhoDoSiteComponent />

          <main ref={corpo} className="corpo" data-largura={largura}>
            <AvisoDeSeguidosEncerradosComponent />
            {children}
          </main>

          <RodapeDoSiteComponent />
        </div>
      </ProvedorDoModoAuditoriaComponent>
    </ProvedorDoTourComponent>
  );
}

/**
 * Título de uma tela que precisa de um.
 *
 * ATENÇÃO: A maioria não precisa: o item aceso da navegação já diz onde a pessoa está.
 * Sobra para as telas que a navegação não alcança — o perfil de um parlamentar, que
 * tem nome próprio e um caminho de volta.
 */
export function CabecalhoDaColunaComponent({
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
          onClick={() => void navegar(-1)}
          aria-label={T.voltar}
        >
          <IconeVoltarComponent />
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
  { para: '/parlamentares', rotulo: T.destinos.parlamentares, icone: <IconeExplorarComponent /> },
  { para: '/resultado', rotulo: T.destinos.compare, icone: <IconeQuestionarioComponent /> },
  { para: '/emendas', rotulo: T.destinos.dinheiro, icone: <IconeOrcamentoComponent /> },
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
function CabecalhoDoSiteComponent() {
  const { pathname } = useLocation();
  const [escolha] = useLegislaturaDaUrl();
  const comPeriodo = (rota: string) => (escolha === undefined ? rota : `${rota}?legislatura=${escolha}`);

  return (
    <header className="cabecalho-site">
      <div className="cabecalho-conteudo">
        <Link to={comPeriodo('/')} className="marca-link" aria-label={T.marcaInicio}>
          <MarcaComponent />
          <span className="marca-texto">{T.marca}</span>
        </Link>

        <nav className="nav-principal" aria-label={T.navegacao}>
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

        <BuscaDoCabecalhoComponent />
        <InterruptorDoModoAuditoriaComponent />
        <div className="cabecalho-pessoal">
          <SininhoComponent />
          <MenuDaContaComponent />
        </div>
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
function RodapeDoSiteComponent() {
  const { usuario } = useSessao();
  const legislaturas = useLegislaturas();
  const maisAntiga = legislaturas?.at(-1)?.numero;
  const corrente = legislaturas?.[0]?.numero;

  return (
    <footer className="rodape-site">
      <div className="rodape-conteudo">
        <section>
          <h2>{T.rodape.oQueE}</h2>
          <p>{T.rodape.oQueETexto}</p>
        </section>

        <section>
          <h2>{T.rodape.procedencia}</h2>
          <p>{T.rodape.procedenciaTexto(maisAntiga, corrente)}</p>
        </section>

        <section>
          <h2>{T.rodape.seusDados}</h2>
          <p>
            <Link to="/metodologia">{T.rodape.comoCalculamos}</Link>
            <br />
            <Link to="/privacidade">{T.rodape.privacidade}</Link>
            {usuario && (
              <>
                <br />
                <Link to="/conta">{T.rodape.apagarConta}</Link>
              </>
            )}
          </p>
        </section>
      </div>

      <div className="rodape-aviso">
        <p>{T.rodape.aviso}</p>
      </div>
    </footer>
  );
}
