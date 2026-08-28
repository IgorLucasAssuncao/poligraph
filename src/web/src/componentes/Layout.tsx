import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { obterPanorama } from '../api';
import { Avatar } from './Avatar';
import {
  IconeExplorar,
  IconeInicio,
  IconeQuestionario,
  IconeVoltar,
  Marca,
} from './Icones';
import { SeletorDeTema } from './SeletorDeTema';
import { useSessao } from '../sessao';

/**
 * A largura útil de uma tela.
 *
 * ⭐ É por página, ⛔ não global. A coluna única de 52rem servia a tudo, e cobrava caro
 * onde não devia: num monitor de 2560px o grafo desenhava 643 nós em 832px, com uma
 * barra de sugestões de 21rem ao lado.
 */
type Largura = 'ampla' | 'media' | 'estreita';

/**
 * Quanto espaço cada rota pede.
 *
 * ⚠️ Mora aqui, e ⛔ não numa prop passada por cada página: a moldura já conhece a
 * rota, e obrigar toda tela a declarar a própria largura significa que a próxima
 * esquece — e herda a errada em silêncio.
 */
const LARGURA: { padrao: Largura; rotas: [string, Largura][] } = {
  padrao: 'media',
  rotas: [
    ['/', 'ampla'],                 // painel: números e o grafo lado a lado
    ['/parlamentares', 'ampla'],    // lista e grafo, os dois querem largura
    ['/resultado', 'estreita'],     // uma pergunta por vez — largo atrapalha ler
    ['/conta', 'estreita'],
    ['/privacidade', 'estreita'],   // texto corrido
  ],
};

/**
 * A moldura do site.
 *
 * ## Uma barra, ⛔ não três
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
    <div className="site">
      <CabecalhoDoSite />

      <main className="corpo" data-largura={largura}>
        {children}
      </main>

      <RodapeDoSite />
    </div>
  );
}

/**
 * Título de uma tela que precisa de um.
 *
 * ⚠️ A maioria ⛔ não precisa: o item aceso da navegação já diz onde a pessoa está.
 * Sobra para as telas que a navegação ⛔ não alcança — o perfil de um parlamentar, que
 * tem nome próprio e um caminho de volta.
 */
export function CabecalhoDaColuna({
  titulo,
  subtitulo,
  comVoltar,
}: {
  titulo: string;
  subtitulo?: string;
  comVoltar?: boolean;
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
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════════

/**
 * ⭐ Três destinos, ⛔ não cinco.
 *
 * "Início" e "Seguindo" dependiam os dois de a pessoa já seguir alguém, e mostravam a
 * mesma lista de duas formas. "Explorar" e "Grafo" eram duas vistas do mesmo conjunto
 * de parlamentares — separá-las em abas do menu obrigava a sair de uma para ver a
 * outra, quando a pergunta é a mesma.
 */
const DESTINOS = [
  { para: '/', rotulo: 'Início', icone: <IconeInicio /> },
  { para: '/parlamentares', rotulo: 'Parlamentares', icone: <IconeExplorar /> },
  { para: '/resultado', rotulo: 'Meu resultado', icone: <IconeQuestionario /> },
];

function CabecalhoDoSite() {
  const { usuario, sair } = useSessao();

  return (
    <header className="cabecalho-site">
      <div className="cabecalho-conteudo">
        <Link to="/" className="marca-link" aria-label="Registro Aberto — início">
          <Marca />
          <span className="marca-texto">Registro Aberto</span>
        </Link>

        <nav className="nav-principal" aria-label="Navegação principal">
          {DESTINOS.map((destino) => (
            <NavLink
              key={destino.para}
              to={destino.para}
              end={destino.para === '/'}
              className="nav-item"
              viewTransition
            >
              {destino.icone}
              <span>{destino.rotulo}</span>
            </NavLink>
          ))}
        </nav>

        <div className="cabecalho-conta">
          <SeletorDeTema />

          <Link to="/conta" className="usuario-mini">
            <Avatar nome={usuario?.nome ?? '?'} fotoUrl={usuario?.fotoUrl} tamanho="pequeno" />
            <span className="usuario-mini-nome">{usuario?.nome?.split(' ')[0] ?? 'Conta'}</span>
          </Link>
          <button type="button" className="botao-texto" onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * 🔴 O aviso da RNF-14 vive aqui, e por isso aparece em TODA tela — não só na de
 * resultado, que era onde estava antes.
 *
 * ⭐ A procedência do dado desceu para cá. Ela precisa estar dita, e estava numa faixa
 * preta no topo de toda página: o lugar de maior custo da tela para uma informação que
 * se lê uma vez.
 */
function RodapeDoSite() {
  const [legislatura, setLegislatura] = useState<number | null>(null);

  useEffect(() => {
    obterPanorama()
      .then((p) => setLegislatura(p.legislatura))
      .catch(() => setLegislatura(null));
  }, []);

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
            {/* 🔴 PL35 — a legislatura vem do DADO, ⛔ nunca de um literal. Escrita à
                mão aqui, ela continuaria dizendo "57ª" depois de a 58ª entrar na base,
                e o rodapé creditaria a procedência errada sem nada quebrar. */}
            {legislatura ? `, ${legislatura}ª legislatura` : ''}. Nenhum voto é editado:
            a curadoria reescreve a ementa e registra a polaridade da votação.
          </p>
        </section>

        <section>
          <h2>Seus dados</h2>
          <p>
            <Link to="/privacidade">Política de privacidade</Link>
            <br />
            <Link to="/conta">Apagar minha conta</Link>
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
