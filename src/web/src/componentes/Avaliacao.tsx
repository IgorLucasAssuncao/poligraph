import { useEffect, useRef, useState } from 'react';
import { registrarAvaliacao, type ResultadoAfinidade } from '../api';

/**
 * Avaliação do questionário — o feedback que valida o método.
 *
 * ⚠️ **Modal, não rodapé.** Estava no fim da tela de resultado, depois das duas listas
 * e do aviso legal: quem não rolava até lá nunca via, e a amostra da pesquisa dependia
 * de quem tem paciência de rolar — que é um recorte enviesado da população.
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
export function Avaliacao({
  resultado,
  esperaMs = ESPERA,
}: {
  resultado: ResultadoAfinidade;
  /** ⭐ Injetável para o teste não precisar de relógio falso — que briga com o
   *  `userEvent` e trava a suíte. */
  esperaMs?: number;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [acertou, setAcertou] = useState<boolean | null>(null);
  const [posicao, setPosicao] = useState<number | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    // ⚠️ A espera é deliberada: abrir junto com o resultado atropelaria a leitura, e a
    //    pessoa fecharia o modal sem ter visto o que veio responder.
    const relogio = setTimeout(() => dialogo.current?.showModal(), esperaMs);

    return () => clearTimeout(relogio);
  }, [esperaMs]);

  return (
    <dialog ref={dialogo} className="modal-avaliacao" onCancel={fechar}>
      {enviado ? (
        <div className="avaliacao-pronta">
          <p>✓ Obrigado. Sua avaliação ajuda a medir se o método funciona.</p>
          <button type="button" className="botao-destaque" onClick={fechar}>
            Voltar ao resultado
          </button>
        </div>
      ) : (
        <form method="dialog" onSubmit={(e) => e.preventDefault()}>
          <header>
            <h2>Ajude a avaliar</h2>
            {/* ⭐ "Opcionais" dito antes das perguntas, não depois. */}
            <p className="ajuda">Duas perguntas rápidas e opcionais, para a pesquisa.</p>
          </header>

          <fieldset>
            <legend>O resultado combinou com o que você esperava?</legend>
            <div className="opcoes-avaliacao">
              {[
                [true, 'Combinou'],
                [false, 'Não combinou'],
              ].map(([valor, rotulo]) => (
                <label
                  key={String(valor)}
                  className={acertou === valor ? 'escala-ativa' : ''}
                >
                  <input
                    type="radio"
                    name="acertou"
                    onChange={() => setAcertou(valor as boolean)}
                  />
                  <span>{rotulo as string}</span>
                </label>
              ))}
            </div>
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
            🔒 Estas duas respostas são gravadas{' '}
            <strong>sem ligação com a sua conta</strong>. Servem para medir se o método
            acerta, não para montar seu perfil.
          </p>

          {erro && <p className="erro">Não foi possível enviar. Tente de novo.</p>}

          <div className="modal-acoes">
            <button
              type="button"
              className="botao-destaque"
              onClick={enviar}
              disabled={acertou === null && posicao === null}
            >
              Enviar avaliação
            </button>
            {/* 🔴 Recusar precisa ser tão fácil quanto aceitar. */}
            <button type="button" className="botao-secundario" onClick={fechar}>
              Agora não
            </button>
          </div>
        </form>
      )}
    </dialog>
  );

  // ═══════════════════════════════════════════════════════════════

  function fechar() {
    dialogo.current?.close();
  }

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

/** Milissegundos entre o resultado aparecer e o modal subir. */
const ESPERA = 2200;

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
