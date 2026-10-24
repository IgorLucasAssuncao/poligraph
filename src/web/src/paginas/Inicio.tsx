import { useEffect, useRef, useState } from 'react';
import { useCarga } from '../componentes/useCarga';
import { Link, useNavigate } from 'react-router-dom';
import {
  NOME_DA_CASA,
  obterGestoesDaCidade,
  obterGrafo,
  obterPanorama,
  type Grafo as DadosDoGrafo,
  type Municipio,
  type Panorama,
} from '../api';
import { LegendaDoGrafoComponent } from '../componentes/LegendaDoGrafo';
import { LinhaParlamentarComponent } from '../componentes/LinhaParlamentar';
import { SugestoesParaSeguirComponent } from '../componentes/SugestoesParaSeguir';
import { NovidadesDosSeguidosComponent } from '../componentes/NovidadesDosSeguidos';
import { TelaDoGrafoComponent } from '../componentes/TelaDoGrafo';
import { marcarSeguido, useSeguidos } from '../componentes/useSeguidos';
import { EsqueletoDeTextoComponent } from '../componentes/Esqueleto';
import { useLegislaturas } from '../componentes/useLegislatura';
import { dataCurta, nomeDePessoa, nomeProprio, periodoDaLegislatura, reaisCompacto } from '../formato';
import { destinoDoPolitico } from '../navegacao';
import { PainelComponent } from '../componentes/Painel';
import { TEXTOS_DO_INICIO as T } from '../textos/inicio';
import { guardarMinhaCidade, lerMinhaCidade } from '../minhaCidade';
import { BuscaDoCabecalhoComponent } from '../componentes/BuscaDoCabecalho';
import { SuaCidadeComponent } from '../componentes/SuaCidade';

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
 * DECISÃO (autor, 2026-10-23): duas entradas de mesmo peso, uma para cada metade do trabalho: o questionário, para o voto,
 * e a cidade, para o dinheiro e para quem governa. A busca do topo se repete abaixo delas. O detalhe da base por casa foi
 * para a Metodologia, e o seletor de legislatura ficou em Políticos: a página inicial mostra a legislatura corrente.
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
export function InicioComponent() {
  const navegar = useNavigate();
  const seguidos = useSeguidos().lista ?? [];
  const legislaturas = useLegislaturas();
  const corrente = legislaturas?.find((l) => l.corrente)?.numero;
  const lido = useCarga(['panorama', null], () => obterPanorama());
  const panorama = lido.dados ?? null;
  const guardada = lerMinhaCidade();

  return (
    <div className="painel-com-trilho">
      <div className="painel">
        <section className="painel-abertura inicio-abertura">
          <h1>{T.titulo}</h1>
          <p>{T.subtitulo}</p>

          <div className="entradas-do-inicio">
            <article className="entrada-do-inicio" data-tour="comecar">
              <h2>{T.entradas.voto.titulo}</h2>
              <p>
                {T.abertura(
                  panorama && panorama.perguntasNoQuestionario > 0 ? panorama.perguntasNoQuestionario : null,
                  panorama?.perguntasAtivas ?? 0,
                  corrente,
                )}
              </p>
              <div className="painel-acoes">
                <Link to="/resultado" className="botao-destaque">
                  {T.entradas.voto.comecar}
                </Link>
                <Link to="/parlamentares" className="botao-secundario">
                  {T.verParlamentares}
                </Link>
              </div>
            </article>

            <article className="entrada-do-inicio">
              <h2>{T.entradas.cidade.titulo}</h2>
              <p>{T.entradas.cidade.texto}</p>
              {guardada && <CidadeGuardadaComponent cidade={guardada} />}
              <SuaCidadeComponent
                aoEscolher={(m) => {
                  guardarMinhaCidade(m);
                  void navegar(`/cidades/${m.codigoIbge}`);
                }}
              />
            </article>
          </div>

          <div className="busca-no-inicio">
            <h2 className="busca-no-inicio-titulo">{T.entradas.busca}</h2>
            <BuscaDoCabecalhoComponent />
          </div>
        </section>

        {panorama && <UltimasVotacoesComponent panorama={panorama} />}

        {panorama ? (
          <NumerosDaBaseComponent panorama={panorama} />
        ) : (
          <EsqueletoDeTextoComponent rotulo={T.carregandoABase} />
        )}

        <GrafoDaAberturaComponent />

        {seguidos.length > 0 && (
          <section className="painel-secao">
            <h2>{T.quemVoceSegue}</h2>
            {seguidos.slice(0, 5).map((p) => (
              <LinhaParlamentarComponent
                key={p.idPessoa}
                idPessoa={p.idPessoa}
                nome={p.nome}
                partido={p.partido}
                uf={p.uf}
                fotoUrl={p.urlFoto}
                seguindo
                aoAlternarSeguir={marcarSeguido}
              />
            ))}

            <p className="nota-privacidade">{T.privacidade}</p>
          </section>
        )}
      </div>

      <aside className="painel-trilho">
        {seguidos.length > 0 && <NovidadesDosSeguidosComponent />}
        <SugestoesParaSeguirComponent />
      </aside>
    </div>
  );
}

/**
 * A cidade guardada neste navegador, em uma linha: quem foi eleito prefeito para a gestão de agora e quanto de emenda chegou
 * neste ano. O link abre a página da cidade.
 *
 * A chave é a da página da cidade (`gestoes`): quem clica chega com o dado já lido.
 *
 * ATENÇÃO: "Prefeito eleito", como na página da cidade: o TSE registra quem foi eleito, não quem assumiu depois.
 */
function CidadeGuardadaComponent({ cidade }: { cidade: Municipio }) {
  const lida = useCarga(['gestoes', cidade.codigoIbge], () => obterGestoesDaCidade(cidade.codigoIbge));
  const ano = new Date().getFullYear();
  const gestoes = lida.dados?.gestoes ?? [];
  const atual = gestoes.find((g) => g.primeiroAno <= ano && ano <= g.ultimoAno) ?? gestoes[0];
  const doAno = lida.dados?.porAno.find((a) => a.ano === ano);

  return (
    <div className="cidade-guardada">
      <Link to={`/cidades/${cidade.codigoIbge}`} className="cidade-guardada-nome">
        {T.entradas.cidade.abrirGuardada(nomeProprio(cidade.nome), cidade.uf)} →
      </Link>
      {atual && atual.prefeitos.length > 0 && (
        <p>
          {T.suaCidade.prefeito(atual.prefeitos.length > 1)}{' '}
          {atual.prefeitos.map((p, i) => (
            <span key={p.idPessoa}>
              {i > 0 && ', '}
              <Link to={destinoDoPolitico(p)}>{nomeDePessoa(p.nome)}</Link> ({p.partido})
            </span>
          ))}
          , {T.suaCidade.gestao(atual.primeiroAno, atual.ultimoAno)}
        </p>
      )}
      {lida.dados && (
        <p>{doAno && doAno.recebido > 0 ? T.suaCidade.chegou(reaisCompacto(doAno.recebido), ano) : T.suaCidade.semPagamento(ano)}</p>
      )}
    </div>
  );
}

/**
 * A última votação aberta de cada casa, no painel: um traço por cadeira, cheio para quem se posicionou.
 *
 * DECISÃO (autor, 2026-10-23): o painel é a assinatura do site (skill `design-visual`, seção 2) e saiu do início junto com
 * a base por casa. Voltou sozinho, sem os números da base.
 *
 * ATENÇÃO: nunca mostra direção. Cheio é comparecimento, não "Sim".
 */
function UltimasVotacoesComponent({ panorama }: { panorama: Panorama }) {
  const comUltima = panorama.porCasa.filter((c) => c.ultima);
  if (comUltima.length === 0) return null;

  return (
    <section className="painel-secao" aria-labelledby="ultimas-titulo">
      <h2 id="ultimas-titulo">{T.ultimas.titulo}</h2>
      <p className="ajuda">{T.ultimas.ajuda}</p>
      <div className="ultimas-votacoes">
        {comUltima.map((c) => (
          <figure key={c.casa} className="cartao-ultima">
            <figcaption>{T.ultimas.legenda(NOME_DA_CASA[c.casa].nome, dataCurta(c.ultima!.data), c.ultima!.materia)}</figcaption>
            <PainelComponent posicionados={c.ultima!.posicionados} total={c.ultima!.cadeiras} />
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * A base numa linha: os votos da legislatura corrente nas duas casas, a cota e as emendas pagas nos anos dela.
 *
 * DECISÃO (autor, 2026-10-23): o detalhe por casa (votações nominais e simbólicas, secretas, grupos de voto) foi para a
 * Metodologia. Ele fala para quem confere o método; quem chega quer saber o tamanho, e de onde vem.
 */
function NumerosDaBaseComponent({ panorama }: { panorama: Panorama }) {
  if (panorama.porCasa.length === 0 || panorama.legislatura == null) {
    return <p className="vazio">{T.base.vazio}</p>;
  }

  const votos = panorama.porCasa.reduce((soma, c) => soma + c.votosComPosicao, 0);
  return (
    <p className="numeros-da-base">
      {T.numeros(
        periodoDaLegislatura(panorama.legislatura),
        votos.toLocaleString('pt-BR'),
        panorama.dinheiro ? reaisCompacto(panorama.dinheiro.cota) : null,
        panorama.dinheiro ? reaisCompacto(panorama.dinheiro.emendasPagas) : null,
      )}{' '}
      <Link to="/metodologia">{T.comoMedimos}</Link>
    </p>
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
function GrafoDaAberturaComponent({ legislatura }: { legislatura?: number } = {}) {
  const marco = useRef<HTMLElement>(null);
  const [visivel, setVisivel] = useState(false);
  const lido = useCarga(['grafo', 'CAMARA', legislatura ?? null], () => obterGrafo('CAMARA', legislatura), {
    ativo: visivel,
  });
  const grafo: DadosDoGrafo | 'vazio' | null = lido.atualizando
    ? null
    : lido.erro || (lido.dados && lido.dados.nos.length === 0)
      ? 'vazio'
      : (lido.dados ?? null);

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

  if (grafo === 'vazio') {
    return legislatura ? (
      <section className="painel-secao">
        <h2>{T.grafo.titulo}</h2>
        <p className="vazio">{T.grafo.semGrafo(periodoDaLegislatura(legislatura))}</p>
      </section>
    ) : null;
  }

  return (
    <section className="painel-secao" ref={marco}>
      <h2>
        {T.grafo.titulo}
        {grafo && <small>{periodoDaLegislatura(grafo.legislatura)}</small>}
      </h2>
      {grafo ? (
        <TelaDoGrafoComponent grafo={grafo} altura={340} embutido />
      ) : (
        <div className="grafo-reserva" style={{ height: 340 }} aria-hidden="true" />
      )}

      <LegendaDoGrafoComponent />

      <Link
        to={`/parlamentares?vista=grafo${legislatura ? `&legislatura=${legislatura}` : ''}`}
        className="painel-mais"
      >
        {T.grafo.abrir}
      </Link>
    </section>
  );
}
