import { useEffect, useState } from 'react';
import {
  calcularAfinidade,
  obterPerguntas,
  RespostasInsuficientesError,
  type Pergunta,
  type Resposta,
  type ResultadoAfinidade,
} from '../api';
import { Resultado } from '../componentes/Resultado';

/**
 * O questionário.
 *
 * ⚠️ Formato AFIRMAÇÃO — "X deve ser Y." — com Concordo / Discordo / Não sei.
 * ⛔ A API não devolve polaridade nem id da votação: expor isso deixaria o cidadão
 * inferir o voto do parlamentar antes de responder.
 */
export function Questionario() {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({});
  const [resultado, setResultado] = useState<ResultadoAfinidade | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obterPerguntas()
      .then(setPerguntas)
      .catch(() => setErro('Não foi possível carregar as perguntas.'));
  }, []);

  if (resultado) {
    return <Resultado resultado={resultado} aoRefazer={() => setResultado(null)} />;
  }

  const respondidas = Object.values(respostas).filter((v) => v !== 0).length;

  return (
    <section className="questionario">
      <h2>Com quem você mais concorda?</h2>
      <p className="ajuda">
        Cada afirmação abaixo foi votada de verdade na Câmara. Responda o que você acha —
        no fim, comparamos com o voto de cada parlamentar.
      </p>

      {perguntas.map((pergunta) => (
        <fieldset key={pergunta.id} className="pergunta">
          <legend>{pergunta.texto}</legend>

          {OPCOES.map(([valor, rotulo]) => (
            <label key={rotulo}>
              <input
                type="radio"
                name={pergunta.id}
                checked={respostas[pergunta.id] === valor}
                onChange={() => setRespostas({ ...respostas, [pergunta.id]: valor })}
              />
              {rotulo}
            </label>
          ))}
        </fieldset>
      ))}

      {erro && <p role="alert" className="erro">{erro}</p>}

      <button type="button" disabled={enviando} onClick={enviar}>
        {enviando ? 'Calculando…' : `Ver resultado (${respondidas} respondidas)`}
      </button>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════

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
}

const OPCOES: [Resposta, string][] = [
  [1, 'Concordo'],
  [-1, 'Discordo'],
  [0, 'Não sei'],
];
