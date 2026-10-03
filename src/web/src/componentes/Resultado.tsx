import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NOME_DA_CASA,
  obterGrafo,
  type Grafo,
  type ParlamentarAfim,
  type Pergunta,
  type ResultadoAfinidade,
  type ResultadoPorCasa,
} from '../api';
import { AvaliacaoComponent } from './Avaliacao';
import { AvatarComponent } from './Avatar';
import { BotaoDoTourComponent } from './BotaoDoTour';
import { CabecalhoDaColunaComponent } from './Layout';
import { GrafoAmpliadoComponent } from './GrafoAmpliado';
import { LinhaParlamentarComponent } from './LinhaParlamentar';
import { TelaDoGrafoComponent } from './TelaDoGrafo';
import { useSessao } from '../sessao';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { FONTES } from '../fontes';
import { passosDoResultado } from '../tour';
import { SIGLAS_DAS_UFS } from '../ufs';

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
  const textos = new Map(perguntas.map((p) => [p.id, p.texto]));
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
    aoEscolherUf(nova || undefined)
      .catch(() => setFalhou(true))
      .finally(() => setRecalculando(false));
  }

  return (
    <>
      <CabecalhoDaColunaComponent
        titulo="Quem vota como você"
        subtitulo={`${resultado.totalPerguntasRespondidas} perguntas respondidas`}
      />

      <div className="linha-do-tour">
        <BotaoDoTourComponent nome="resultado" passos={PASSOS_DO_RESULTADO} />
      </div>

      <p className="ajuda ajuda-espacada">
        A comparação usa apenas as votações em que o parlamentar esteve presente e se
        posicionou. Deputados e senadores votam matérias diferentes, então cada grupo é
        comparado separadamente.
      </p>

      {aoEscolherUf && (
        <div className="filtro-do-resultado">
          <label>
            <span>Comparar com</span>
            <select value={uf} onChange={(e) => escolher(e.target.value)} disabled={recalculando}>
              <option value="">parlamentares de todo o país</option>
              {SIGLAS_DAS_UFS.map((sigla) => (
                <option key={sigla} value={sigla}>
                  só os de {sigla}
                </option>
              ))}
            </select>
          </label>
          <p className="ajuda" aria-live="polite">
            {recalculando
              ? 'Recalculando…'
              : falhou
                ? 'Não foi possível recalcular agora. Tente de novo.'
                : uf
                  ? `A lista e a régua contam só quem votou por ${uf}. O ponto no grafo continua o da casa inteira.`
                  : 'Escolha um estado para ver só quem votou por ele.'}
          </p>
        </div>
      )}

      {resultado.porCasa.map((casa) => (
        <SecaoDaCasaComponent key={casa.casa} casa={casa} textos={textos} />
      ))}

      {uf &&
        casasSemNinguem.map((c) => (
          <p key={c} className="vazio">
            Nenhum {NOME_DA_CASA[c].singular} de {uf} votou nas perguntas que você respondeu.
          </p>
        ))}

      <p className="aviso" role="note" data-tour="resultado-aviso">
        Esta é uma ferramenta acadêmica de comparação de votos.{' '}
        <strong>Não é recomendação de voto</strong>, e não representa o programa completo de
        nenhum parlamentar.
      </p>

      {usuario && <AvaliacaoComponent resultado={resultado} />}

      <div className="resultado-acoes">
        <button type="button" className="botao-secundario" onClick={aoRefazer}>
          Refazer o questionário
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
  const grafo = useGrafo(casa.posicaoNoGrafo !== null, casa.casa);
  const [ampliado, setAmpliado] = useState(false);

  const nome = NOME_DA_CASA[casa.casa];

  if (casa.maisProximos.length === 0) return null;

  return (
    <section className="casa-resultado">
      <h2 className="titulo-casa">
        Os {nome.plural} mais próximos de você
        <small>
          {casa.perguntasRespondidas}{' '}
          {casa.perguntasRespondidas === 1 ? 'pergunta' : 'perguntas'} desta casa
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
        Entre os <strong>{casa.escala.comparados}</strong> {nome.plural} comparados com você, o
        do meio da lista votou como você em{' '}
        <strong>
          {casa.escala.medianoAcordos} de {casa.escala.medianoComparaveis}
        </strong>
        .
      </p>

      <p className="fonte-dado">
        Fonte: registro nominal de votação {NOME_DA_CASA[casa.casa].doNome}. Cada pergunta
        corresponde a uma votação em plenário.{' '}
        <LinkDeFonteComponent href={casa.casa === 'SENADO' ? FONTES.senado.url : FONTES.camara.url}>
          Dados abertos da casa
        </LinkDeFonteComponent>
        {' · '}
        <Link to="/metodologia">Como calculamos</Link>
      </p>

      {grafo && casa.posicaoNoGrafo && (
        <div className="resultado-grafo" data-tour="resultado-grafo">
          <h3 className="titulo-secao">Onde você caiu</h3>

          <TelaDoGrafoComponent
            grafo={grafo}
            cidadao={casa.posicaoNoGrafo}
            altura={320}
            embutido
            aoAmpliar={() => setAmpliado(true)}
          />

          <p className="ajuda ajuda-espacada">
            O losango é você, posicionado entre os{' '}
            <strong>{casa.posicaoNoGrafo.vizinhosUsados}</strong> {nome.plural}{' '}
            com quem você mais concordou.{' '}
            <strong>
              Sua posição vale sobre {casa.posicaoNoGrafo.baseDeVotacoes} perguntas
            </strong>
            ; a de cada {nome.singular}, sobre a legislatura inteira.
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
          <h3 className="titulo-secao">Também próximos de você</h3>
          {demais.map((p) => (
            <LinhaAfimComponent key={p.pessoaId} parlamentar={p} respondidasNaCasa={casa.perguntasRespondidas} />
          ))}
        </>
      )}

      {casa.maisDistantes.length > 0 && (
        <>
          <h3 className="titulo-secao" data-tour="resultado-distantes">Mais distantes</h3>
          {casa.maisDistantes.map((p) => (
            <LinhaAfimComponent key={p.pessoaId} parlamentar={p} respondidasNaCasa={casa.perguntasRespondidas} />
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
 */
function useGrafo(precisa: boolean, casa: ResultadoPorCasa['casa']): Grafo | null {
  const [lido, setLido] = useState<{ casa: ResultadoPorCasa['casa']; grafo: Grafo | null } | null>(null);

  useEffect(() => {
    if (!precisa) return;

    let vivo = true;
    obterGrafo(casa)
      .then((recebido) => {
        if (vivo) setLido({ casa, grafo: recebido });
      })
      .catch(() => {
        if (vivo) setLido({ casa, grafo: null });
      });

    return () => {
      vivo = false;
    };
  }, [precisa, casa]);

  return precisa && lido?.casa === casa ? lido.grafo : null;
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
      <summary>Ver em quais perguntas</summary>

      <ul className="lista-detalhe">
        {parlamentar.acordou.map((id) => (
          <li key={id} className="acordo">
            <span aria-hidden="true">✓</span>
            <span>
              <span className="sr-apenas">Concordaram: </span>
              {textos.get(id) ?? id}
            </span>
          </li>
        ))}

        {parlamentar.discordou.map((id) => (
          <li key={id} className="desacordo">
            <span aria-hidden="true">✗</span>
            <span>
              <span className="sr-apenas">Discordaram: </span>
              {textos.get(id) ?? id}
            </span>
          </li>
        ))}
      </ul>

      {foraDaConta > 0 && (
        <p className="ajuda nota-fora-da-conta">
          Outras <strong>{foraDaConta}</strong>{' '}
          {foraDaConta === 1 ? 'pergunta ficou' : 'perguntas ficaram'} de fora da conta:
          {foraDaConta === 1 ? ' ela' : ' elas'} tratam de votações em que{' '}
          {parlamentar.nome.split(' ')[0]} não votou, ou em que você respondeu “Não sei”.
        </p>
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
      <p className="rotulo-destaque">Quem mais votou como você</p>

      <Link to={`/parlamentar/${parlamentar.pessoaId}`} className="destaque-link">
        <AvatarComponent nome={parlamentar.nome} tamanho="grande" />

        <h2>{parlamentar.nome}</h2>
        <p className="perfil-filiacao">
          {parlamentar.partido}
          {parlamentar.uf && ` · ${parlamentar.uf}`}
        </p>
      </Link>

      <p className="destaque-placar">
        <span className="placar-numero">
          {parlamentar.acordos} de {parlamentar.comparaveis}
        </span>{' '}
        <span className="placar-texto">perguntas comparáveis em que vocês votaram igual</span>
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
      id={parlamentar.pessoaId}
      nome={parlamentar.nome}
      partido={parlamentar.partido}
      uf={parlamentar.uf}
      detalhe={
        <>
          concordaram em <strong>{parlamentar.acordos}</strong> de{' '}
          <strong>{parlamentar.comparaveis}</strong> perguntas
          {parlamentar.comparaveis < respondidasNaCasa && (
            <span className="base-da-conta">
              {' '}
              (das {respondidasNaCasa} que você respondeu nesta casa)
            </span>
          )}
        </>
      }
    />
  );
}
