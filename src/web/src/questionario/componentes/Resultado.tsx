import { useState } from 'react';
import { nomeDePessoa, periodoDaLegislatura } from '../../nucleo/formato';
import { Link } from 'react-router-dom';
import { useCarga } from '../../comum/componentes/useCarga';
import {
  NOME_DA_CASA,
  obterGrafo,
  type Grafo,
  type ParlamentarAfim,
  type Pergunta,
  type ResultadoAfinidade,
  type ResultadoPorCasa,
} from '../../nucleo/api';
import { AvaliacaoComponent } from './Avaliacao';
import { AvatarComponent } from '../../comum/componentes/Avatar';
import { TourDaTelaComponent } from '../../site/componentes/TourDaTela';
import { CabecalhoDaColunaComponent } from '../../site/componentes/Layout';
import { GrafoAmpliadoComponent } from '../../grafo/componentes/GrafoAmpliado';
import { LinhaParlamentarComponent } from '../../parlamentares/componentes/LinhaParlamentar';
import { TelaDoGrafoComponent } from '../../grafo/componentes/TelaDoGrafo';
import { useSessao } from '../../nucleo/sessao';
import { LinkDeFonteComponent } from '../../comum/componentes/LinkDeFonte';
import { FONTES } from '../../nucleo/fontes';
import { passosDoResultado } from '../../nucleo/tour';
import { SIGLAS_DAS_UFS } from '../../nucleo/ufs';
import { TEXTOS_DO_RESULTADO as T } from '../textos/resultado';

const PASSOS_DO_RESULTADO = passosDoResultado();

/**
 * A tela de resultado.
 *
 * RISCO: RF-29: SEMPRE "concordou em X de Y", NUNCA percentual solto.
 * "67%" esconde que a base foram 3 perguntas; "2 de 3" mostra a fragilidade do próprio
 * número — e isso é honestidade metodológica, não detalhe de interface.
 *
 * ATENÇÃO: O registro da avaliação exige conta no servidor — é o freio contra quem
 * enviaria mil avaliações. Sem conta, a avaliação não aparece.
 *
 * Refazer sempre disponível: a pessoa muda de ideia, e as perguntas mudam quando
 * a curadoria acrescenta votações novas.
 */
export function ResultadoComponent({
  resultado,
  aoRefazer,
  perguntas,
  aoEscolherUf,
}: {
  resultado: ResultadoAfinidade;
  aoRefazer: () => void;
  /** U15: recalcula as listas só com o estado escolhido; `undefined` volta ao país inteiro. */
  aoEscolherUf?: (uf: string | undefined) => Promise<void>;
  /**
   * As perguntas que acabaram de ser respondidas, para o detalhe "em quais".
   *
   * ATENÇÃO: Vêm de fora e não da resposta da API de propósito: a tela já as tem, e repetir
   * 24 enunciados por parlamentar, para dez parlamentares, inflaria a resposta sem
   * acrescentar nada.
   */
  perguntas: Pergunta[];
}) {
  const textos = new Map(perguntas.map((p) => [p.idPergunta, p.texto]));
  const { usuario } = useSessao();
  const [recalculando, setRecalculando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const uf = resultado.uf ?? '';
  const casasSemNinguem = (['CAMARA', 'SENADO'] as const).filter(
    (c) => !resultado.porCasa.some((casa) => casa.casa === c),
  );

  function escolher(nova: string) {
    if (!aoEscolherUf) return;
    setRecalculando(true);
    setFalhou(false);
    void aoEscolherUf(nova || undefined)
      .catch(() => setFalhou(true))
      .finally(() => setRecalculando(false));
  }

  return (
    <>
      <CabecalhoDaColunaComponent
        titulo={T.titulo}
        subtitulo={T.respondidas(resultado.totalPerguntasRespondidas)}
      />

      <TourDaTelaComponent nome="resultado" passos={PASSOS_DO_RESULTADO} />

      <p className="ajuda ajuda-espacada">{T.explicacao}</p>

      {aoEscolherUf && (
        <div className="filtro-do-resultado">
          <label>
            <span>{T.compararCom}</span>
            <select value={uf} onChange={(e) => escolher(e.target.value)} disabled={recalculando}>
              <option value="">{T.todoOPais}</option>
              {SIGLAS_DAS_UFS.map((sigla) => (
                <option key={sigla} value={sigla}>
                  {T.soOsDe(sigla)}
                </option>
              ))}
            </select>
          </label>
          <p className="ajuda" aria-live="polite">
            {recalculando ? T.recalculando : falhou ? T.falhou : uf ? T.soDoEstado(uf) : T.escolhaUmEstado}
          </p>
        </div>
      )}

      {resultado.porCasa.map((casa) => (
        <SecaoDaCasaComponent key={casa.casa} casa={casa} textos={textos} />
      ))}

      {uf &&
        casasSemNinguem.map((c) => (
          <p key={c} className="vazio">
            {T.ninguemDoEstado(NOME_DA_CASA[c].singular, uf)}
          </p>
        ))}

      <p className="aviso" role="note" data-tour="resultado-aviso">
        {T.aviso}
      </p>

      {usuario && <AvaliacaoComponent resultado={resultado} />}

      <div className="resultado-acoes">
        <button type="button" className="botao-secundario" onClick={aoRefazer}>
          {T.refazer}
        </button>
      </div>
    </>
  );
}

/**
 * Uma casa: destaque, grafo próprio e as duas listas.
 *
 * O cidadão nunca escolheu entre Câmara e Senado — a separação acontece só aqui, no
 * resultado, e é autoexplicativa: "Deputados mais próximos" e "Senadores mais próximos".
 *
 * O grafo é por casa porque as duas não são comparáveis entre si: nenhuma aresta liga
 * deputado a senador, e a posição do cidadão sai da execução da própria casa.
 *
 * DECISÃO: A régua: "8 de 11" só diz se é muito ao lado do parlamentar do meio da lista.
 * Contagem com base, não percentual (RF-29).
 *
 * Sem esta frase a tela afirma uma precisão que o dado não tem.
 */
function SecaoDaCasaComponent({
  casa,
  textos,
}: {
  casa: ResultadoPorCasa;
  textos: Map<string, string>;
}) {
  const [primeiro, ...demais] = casa.maisProximos;
  const { grafo, carregando: grafoCarregando } = useGrafo(casa.posicaoNoGrafo !== null, casa.casa);
  const [ampliado, setAmpliado] = useState(false);

  const nome = NOME_DA_CASA[casa.casa];

  if (casa.maisProximos.length === 0) return null;

  return (
    <section className="casa-resultado">
      <h2 className="titulo-casa">
        {T.casa.titulo(nome.plural)}
        <small>
          {T.casa.perguntasDaCasa(casa.perguntasRespondidas)}
          {casa.legislatura &&
            ` · ${T.casa.daLegislatura(casa.legislatura, periodoDaLegislatura(casa.legislatura))}`}
        </small>
      </h2>

      {primeiro && (
        <DestaqueComponent
          parlamentar={primeiro}
          textos={textos}
          respondidasNaCasa={casa.perguntasRespondidas}
        />
      )}

      <p className="escala-resultado">
        {T.casa.escala(casa.escala.comparados, nome.plural, casa.escala.medianoAcordos, casa.escala.medianoComparaveis)}
      </p>

      <p className="fonte-dado">
        {T.casa.fonte(NOME_DA_CASA[casa.casa].doNome)}{' '}
        <LinkDeFonteComponent href={casa.casa === 'SENADO' ? FONTES.senado.url : FONTES.camara.url}>
          {T.casa.dadosAbertos}
        </LinkDeFonteComponent>
        {' · '}
        <Link to="/metodologia">{T.casa.comoCalculamos}</Link>
      </p>

      {grafoCarregando && (
        <div className="resultado-grafo" aria-busy="true">
          <h3 className="titulo-secao">{T.casa.ondeVoceCaiu}</h3>
          <div className="grafo-reserva" style={{ height: 320 }} aria-hidden="true" />
        </div>
      )}

      {grafo && casa.posicaoNoGrafo && (
        <div className="resultado-grafo" data-tour="resultado-grafo">
          <h3 className="titulo-secao">{T.casa.ondeVoceCaiu}</h3>

          <TelaDoGrafoComponent
            grafo={grafo}
            cidadao={casa.posicaoNoGrafo}
            altura={320}
            embutido
            aoAmpliar={() => setAmpliado(true)}
          />

          <p className="ajuda ajuda-espacada">
            {T.casa.losango(casa.posicaoNoGrafo.vizinhosUsados, nome.plural, casa.posicaoNoGrafo.baseDeVotacoes, nome.singular)}
          </p>

          <GrafoAmpliadoComponent
            grafo={grafo}
            cidadao={casa.posicaoNoGrafo}
            aberto={ampliado}
            aoFechar={() => setAmpliado(false)}
          />
        </div>
      )}

      {demais.length > 0 && (
        <>
          <h3 className="titulo-secao">{T.casa.tambemProximos}</h3>
          {demais.map((p) => (
            <LinhaAfimComponent key={p.idPessoa} parlamentar={p} respondidasNaCasa={casa.perguntasRespondidas} />
          ))}
        </>
      )}

      {casa.maisDistantes.length > 0 && (
        <>
          <h3 className="titulo-secao" data-tour="resultado-distantes">{T.casa.maisDistantes}</h3>
          {casa.maisDistantes.map((p) => (
            <LinhaAfimComponent key={p.idPessoa} parlamentar={p} respondidasNaCasa={casa.perguntasRespondidas} />
          ))}
        </>
      )}
    </section>
  );
}

/**
 * Busca o grafo da casa, e só quando há posição para desenhar.
 *
 * Sem a condição, a tela baixaria o grafo inteiro para descartá-lo — e são centenas de
 * nós e milhares de arestas por casa.
 *
 * Falhar em buscar o grafo omite o desenho, nunca a tela: as listas são o resultado, e o grafo é ilustração.
 *
 * ATENÇÃO (2026-10-23): enquanto carrega, a seção já ocupa a altura do desenho. O grafo da Câmara é a maior resposta do site;
 * chegando depois, ele entrava acima das listas e empurrava a página uns 540 px com a pessoa lendo.
 */
function useGrafo(precisa: boolean, casa: ResultadoPorCasa['casa']): { grafo: Grafo | null; carregando: boolean } {
  const lido = useCarga(['grafo', casa, null], () => obterGrafo(casa), { ativo: precisa, manter: 2 });
  const grafo = precisa && !lido.atualizando ? (lido.dados ?? null) : null;
  return { grafo, carregando: precisa && !grafo && !lido.erro };
}

/**
 * RISCO: A conta por extenso: EM QUAIS perguntas houve acordo.
 *
 * "Concordaram em 14 de 17" não é conferível — não dá para saber se os 14 foram nas
 * perguntas que importam para quem responde ou nas de data comemorativa. Só a lista
 * transforma o número em conta.
 *
 * ATENÇÃO: Mostra também as que FICARAM DE FORA, com o motivo. O denominador é a parte que
 * mais engana: 17 não é o número de perguntas do questionário, é quantas os dois
 * responderam. Omitir isso faria "14 de 17" parecer um questionário de 17.
 */
function DetalheDaContaComponent({
  parlamentar,
  textos,
  respondidasNaCasa,
}: {
  parlamentar: ParlamentarAfim;
  textos: Map<string, string>;
  respondidasNaCasa: number;
}) {
  const foraDaConta = respondidasNaCasa - parlamentar.comparaveis;

  return (
    <details className="detalhe-conta">
      <summary>{T.detalhe.verEmQuais}</summary>

      <ul className="lista-detalhe">
        {parlamentar.acordou.map((idPergunta) => (
          <li key={idPergunta} className="acordo">
            <span aria-hidden="true">✓</span>
            <span>
              <span className="sr-apenas">{T.detalhe.concordaram}</span>
              {textos.get(idPergunta) ?? idPergunta}
            </span>
          </li>
        ))}

        {parlamentar.discordou.map((idPergunta) => (
          <li key={idPergunta} className="desacordo">
            <span aria-hidden="true">✗</span>
            <span>
              <span className="sr-apenas">{T.detalhe.discordaram}</span>
              {textos.get(idPergunta) ?? idPergunta}
            </span>
          </li>
        ))}
      </ul>

      {foraDaConta > 0 && (
        <p className="ajuda nota-fora-da-conta">{T.detalhe.foraDaConta(foraDaConta, parlamentar.nome.split(' ')[0])}</p>
      )}
    </details>
  );
}

/**
 * Nunca percentual: "13 de 13" mostra sobre quantas perguntas a conta foi feita.
 */
function DestaqueComponent({
  parlamentar,
  textos,
  respondidasNaCasa,
}: {
  parlamentar: ParlamentarAfim;
  textos: Map<string, string>;
  respondidasNaCasa: number;
}) {
  return (
    <section className="destaque-resultado" data-tour="resultado-destaque">
      <p className="rotulo-destaque">{T.destaque.rotulo}</p>

      <Link to={`/parlamentar/${parlamentar.idPessoa}`} className="destaque-link">
        <AvatarComponent nome={nomeDePessoa(parlamentar.nome)} fotoUrl={parlamentar.urlFoto} tamanho="grande" />

        <h2>{nomeDePessoa(parlamentar.nome)}</h2>
        <p className="perfil-filiacao">
          {parlamentar.partido}
          {parlamentar.uf && ` · ${parlamentar.uf}`}
          {parlamentar.emExercicio === false && <span className="fora-do-mandato">{T.casa.foraDoMandato}</span>}
        </p>
      </Link>

      <p className="destaque-placar">
        <span className="placar-numero">{T.destaque.placar(parlamentar.acordos, parlamentar.comparaveis)}</span>{' '}
        <span className="placar-texto">{T.destaque.placarTexto}</span>
      </p>

      <DetalheDaContaComponent
        parlamentar={parlamentar}
        textos={textos}
        respondidasNaCasa={respondidasNaCasa}
      />
    </section>
  );
}

/**
 * U19: "8 de 10" e "16 de 20" são a mesma proporção sobre bases diferentes. A linha diz de
 * quantas perguntas respondidas a base saiu, para a diferença não sumir na ordem da lista.
 */
function LinhaAfimComponent({ parlamentar, respondidasNaCasa }: { parlamentar: ParlamentarAfim; respondidasNaCasa: number }) {
  return (
    <LinhaParlamentarComponent
      idPessoa={parlamentar.idPessoa}
      nome={parlamentar.nome}
      partido={parlamentar.partido}
      uf={parlamentar.uf}
      fotoUrl={parlamentar.urlFoto}
      detalhe={
        parlamentar.emExercicio === false
          ? `${T.linha.concordaram(parlamentar.acordos, parlamentar.comparaveis, respondidasNaCasa)} · ${T.casa.foraDoMandato}`
          : T.linha.concordaram(parlamentar.acordos, parlamentar.comparaveis, respondidasNaCasa)
      }
    />
  );
}
