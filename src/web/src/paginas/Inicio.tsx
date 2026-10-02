import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarNoticiasDosSeguidos,
  listarSeguidos,
  NOME_DA_CASA,
  obterGrafo,
  obterPanorama,
  type Grafo as DadosDoGrafo,
  type NoticiaDeSeguido,
  type Panorama,
  type PanoramaDaCasa,
  type Parlamentar,
} from '../api';
import { Avatar } from '../componentes/Avatar';
import { LegendaDoGrafo } from '../componentes/LegendaDoGrafo';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { SugestoesParaSeguir } from '../componentes/SugestoesParaSeguir';
import { TelaDoGrafo } from '../componentes/TelaDoGrafo';
import { useSessao } from '../sessao';
import { EsqueletoDePainel } from '../componentes/Esqueleto';


/**
 * A porta de entrada.
 *
 * ## Por que deixou de ser um feed
 *
 * Era um feed das notícias de quem a pessoa segue — e o coletor de notícias ⛔ não
 * existe: `noticias.py` está escrito e testado, mas nenhum comando o executa, e a
 * tabela tem zero linhas. A primeira tela do produto era, por construção, a única que
 * ⛔ não mostrava nada do que o trabalho faz. Enquanto isso 470 mil votos, 5.259
 * ligações e 17 comunidades ficavam atrás de outras abas.
 *
 * ⭐ Agora ela abre com o tamanho da base e com o desenho. O feed continua aqui, e
 * aparece **quando houver notícia** — deixou de ser a tela e virou uma seção dela.
 */
export function Inicio() {
  const { usuario } = useSessao();
  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [seguidos, setSeguidos] = useState<Parlamentar[]>([]);
  const [itens, setItens] = useState<NoticiaDeSeguido[]>([]);

  useEffect(() => {
    obterPanorama().then(setPanorama).catch(() => setPanorama(null));

    // Sem conta não há seguidos, e a lista responderia 401.
    if (!usuario) return;

    listarSeguidos().then(setSeguidos).catch(() => setSeguidos([]));

    // ⭐ Uma requisição para o feed inteiro. Eram uma por seguido, juntadas aqui.
    listarNoticiasDosSeguidos().then(setItens).catch(() => setItens([]));
  }, [usuario]);

  return (
    <div className="painel-com-trilho">
      <div className="painel">
        <section className="painel-abertura">
          <h1>Quem vota como você</h1>

          <p>
            A afinidade sai do <strong>voto registrado em plenário</strong>, não de
            autodeclaração ideológica.
            {panorama && panorama.perguntasNoQuestionario > 0 ? (
              <>
                {' '}Você responde <strong>{panorama.perguntasNoQuestionario} perguntas</strong>,
                escolhidas entre {panorama.perguntasAtivas} votações nominais reais
                {panorama.legislatura ? ` da ${panorama.legislatura}ª legislatura` : ''}.
              </>
            ) : (
              ' Cada pergunta do questionário vem de uma votação nominal real.'
            )}
          </p>

          <div className="painel-acoes" data-tour="comecar">
            <Link to="/resultado" className="botao-destaque">
              Compare seu voto
            </Link>
            <Link to="/parlamentares" className="botao-secundario">
              Ver os parlamentares
            </Link>
          </div>
        </section>

        {panorama ? (
          <Base panorama={panorama} />
        ) : (
          <EsqueletoDePainel rotulo="Carregando o tamanho da base" cartoes={2} alturaDoGrafico={0} />
        )}

        <GrafoDaAbertura />

        {seguidos.length > 0 && (
          <section className="painel-secao">
            <h2>Quem você segue</h2>
            {seguidos.slice(0, 5).map((p) => (
              <LinhaParlamentar
                key={p.id}
                id={p.id}
                nome={p.nome}
                partido={p.partido}
                uf={p.uf}
                fotoUrl={p.urlFoto}
                seguindo
                aoAlternarSeguir={(id) => setSeguidos((l) => l.filter((x) => x.id !== id))}
              />
            ))}

            {/* 🔴 LGPD art. 5º, II — esta lista indica convicção política, e o caminho
                para apagá-la anda junto dela. */}
            <p className="nota-privacidade">
              🔒 Esta lista indica sua posição política e é tratada como dado sensível. Ela
              não é compartilhada com ninguém. <Link to="/conta">Como apagar tudo</Link>
            </p>
          </section>
        )}

        {itens.length > 0 && (
          <section className="painel-secao">
            <h2>Notícias de quem você segue</h2>
            {itens.map((item) => (
              <ItemDeNoticia key={`${item.pessoaId}-${item.noticia.id}`} item={item} />
            ))}
          </section>
        )}

        {/* ⚠️ Só para quem já acompanha alguém: anunciar a seção a quem ⛔ não segue
            ninguém seria explicar uma função que ainda ⛔ não tem como aparecer. */}
        {itens.length === 0 && seguidos.length > 0 && <NoticiasAindaNao />}
      </div>

      {/* ⭐ O trilho da direita, como no X. ⚠️ A ordem ⛔ não é editorial: são os
          parlamentares com mais votações registradas, ou seja, os de mais dado
          disponível — e a própria tela diz isso, para ⛔ não ler como destaque nosso
          (RNF-16). */}
      <aside className="painel-trilho">
        <SugestoesParaSeguir />
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════

/**
 * O grafo da Câmara na página inicial — buscado só quando a seção chega perto da tela.
 *
 * ⚠️ É a maior resposta do site (~580 KB e ~0,6 s medidos em 2026-10-01), e vinha para
 * todo visitante, inclusive quem clicava em "Compare seu voto" sem rolar. A seção
 * reserva a altura do desenho enquanto espera, para a página ⛔ pular quando ele chega.
 *
 * ⭐ Sem `IntersectionObserver` (testes, navegador antigo), busca de imediato.
 */
function GrafoDaAbertura() {
  const marco = useRef<HTMLElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [grafo, setGrafo] = useState<DadosDoGrafo | null | 'vazio'>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !marco.current) {
      setVisivel(true);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          observador.disconnect();
        }
      },
      { rootMargin: '400px 0px' },
    );
    observador.observe(marco.current);

    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;

    obterGrafo('CAMARA')
      .then((g) => setGrafo(g.nos.length > 0 ? g : 'vazio'))
      .catch(() => setGrafo('vazio'));
  }, [visivel]);

  if (grafo === 'vazio') return null;

  return (
    <section className="painel-secao" ref={marco}>
      <h2>Como a Câmara se agrupa</h2>
      {grafo ? (
        <TelaDoGrafo grafo={grafo} altura={460} />
      ) : (
        <div className="grafo-reserva" style={{ height: 460 }} aria-hidden="true" />
      )}

      <LegendaDoGrafo />

      <Link to="/parlamentares?vista=grafo" className="painel-mais">
        Abrir o grafo completo
      </Link>
    </section>
  );
}

/** O tamanho da base, por casa — o que sustenta tudo o que a tela afirma. */
function Base({ panorama }: { panorama: Panorama }) {
  if (panorama.porCasa.length === 0) {
    // ⭐ Estado honesto do primeiro dia: ⛔ não inventa número nenhum.
    return (
      <section className="painel-secao">
        <p className="vazio">
          A base ainda não foi ingerida. Os números aparecem depois da primeira execução
          do ETL.
        </p>
      </section>
    );
  }

  return (
    <section className="painel-secao">
      <h2>
        A base <small>{panorama.legislatura}ª legislatura</small>
      </h2>

      <div className="painel-casas">
        {panorama.porCasa.map((casa) => (
          <CartaoDaCasa key={casa.casa} casa={casa} />
        ))}
      </div>
    </section>
  );
}

function CartaoDaCasa({ casa }: { casa: PanoramaDaCasa }) {
  const nome = NOME_DA_CASA[casa.casa];
  const abertas = casa.votacoes - casa.votacoesSecretas;

  return (
    <article className="cartao-casa">
      <h3>{nome.nome}</h3>

      <dl>
        <div>
          <dt>{nome.plural}</dt>
          <dd>{casa.parlamentares.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>votações</dt>
          <dd>{casa.votacoes.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>votos com posição</dt>
          <dd>{casa.votosComPosicao.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>grupos de voto</dt>
          <dd>{casa.comunidades.toLocaleString('pt-BR')}</dd>
        </div>
      </dl>

      {/* 🔴 O sigilo muda o que a figura daquela casa pode afirmar, e omiti-lo faria as
          duas parecerem comparáveis. É achado do trabalho, não rodapé. */}
      {casa.votacoesSecretas > 0 && (
        <p className="cartao-ressalva">
          <strong>
            {Math.round((casa.votacoesSecretas / casa.votacoes) * 100)}% das votações são
            secretas
          </strong>{' '}
          e não têm voto individual publicado. A comparação se apoia nas {abertas}{' '}
          abertas.
        </p>
      )}
    </article>
  );
}

/**
 * O lugar das notícias, quando nenhuma cita quem a pessoa segue.
 *
 * 🔴 <b>Esqueleto, ⛔ nunca manchete de exemplo.</b> Isto é uma ferramenta que credita
 * a procedência de cada número que exibe; inventar um título e um veículo para mostrar
 * o layout produziria, na tela, exatamente a coisa que o trabalho existe para ⛔ não
 * fazer. As barras cinzas mostram a forma sem afirmar nada.
 *
 * ⚠️ O texto dizia que o coletor "não está em operação". Está desde 2026-08-29: o vazio
 * agora quer dizer que nenhuma notícia recente citou alguém da lista.
 */
function NoticiasAindaNao() {
  return (
    <section className="painel-secao">
      <h2>Notícias de quem você segue</h2>
      <p className="ajuda">
        Nenhuma notícia recente cita quem você segue. As notícias vêm da Agência
        Câmara, da Agência Senado e da Agência Brasil; quando uma delas citar alguém da
        sua lista, aparece aqui com o veículo, a data e o motivo.
      </p>

      <div className="esqueleto-lista" aria-hidden="true">
        {[0, 1].map((linha) => (
          <article className="linha esqueleto" key={linha}>
            <span className="esqueleto-avatar" />
            <div className="linha-corpo">
              <span className="esqueleto-barra" style={{ width: '38%' }} />
              <span className="esqueleto-barra alta" style={{ width: '86%' }} />
              <span className="esqueleto-barra" style={{ width: '52%' }} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ItemDeNoticia({ item }: { item: NoticiaDeSeguido }) {
  const { noticia } = item;

  return (
    <article className="linha">
      <Link to={`/parlamentar/${item.pessoaId}`} aria-label={item.nome}>
        <Avatar nome={item.nome} fotoUrl={item.urlFoto} tamanho="medio" />
      </Link>

      <div className="linha-corpo">
        <div className="linha-topo">
          <Link to={`/parlamentar/${item.pessoaId}`} className="linha-nome">
            {item.nome}
          </Link>
          <span className="linha-meta">
            {noticia.veiculo} · {new Date(noticia.publicadaEm).toLocaleDateString('pt-BR')}
          </span>
        </div>

        <a className="noticia-titulo" href={noticia.url} target="_blank" rel="noreferrer noopener">
          {noticia.titulo}
        </a>

        {/* RF-46 — por que isto apareceu */}
        <span className="linha-detalhe">porque você segue {item.nome}</span>
      </div>
    </article>
  );
}
