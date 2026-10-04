import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calcularAfinidade,
  obterDesempate,
  obterPerguntas,
  RespostasInsuficientesError,
  type Pergunta,
  type Resposta,
  type ResultadoAfinidade,
} from '../api';
import { PainelComponent } from '../componentes/Painel';
import { ResultadoComponent } from '../componentes/Resultado';
import { BotaoDoTourComponent } from '../componentes/BotaoDoTour';
import { passosDoQuestionario } from '../tour';
import { comTransicao } from '../transicao';
import { EsqueletoDeTextoComponent } from '../componentes/Esqueleto';
import { TEXTOS_DO_QUESTIONARIO as T } from '../textos/questionario';

const OPCOES: [Resposta, string][] = [
  [1, T.opcoes.concordo],
  [-1, T.opcoes.discordo],
  [0, T.opcoes.naoSei],
];

/**
 * Milissegundos entre responder e a próxima pergunta entrar.
 *
 * ATENÇÃO: Subiu de 620 para 760 e a troca ficou parecendo MAIS rápida, não mais lenta. O que
 * incomodava não era a duração: era a pausa estar VAZIA. Agora ela comporta o painel
 * enchendo (420ms) e a legenda entrando (200ms depois), e o tempo passa sendo usado.
 *
 * DECISÃO: Velocidade percebida é tempo morto, não tempo total.
 */
const PAUSA = 760;

const PASSOS_DO_QUESTIONARIO = passosDoQuestionario();

/**
 * O questionário, uma pergunta por tela.
 *
 * ATENÇÃO: O formato de lista longa fazia a pessoa varrer tudo de uma vez e responder no
 * automático. Um cartão por vez dá peso a cada afirmação — e o retorno imediato entre
 * elas mantém o ritmo até o fim, que é o que decide se o questionário é concluído.
 *
 * RISCO: O retorno mostra o COMPARECIMENTO da votação, nunca o placar. Ver
 * `PerguntaPublica` na API: revelar a divisão induziria conformidade nas perguntas
 * seguintes, e o instrumento passaria a medir adesão à maioria.
 *
 * As perguntas de desempate, buscadas UMA vez, quando falta uma para acabar o bloco
 * de abertura.
 *
 * ATENÇÃO: Buscar na última e não depois dela é o que esconde a rodada: enquanto a pessoa
 * lê e responde a pergunta que está na tela, as próximas já chegaram. Buscar depois
 * mostraria "Carregando…" no meio do questionário.
 *
 * Não Falha não interrompe: `obterDesempate` devolve `[]`, o questionário termina
 * com as de abertura, e o mínimo do servidor decide se dá para calcular.
 *
 * ATENÇÃO: O denominador é o TOTAL declarado pelo servidor, não `perguntas.length`:
 * as de desempate entram no meio do caminho, e usar o tamanho da lista faria a
 * barra andar para trás quando elas chegassem.
 *
 * RISCO: `acabou` olha a lista CARREGADA, não o total previsto. Se o desempate falhar,
 * a lista para em 17 e o total continua 24 — comparar com o total deixaria a
 * pessoa numa tela sem pergunta e sem encerramento, sem nada a fazer.
 *
 * ATENÇÃO: Isto não é título repetido: é a única indicação de quanto falta, e
 * saiu junto com o cabeçalho da página por descuido.
 *
 * ATENÇÃO: A pausa é curta de propósito: longa o bastante para a pessoa ler o painel,
 * curta o bastante para não virar espera.
 *
 * DECISÃO: A View Transition faz a pergunta respondida SAIR pela esquerda enquanto a
 * próxima entra pela direita. Sem ela só dá para animar quem chega, e a troca
 * lê como pisca-pisca em vez de avanço.
 *
 * DECISÃO: 422 não é erro de sistema: é o cidadão não ter respondido o suficiente
 */
export function QuestionarioComponent() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [total, setTotal] = useState(0);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [revelando, setRevelando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAfinidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obterPerguntas()
      .then(({ perguntas: iniciais, total: tamanho }) => {
        setPerguntas(iniciais);
        setTotal(tamanho);
      })
      .catch(() => setErro(T.erroAoCarregar));
  }, []);

  const pediuDesempate = useRef(false);
  const [desempateRespondido, setDesempateRespondido] = useState(false);
  const precisaDeDesempate =
    perguntas.length > 0 && perguntas.length < total && indice >= perguntas.length - 1;
  const aguardandoDesempate = precisaDeDesempate && !desempateRespondido;

  useEffect(() => {
    if (pediuDesempate.current || !precisaDeDesempate) return;
    pediuDesempate.current = true;

    const respondidas = Object.entries(respostas).map(([perguntaId, valor]) => ({
      perguntaId,
      valor,
    }));

    obterDesempate(respondidas)
      .then((extras) => {
        if (extras.length > 0) setPerguntas((atuais) => [...atuais, ...extras]);
      })
      .catch(() => undefined)
      .finally(() => setDesempateRespondido(true));
  }, [precisaDeDesempate, respostas]);

  const opinadas = useMemo(
    () => Object.values(respostas).filter((v) => v !== 0).length,
    [respostas],
  );

  if (resultado) {
    return (
      <ResultadoComponent
        resultado={resultado}
        aoRefazer={recomecar}
        perguntas={perguntas}
        aoEscolherUf={(uf) => calcularAfinidade(payloadDasRespostas(), uf).then(setResultado)}
      />
    );
  }

  if (perguntas.length === 0) {
    return (
      <>
        {erro ? <p className="erro">{erro}</p> : <EsqueletoDeTextoComponent rotulo={T.carregando} paragrafos={1} />}
      </>
    );
  }

  const previstas = Math.max(total, perguntas.length);

  const acabou = indice >= perguntas.length;
  const atual = perguntas[indice];
  const progresso = Math.round((indice / previstas) * 100);

  return (
    <div className="questionario">
      <div className="progresso" data-tour="progresso">
        <div className="barra-progresso">
          <div style={{ width: `${acabou ? 100 : progresso}%` }} />
        </div>

        <p className="progresso-contagem">
          {acabou ? T.respondidas(opinadas, perguntas.length) : T.pergunta(indice + 1, previstas)}
        </p>

        <BotaoDoTourComponent nome="questionario" passos={PASSOS_DO_QUESTIONARIO} />
      </div>

      {acabou && aguardandoDesempate ? (
        <p className="carregando">{T.escolhendo}</p>
      ) : acabou ? (
        <EncerramentoComponent
          opinadas={opinadas}
          total={perguntas.length}
          enviando={enviando}
          erro={erro}
          aoEnviar={enviar}
          aoRever={() => comTransicao(() => setIndice(0))}
        />
      ) : (
        <CartaoDePerguntaComponent
          key={atual.id}
          pergunta={atual}
          escolhida={respostas[atual.id]}
          revelando={revelando}
          aoResponder={responder}
          aoVoltar={indice > 0 ? () => comTransicao(() => setIndice(indice - 1)) : undefined}
        />
      )}
    </div>
  );

  function responder(perguntaId: string, valor: Resposta) {
    setRespostas((atuais) => ({ ...atuais, [perguntaId]: valor }));
    setRevelando(true);

    setTimeout(() => {
      comTransicao(() => {
        setRevelando(false);
        setIndice((i) => i + 1);
      });
    }, PAUSA);
  }

  function payloadDasRespostas() {
    return Object.entries(respostas).map(([perguntaId, valor]) => ({ perguntaId, valor }));
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);

    try {
      setResultado(await calcularAfinidade(payloadDasRespostas()));
    } catch (falha) {
      setErro(
        falha instanceof RespostasInsuficientesError
          ? T.respostasInsuficientes(falha.minimo)
          : T.erroAoCalcular,
      );
    } finally {
      setEnviando(false);
    }
  }

  function recomecar() {
    setResultado(null);
    setRespostas({});
    setIndice(0);
    setErro(null);
  }
}

/**
 * DECISÃO: O retorno é o painel: comparecimento, NUNCA a direção do voto.
 *
 * ATENÇÃO: Sem placar registrado, calar. "0 deputados se posicionaram" seria falso:
 * o que falta é o dado, não o comparecimento.
 */
function CartaoDePerguntaComponent({
  pergunta,
  escolhida,
  revelando,
  aoResponder,
  aoVoltar,
}: {
  pergunta: Pergunta;
  escolhida?: Resposta;
  revelando: boolean;
  aoResponder: (id: string, valor: Resposta) => void;
  aoVoltar?: () => void;
}) {
  return (
    <div className="cartao-pergunta" data-tour="pergunta">
      <p className="rotulo-pergunta">{T.voceConcorda}</p>
      <h2 className="texto-pergunta">{pergunta.texto}</h2>

      <div className="opcoes-grandes" data-tour="opcoes">
        {OPCOES.map(([valor, rotulo]) => (
          <button
            key={rotulo}
            type="button"
            className={`opcao-grande ${escolhida === valor ? 'opcao-ativa' : ''}`}
            disabled={revelando}
            onClick={() => aoResponder(pergunta.id, valor)}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className={`retorno ${revelando ? 'visivel' : ''}`} aria-live="polite">
        {revelando && pergunta.totalVotos > 0 && (
          <PainelComponent posicionados={pergunta.totalVotos} total={pergunta.totalPossivel} />
        )}
        {revelando && pergunta.totalVotos === 0 && <p>{T.respostaRegistrada}</p>}
      </div>

      {aoVoltar && !revelando && (
        <button type="button" className="botao-texto voltar-pergunta" onClick={aoVoltar}>
          {T.voltar}
        </button>
      )}
    </div>
  );
}

function EncerramentoComponent({
  opinadas,
  total,
  enviando,
  erro,
  aoEnviar,
  aoRever,
}: {
  opinadas: number;
  total: number;
  enviando: boolean;
  erro: string | null;
  aoEnviar: () => void;
  aoRever: () => void;
}) {
  return (
    <div className="encerramento">
      <h2>{T.pronto}</h2>
      <p className="ajuda">{T.opinou(opinadas, total)}</p>

      {erro && <p className="erro">{erro}</p>}

      <div className="encerramento-acoes">
        <button type="button" className="botao-destaque" disabled={enviando} onClick={aoEnviar}>
          {enviando ? T.calculando : T.verResultado}
        </button>
        <button type="button" className="botao-secundario" onClick={aoRever}>
          {T.rever}
        </button>
      </div>
    </div>
  );
}
