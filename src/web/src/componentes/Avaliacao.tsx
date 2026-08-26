import { useState } from 'react';
import { registrarAvaliacao, type ResultadoAfinidade } from '../api';

/**
 * Avaliação do questionário — o feedback que valida o método.
 *
 * 🔴 Duas decisões que precisam estar visíveis para quem mexer aqui:
 *
 * 1. É perguntado DEPOIS do resultado, nunca antes. Perguntar a posição política antes
 *    ancoraria as respostas do questionário no rótulo que a pessoa escolheu para si —
 *    e o instrumento passaria a medir o rótulo, não o voto.
 *
 * 2. O que é enviado ⛔ NÃO carrega a identidade. O servidor grava a autodeclaração
 *    sem `usuario_id`, de propósito: assim ela responde "o instrumento acerta?" sem
 *    responder "o que o Fulano pensa?".
 */
export function Avaliacao({ resultado }: { resultado: ResultadoAfinidade }) {
  const [acertou, setAcertou] = useState<boolean | null>(null);
  const [posicao, setPosicao] = useState<number | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(false);

  if (enviado) {
    return (
      <section className="avaliacao avaliacao-pronta">
        <p>✓ Obrigado. Sua avaliação ajuda a medir se o método funciona.</p>
      </section>
    );
  }

  return (
    <section className="avaliacao">
      <h3>Ajude a avaliar</h3>
      <p className="ajuda">
        Duas perguntas rápidas e opcionais, para a pesquisa deste trabalho.
      </p>

      <fieldset>
        <legend>O resultado combinou com o que você esperava?</legend>
        <label>
          <input type="radio" name="acertou" onChange={() => setAcertou(true)} />
          Combinou
        </label>
        <label>
          <input type="radio" name="acertou" onChange={() => setAcertou(false)} />
          Não combinou
        </label>
      </fieldset>

      <fieldset>
        <legend>Como você descreveria sua posição política?</legend>
        <div className="escala">
          {ESCALA.map(([valor, rotulo]) => (
            <label key={valor} className={posicao === valor ? 'escala-ativa' : ''}>
              <input type="radio" name="posicao" onChange={() => setPosicao(valor)} />
              <span>{rotulo}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* ⚠️ Dito no lugar onde a pessoa decide responder, não escondido na política. */}
      <p className="nota-privacidade">
        🔒 Estas duas respostas são gravadas <strong>sem ligação com a sua conta</strong>.
        Servem para medir se o método acerta, não para montar seu perfil.
      </p>

      {erro && <p className="erro">Não foi possível enviar. Tente de novo.</p>}

      <button type="button" onClick={enviar} disabled={acertou === null && posicao === null}>
        Enviar avaliação
      </button>
    </section>
  );

  // ═══════════════════════════════════════════════════════════════

  async function enviar() {
    const primeiro = resultado.maisProximos[0];

    try {
      await registrarAvaliacao({
        perguntasRespondidas: resultado.totalPerguntasRespondidas,
        acordosDoPrimeiro: primeiro?.acordos ?? 0,
        comparaveisDoPrimeiro: primeiro?.comparaveis ?? 0,
        acertou,
        posicaoAutodeclarada: posicao,
      });

      setEnviado(true);
    } catch {
      setErro(true);
    }
  }
}

/**
 * ⚠️ Escala de 7 pontos, com o centro nomeado.
 *
 * Sem um "centro" explícito, quem não se identifica com nenhum lado ou não responde ou
 * escolhe arbitrariamente — e os dois casos sujam a amostra.
 */
const ESCALA: [number, string][] = [
  [-3, 'Esquerda'],
  [-2, 'Centro-esquerda'],
  [-1, 'Centro-esq. leve'],
  [0, 'Centro'],
  [1, 'Centro-dir. leve'],
  [2, 'Centro-direita'],
  [3, 'Direita'],
];
