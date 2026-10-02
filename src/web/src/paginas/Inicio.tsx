import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listarSeguidos,
  NOME_DA_CASA,
  obterGrafo,
  obterPanorama,
  type Grafo as DadosDoGrafo,
  type Panorama,
  type PanoramaDaCasa,
  type Parlamentar,
} from '../api';
import { LegendaDoGrafo } from '../componentes/LegendaDoGrafo';
import { LinhaParlamentar } from '../componentes/LinhaParlamentar';
import { SugestoesParaSeguir } from '../componentes/SugestoesParaSeguir';
import { TelaDoGrafo } from '../componentes/TelaDoGrafo';
import { useSessao } from '../sessao';
import { EsqueletoDePainel } from '../componentes/Esqueleto';
import { useLegislaturaDaUrl, useLegislaturas } from '../componentes/useLegislatura';
import { BarraDePeriodo } from '../componentes/BarraDePeriodo';
import { periodoDaLegislatura } from '../formato';

/**
 * A porta de entrada.
 *
 * ## Por que deixou de ser um feed
 *
 * Era um feed das notícias de quem a pessoa segue — e o coletor de notícias não
 * existe: `noticias.py` está escrito e testado, mas nenhum comando o executa, e a
 * tabela tem zero linhas. A primeira tela do produto era, por construção, a única que
 * não mostrava nada do que o trabalho faz. Enquanto isso 470 mil votos, 5.259
 * ligações e 17 comunidades ficavam atrás de outras abas.
 *
 * DECISÃO: Agora ela abre com o tamanho da base e com o desenho.
 *
 * Não **As notícias saíram de vez (2026-10-02)**, por decisão do autor: o coletor, a aba
 * da ficha e esta seção. Quem a pessoa segue continua aqui, em lista.
 *
 * Guardado com a legislatura que pediu: o de outro período não aparece sob o seletor novo.
 *
 * O período vem da faixa do topo. "Todas" é da lista de parlamentares; aqui vale a corrente.
 *
 * Sem conta não há seguidos, e a lista responderia 401.
 *
 * ATENÇÃO: A legislatura do questionário é sempre a corrente, não a escolhida
 * abaixo: as perguntas não mudam com o período que se olha.
 *
 * RISCO: LGPD art. 5º, II — esta lista indica convicção política, e o caminho
 * para apagá-la anda junto dela.
 *
 * DECISÃO: O trilho da direita, como no X. ATENÇÃO: A ordem não é editorial: são os
 * parlamentares com mais votações registradas, ou seja, os de mais dado
 * disponível — e a própria tela diz isso, para não ler como destaque nosso
 * (RNF-16).
 */
export function Inicio() {
  const { usuario } = useSessao();
  const [lido, setLido] = useState<{ de?: number; panorama: Panorama | null } | null>(null);
  const [seguidos, setSeguidos] = useState<Parlamentar[]>([]);
  const [escolha] = useLegislaturaDaUrl();
  const legislaturas = useLegislaturas();
  const legislatura = typeof escolha === 'number' ? escolha : undefined;
  const corrente = legislaturas?.find((l) => l.corrente)?.numero;
  const panorama = lido && lido.de === legislatura ? lido.panorama : null;

  useEffect(() => {
    let atual = true;
    obterPanorama(legislatura)
      .then((p) => atual && setLido({ de: legislatura, panorama: p }))
      .catch(() => atual && setLido({ de: legislatura, panorama: null }));
    return () => {
      atual = false;
    };
  }, [legislatura]);

  useEffect(() => {
    if (!usuario) return;

    listarSeguidos().then(setSeguidos).catch(() => setSeguidos([]));
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
                {corrente ? ` da ${corrente}ª legislatura` : ''}.
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

        <BarraDePeriodo />

        {panorama ? (
          <Base panorama={panorama} />
        ) : (
          <EsqueletoDePainel rotulo="Carregando o tamanho da base" cartoes={2} alturaDoGrafico={0} />
        )}

        <GrafoDaAbertura legislatura={legislatura} />

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

            <p className="nota-privacidade">
              🔒 Esta lista indica sua posição política e é tratada como dado sensível. Ela
              não é compartilhada com ninguém. <Link to="/conta">Como apagar tudo</Link>
            </p>
          </section>
        )}

      </div>

      <aside className="painel-trilho">
        <SugestoesParaSeguir />
      </aside>
    </div>
  );
}

/**
 * O grafo da Câmara na página inicial — buscado só quando a seção chega perto da tela.
 *
 * ATENÇÃO: É a maior resposta do site (~580 KB e ~0,6 s medidos em 2026-10-01), e vinha para
 * todo visitante, inclusive quem clicava em "Compare seu voto" sem rolar. A seção
 * reserva a altura do desenho enquanto espera, para a página não pular quando ele chega.
 *
 * DECISÃO: Sem `IntersectionObserver` (testes, navegador antigo), busca de imediato.
 *
 * ATENÇÃO: Com um período escolhido, sumir calado pareceria defeito.
 */
function GrafoDaAbertura({ legislatura }: { legislatura?: number }) {
  const marco = useRef<HTMLElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [lido, setLido] = useState<{ de?: number; grafo: DadosDoGrafo | 'vazio' } | null>(null);
  const grafo = lido && lido.de === legislatura ? lido.grafo : null;

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

    let atual = true;
    obterGrafo('CAMARA', legislatura)
      .then((g) => atual && setLido({ de: legislatura, grafo: g.nos.length > 0 ? g : 'vazio' }))
      .catch(() => atual && setLido({ de: legislatura, grafo: 'vazio' }));
    return () => {
      atual = false;
    };
  }, [visivel, legislatura]);

  if (grafo === 'vazio') {
    return legislatura ? (
      <section className="painel-secao">
        <h2>Como a Câmara se agrupa</h2>
        <p className="vazio">
          Não há grafo da Câmara em {periodoDaLegislatura(legislatura)}: as votações
          abertas eram poucas para comparar quem vota com quem.
        </p>
      </section>
    ) : null;
  }

  return (
    <section className="painel-secao" ref={marco}>
      <h2>
        Como a Câmara se agrupa
        {grafo && <small>{periodoDaLegislatura(grafo.legislatura)}</small>}
      </h2>
      {grafo ? (
        <TelaDoGrafo grafo={grafo} altura={460} embutido />
      ) : (
        <div className="grafo-reserva" style={{ height: 460 }} aria-hidden="true" />
      )}

      <LegendaDoGrafo />

      <Link
        to={`/parlamentares?vista=grafo${legislatura ? `&legislatura=${legislatura}` : ''}`}
        className="painel-mais"
      >
        Abrir o grafo completo
      </Link>
    </section>
  );
}

/**
 * O tamanho da base, por casa — o que sustenta tudo o que a tela afirma.
 *
 * DECISÃO: Estado honesto do primeiro dia: não inventa número nenhum.
 *
 * ATENÇÃO: "55ª legislatura" aqui, e "2015–2019 · 55ª" no seletor logo acima, diziam a
 * mesma coisa duas vezes. O título diz o período; o número fica no seletor.
 */
function Base({ panorama }: { panorama: Panorama }) {
  if (panorama.porCasa.length === 0) {
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
        A base{' '}
        {panorama.legislatura && <small>{periodoDaLegislatura(panorama.legislatura)}</small>}
      </h2>

      <div className="painel-casas">
        {panorama.porCasa.map((casa) => (
          <CartaoDaCasa key={casa.casa} casa={casa} />
        ))}
      </div>
    </section>
  );
}

/**
 * ATENÇÃO: PL68 — o painel contava toda votação registrada, e a 51ª da Câmara afirmava
 * 1.548 com 7 de voto nominal. O número acima é o que o cálculo usa; o resto é
 * dito aqui, não somado calado.
 *
 * RISCO: O sigilo muda o que a figura daquela casa pode afirmar, e omiti-lo faria as
 * duas parecerem comparáveis. É achado do trabalho, não rodapé.
 */
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

      {casa.votacoesSemVotoNominal > 0 && (
        <p className="cartao-ressalva">
          Outras {casa.votacoesSemVotoNominal.toLocaleString('pt-BR')} votações ficaram fora da
          conta: a casa as registrou sem a lista de quem votou como.
        </p>
      )}

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
