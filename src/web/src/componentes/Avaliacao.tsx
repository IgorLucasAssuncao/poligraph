import { useEffect, useRef, useState } from 'react';
import { registrarAvaliacao, type ResultadoAfinidade } from '../api';
import { TEXTOS_DO_QUESTIONARIO } from '../textos/questionario';

const A = TEXTOS_DO_QUESTIONARIO.avaliacao;

/**
 * Avaliação do questionário — o feedback que valida o método.
 *
 * ATENÇÃO: **Modal, não rodapé.** Estava no fim da tela de resultado, depois das duas listas
 * e do aviso legal: quem não rolava até lá nunca via, e a amostra da pesquisa dependia
 * de quem tem paciência de rolar — que é um recorte enviesado da população.
 *
 * RISCO: Duas decisões que precisam estar visíveis para quem mexer aqui:
 *
 * 1. É perguntado DEPOIS do resultado, nunca antes. Perguntar a posição política antes
 *    ancoraria as respostas do questionário no rótulo que a pessoa escolheu para si —
 *    e o instrumento passaria a medir o rótulo, não o voto.
 *
 * 2. O que é enviado NÃO carrega a identidade. O servidor grava a autodeclaração
 *    sem `usuario_id`, de propósito: assim ela responde "o instrumento acerta?" sem
 *    responder "o que o Fulano pensa?".
 *
 * ATENÇÃO: Nunca por cima de outro diálogo (o tour, as contas): dois modais empilhados
 * tiram da pessoa o controle de qual fechar. Tenta de novo logo depois.
 *
 * DECISÃO: O que vier primeiro: o tempo de ler, ou a pessoa ter rolado até o fim dos
 * resultados das duas casas — aí ela já viu o que veio buscar.
 *
 * DECISÃO: "Opcionais" dito antes das perguntas, não depois.
 *
 * ATENÇÃO: Dito no lugar onde a pessoa decide responder, não escondido na política.
 *
 * RISCO: Recusar precisa ser tão fácil quanto aceitar.
 *
 * O primeiro da PRIMEIRA casa devolvida. A avaliação pergunta "acertou?", e a
 * referência é o parlamentar em destaque no topo da tela — que é esse.
 */
export function AvaliacaoComponent({
  resultado,
  esperaMs = ESPERA,
}: {
  resultado: ResultadoAfinidade;
  /** DECISÃO: Injetável para o teste não precisar de relógio falso — que briga com o
   *  `userEvent` e trava a suíte. */
  esperaMs?: number;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [acertou, setAcertou] = useState<boolean | null>(null);
  const [posicao, setPosicao] = useState<number | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(false);

  const fimDosResultados = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let aberto = false;

    const abrir = () => {
      if (aberto || !dialogo.current) return;
      if (document.querySelector('dialog[open]')) {
        relogio = setTimeout(abrir, 1500);
        return;
      }
      aberto = true;
      dialogo.current.showModal();
    };

    let relogio = setTimeout(abrir, esperaMs);

    const alvo = fimDosResultados.current;
    const observador =
      alvo && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([entrada]) => entrada.isIntersecting && abrir())
        : null;
    if (observador && alvo) observador.observe(alvo);

    return () => {
      clearTimeout(relogio);
      observador?.disconnect();
    };
  }, [esperaMs]);

  return (
    <>
    <div ref={fimDosResultados} aria-hidden="true" />
    <dialog ref={dialogo} className="modal-avaliacao" onCancel={fechar}>
      {enviado ? (
        <div className="avaliacao-pronta">
          <p>{A.obrigado}</p>
          <button type="button" className="botao-destaque" onClick={fechar}>
            {A.voltar}
          </button>
        </div>
      ) : (
        <form method="dialog" onSubmit={(e) => e.preventDefault()}>
          <header>
            <h2>{A.titulo}</h2>
            <p className="ajuda">{A.subtitulo}</p>
          </header>

          <fieldset>
            <legend>{A.combinou}</legend>
            <div className="opcoes-avaliacao">
              {[
                [true, A.sim],
                [false, A.nao],
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
            <legend>{A.posicao}</legend>
            <div className="escala">
              {ESCALA.map(([valor, rotulo]) => (
                <label key={valor} className={posicao === valor ? 'escala-ativa' : ''}>
                  <input type="radio" name="posicao" onChange={() => setPosicao(valor)} />
                  <span>{rotulo}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="nota-privacidade">{A.privacidade}</p>

          {erro && <p className="erro">{A.erro}</p>}

          <div className="modal-acoes">
            <button
              type="button"
              className="botao-destaque"
              onClick={enviar}
              disabled={acertou === null && posicao === null}
            >
              {A.enviar}
            </button>
            <button type="button" className="botao-secundario" onClick={fechar}>
              {A.agoraNao}
            </button>
          </div>
        </form>
      )}
    </dialog>
    </>
  );

  function fechar() {
    dialogo.current?.close();
  }

  async function enviar() {
    const primeiro = resultado.porCasa[0]?.maisProximos[0];

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
 * Milissegundos entre o resultado aparecer e o modal subir, se a pessoa não rolar antes.
 *
 * ATENÇÃO: Eram 2,2 s — menos que o tempo de ler o nome do primeiro parlamentar. O pedido de
 * avaliação chegava antes do valor que ela avaliaria.
 */
const ESPERA = 8000;

/**
 * ATENÇÃO: Escala de 7 pontos, com o centro nomeado.
 *
 * Sem um "centro" explícito, quem não se identifica com nenhum lado ou não responde ou
 * escolhe arbitrariamente — e os dois casos sujam a amostra.
 */
const ESCALA: [number, string][] = A.escala;
