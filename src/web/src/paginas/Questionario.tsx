import { useEffect, useMemo, useState } from 'react';
import {
  calcularAfinidade,
  obterPerguntas,
  RespostasInsuficientesError,
  type Pergunta,
  type Resposta,
  type ResultadoAfinidade,
} from '../api';
import { CabecalhoDaColuna } from '../componentes/Layout';
import { Painel } from '../componentes/Painel';
import { Resultado } from '../componentes/Resultado';
import { comTransicao } from '../transicao';

const OPCOES: [Resposta, string][] = [
  [1, 'Concordo'],
  [-1, 'Discordo'],
  [0, 'Não sei'],
];

/** Milissegundos entre responder e a próxima pergunta entrar. */
const PAUSA = 620;

/**
 * O questionário, uma pergunta por tela.
 *
 * ⚠️ O formato de lista longa fazia a pessoa varrer tudo de uma vez e responder no
 * automático. Um cartão por vez dá peso a cada afirmação — e o retorno imediato entre
 * elas mantém o ritmo até o fim, que é o que decide se o questionário é concluído.
 *
 * 🔴 O retorno mostra o COMPARECIMENTO da votação, ⛔ nunca o placar. Ver
 * `PerguntaPublica` na API: revelar a divisão induziria conformidade nas perguntas
 * seguintes, e o instrumento passaria a medir adesão à maioria.
 */
export function Questionario() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [revelando, setRevelando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAfinidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obterPerguntas()
      .then(setPerguntas)
      .catch(() => setErro('Não foi possível carregar as perguntas.'));
  }, []);

  const opinadas = useMemo(
    () => Object.values(respostas).filter((v) => v !== 0).length,
    [respostas],
  );

  if (resultado) {
    return <Resultado resultado={resultado} aoRefazer={recomecar} />;
  }

  if (perguntas.length === 0) {
    return (
      <>
        <CabecalhoDaColuna titulo="Questionário" />
        <p className={erro ? 'erro' : 'carregando'}>{erro ?? 'Carregando…'}</p>
      </>
    );
  }

  const acabou = indice >= perguntas.length;
  const atual = perguntas[indice];
  const progresso = Math.round((indice / perguntas.length) * 100);

  return (
    <div className="questionario">
      <CabecalhoDaColuna
        titulo="Questionário"
        subtitulo={
          acabou
            ? `${opinadas} respondidas`
            : `Pergunta ${indice + 1} de ${perguntas.length}`
        }
      />

      <div className="progresso">
        <div className="barra-progresso">
          <div style={{ width: `${acabou ? 100 : progresso}%` }} />
        </div>
      </div>

      {acabou ? (
        <Encerramento
          opinadas={opinadas}
          total={perguntas.length}
          enviando={enviando}
          erro={erro}
          aoEnviar={enviar}
          aoRever={() => comTransicao(() => setIndice(0))}
        />
      ) : (
        <CartaoDePergunta
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

  // ═══════════════════════════════════════════════════════════════

  function responder(perguntaId: string, valor: Resposta) {
    setRespostas((atuais) => ({ ...atuais, [perguntaId]: valor }));
    setRevelando(true);

    // ⚠️ A pausa é curta de propósito: longa o bastante para a pessoa ler o painel,
    //    curta o bastante para não virar espera.
    setTimeout(() => {
      // ⭐ A View Transition faz a pergunta respondida SAIR pela esquerda enquanto a
      //    próxima entra pela direita. Sem ela só dá para animar quem chega, e a troca
      //    lê como pisca-pisca em vez de avanço.
      comTransicao(() => {
        setRevelando(false);
        setIndice((i) => i + 1);
      });
    }, PAUSA);
  }

  async function enviar() {
    setEnviando(true);
    setErro(null);

    try {
      const payload = Object.entries(respostas).map(([perguntaId, valor]) => ({
        perguntaId,
        valor,
      }));

      setResultado(await calcularAfinidade(payload));
    } catch (falha) {
      // ⭐ 422 não é erro de sistema: é o cidadão não ter respondido o suficiente
      setErro(
        falha instanceof RespostasInsuficientesError
          ? `Responda ao menos ${falha.minimo} perguntas para o resultado fazer sentido.`
          : 'Não foi possível calcular agora. Tente de novo.',
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

// ═══════════════════════════════════════════════════════════════════

function CartaoDePergunta({
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
    <div className="cartao-pergunta">
      <p className="rotulo-pergunta">Você concorda?</p>
      <h2 className="texto-pergunta">{pergunta.texto}</h2>

      <div className="opcoes-grandes">
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

      {/* ⭐ O retorno é o painel: comparecimento, NUNCA a direção do voto. */}
      <div className={`retorno ${revelando ? 'visivel' : ''}`} aria-live="polite">
        {revelando && pergunta.totalVotos > 0 && (
          <Painel posicionados={pergunta.totalVotos} total={pergunta.totalPossivel} />
        )}
        {/* ⚠️ Sem placar registrado, calar. "0 deputados se posicionaram" seria falso:
            o que falta é o dado, não o comparecimento. */}
        {revelando && pergunta.totalVotos === 0 && <p>Resposta registrada.</p>}
      </div>

      {aoVoltar && !revelando && (
        <button type="button" className="botao-texto voltar-pergunta" onClick={aoVoltar}>
          ← Voltar
        </button>
      )}
    </div>
  );
}

function Encerramento({
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
      <h2>Pronto</h2>
      <p className="ajuda">
        Você opinou em <strong>{opinadas}</strong> de {total} afirmações. Agora vamos
        comparar com o voto registrado de cada deputado.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <div className="encerramento-acoes">
        <button type="button" className="botao-destaque" disabled={enviando} onClick={aoEnviar}>
          {enviando ? 'Calculando…' : 'Ver meu resultado'}
        </button>
        <button type="button" className="botao-secundario" onClick={aoRever}>
          Rever respostas
        </button>
      </div>
    </div>
  );
}
