import { useEffect, useRef, useState } from 'react';
import { NOME_DA_CASA, type Casa, type Grafo, type NoDoGrafo } from '../../nucleo/api';
import { TelaDoGrafoComponent, type PosicaoDoCidadao } from './TelaDoGrafo';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

/**
 * A prancheta: o grafo ocupando a JANELA INTEIRA.
 *
 * ATENÇÃO: Numa coluna de 52rem o grafo não se lê: 643 pontos em 800px viram nuvem. Aqui ele
 * tem espaço para o zoom valer alguma coisa — e é onde o rosto nos nós aparece.
 *
 * DECISÃO: `<dialog>` nativo em vez de div sobreposta: traz Esc, captura de foco e inerte no
 * resto da página de graça — três coisas que uma div exigiria reimplementar, e que
 * costumam ficar pela metade. A saída fica declarada num botão "Voltar", porque numa
 * tela sem moldura o ✕ não diz o que ele fecharia.
 *
 * Monta na primeira abertura e não desmonta ao fechar: desmontar no clique faria a
 * animação de saída acontecer sobre uma caixa vazia.
 *
 * ATENÇÃO: Sem barra de título. O nome da casa e a contagem já estão na página que
 * abriu a prancheta, e repeti-los aqui custava uma faixa de altura em troca de
 * informação que o leitor acabou de ver. O título fica só para leitor de tela.
 *
 * ATENÇÃO: Não monta antes da primeira abertura: o Canvas mediria o contêiner com
 * altura zero e desenharia num quadro invisível.
 */
export function GrafoAmpliadoComponent({
  grafo,
  cidadao,
  aberto,
  aoFechar,
  aoSelecionar,
  titulo = T.grafoAmpliado.titulo,
}: {
  grafo: Grafo;
  cidadao?: PosicaoDoCidadao | null;
  aberto: boolean;
  aoFechar: () => void;
  aoSelecionar?: (no: NoDoGrafo) => void;
  /** ATENÇÃO: Vem de fora porque o modal não sabe de que casa é o grafo que recebeu. */
  titulo?: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  const [jaAbriu, setJaAbriu] = useState(aberto);
  if (aberto && !jaAbriu) setJaAbriu(true);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;

    if (aberto) {
      if (!elemento.open) elemento.showModal();
    } else if (elemento.open) {
      elemento.close();
    }
  }, [aberto]);

  return (
    <dialog ref={dialogo} className="grafo-ampliado" onClose={aoFechar} onCancel={aoFechar}>
      <h2 className="apenas-leitor-de-tela">
        {T.grafoAmpliado.resumo(
          titulo,
          grafo.nos.length,
          NOME_DA_CASA[grafo.casa as Casa]?.plural ?? T.grafoAmpliado.parlamentares,
          grafo.arestas.length,
        )}
      </h2>

      <button type="button" className="grafo-voltar" onClick={aoFechar}>
        <span aria-hidden="true">←</span>
        {T.grafoAmpliado.voltar}
      </button>

      {jaAbriu && (
        <TelaDoGrafoComponent
          grafo={grafo}
          cidadao={cidadao}
          aoSelecionar={aoSelecionar}
          preencher
        />
      )}
    </dialog>
  );
}
