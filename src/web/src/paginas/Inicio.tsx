import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarSeguidos,
  NOME_DA_CASA,
  obterGrafo,
  obterNoticias,
  obterPanorama,
  type Grafo as DadosDoGrafo,
  type Noticia,
  type Panorama,
  type PanoramaDaCasa,
  type Parlamentar,
} from '../api';
import { Avatar } from '../componentes/Avatar';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { SugestoesParaSeguir } from '../componentes/SugestoesParaSeguir';
import { TelaDoGrafo } from '../componentes/TelaDoGrafo';

type ItemDoFeed = Noticia & { deQuem: Parlamentar };

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
  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [grafo, setGrafo] = useState<DadosDoGrafo | null>(null);
  const [seguidos, setSeguidos] = useState<Parlamentar[]>([]);
  const [itens, setItens] = useState<ItemDoFeed[]>([]);

  useEffect(() => {
    obterPanorama().then(setPanorama).catch(() => setPanorama(null));

    // ⚠️ O grafo vem depois e sem bloquear: são alguns MB, e o resto da página ⛔ não
    //    depende dele para ter sentido.
    obterGrafo('CAMARA').then(setGrafo).catch(() => setGrafo(null));

    listarSeguidos()
      .then(async (lista) => {
        setSeguidos(lista);

        const porParlamentar = await Promise.all(
          lista.map(async (p) => (await obterNoticias(p.id)).map((n) => ({ ...n, deQuem: p }))),
        );

        setItens(
          porParlamentar
            .flat()
            .sort((a, b) => +new Date(b.publicadaEm) - +new Date(a.publicadaEm)),
        );
      })
      .catch(() => setSeguidos([]));
  }, []);

  return (
    <div className="painel-com-trilho">
      <div className="painel">
        <section className="painel-abertura">
          <h1>Quem vota como você</h1>

          <p>
            A afinidade sai do <strong>voto registrado em plenário</strong>, não de
            autodeclaração ideológica.
            {panorama && panorama.perguntasAtivas > 0 ? (
              <>
                {' '}São <strong>{panorama.perguntasAtivas} perguntas</strong>, e cada uma
                vem de uma votação nominal real
                {panorama.legislatura ? ` da ${panorama.legislatura}ª legislatura` : ''}.
              </>
            ) : (
              ' Cada pergunta do questionário vem de uma votação nominal real.'
            )}
          </p>

          <div className="painel-acoes">
            <Link to="/resultado" className="botao-destaque">
              Responder o questionário
            </Link>
            <Link to="/parlamentares" className="botao-secundario">
              Ver os parlamentares
            </Link>
          </div>
        </section>

        {panorama && <Base panorama={panorama} />}

        {grafo && grafo.nos.length > 0 && (
          <section className="painel-secao">
            <h2>Como a Câmara se agrupa</h2>
            <p className="ajuda">
              Cada ponto é um deputado; dois se ligam quando votaram parecido em pelo menos
              20 votações. <strong>A posição não é um espectro</strong> — o desenho só
              aproxima quem vota junto, e as cores identificam grupos formados pelo voto,
              não pelo partido.
            </p>

            <TelaDoGrafo grafo={grafo} altura={460} />

            <Link to="/parlamentares?vista=grafo" className="painel-mais">
              Abrir o grafo completo
            </Link>
          </section>
        )}

        {seguidos.length > 0 && (
          <section className="painel-secao">
            <h2>Você acompanha</h2>
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
            <h2>Notícias de quem você acompanha</h2>
            {itens.map((item) => (
              <ItemDeNoticia key={item.id} item={item} />
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
 * O lugar das notícias, antes de existir notícia.
 *
 * 🔴 <b>Esqueleto, ⛔ nunca manchete de exemplo.</b> Isto é uma ferramenta que credita
 * a procedência de cada número que exibe; inventar um título e um veículo para mostrar
 * o layout produziria, na tela, exatamente a coisa que o trabalho existe para ⛔ não
 * fazer. As barras cinzas mostram a forma sem afirmar nada.
 *
 * ⚠️ E diz o estado de verdade: o coletor está escrito e testado, e ⛔ não é executado
 * por comando nenhum.
 */
function NoticiasAindaNao() {
  return (
    <section className="painel-secao">
      <h2>Notícias de quem você acompanha</h2>
      <p className="ajuda">
        Ainda não há nada aqui: o coletor de notícias não está em operação. Quando
        estiver, cada item vai trazer o veículo, a data e o motivo de ter aparecido.
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

function ItemDeNoticia({ item }: { item: ItemDoFeed }) {
  return (
    <article className="linha">
      <Link to={`/parlamentar/${item.deQuem.id}`} aria-label={item.deQuem.nome}>
        <Avatar nome={item.deQuem.nome} fotoUrl={item.deQuem.urlFoto} tamanho="medio" />
      </Link>

      <div className="linha-corpo">
        <div className="linha-topo">
          <Link to={`/parlamentar/${item.deQuem.id}`} className="linha-nome">
            {item.deQuem.nome}
          </Link>
          <span className="linha-meta">
            {item.veiculo} · {new Date(item.publicadaEm).toLocaleDateString('pt-BR')}
          </span>
        </div>

        <a className="noticia-titulo" href={item.url} target="_blank" rel="noreferrer noopener">
          {item.titulo}
        </a>

        {/* RF-46 — por que isto apareceu */}
        <span className="linha-detalhe">porque você segue {item.deQuem.nome}</span>
      </div>
    </article>
  );
}
