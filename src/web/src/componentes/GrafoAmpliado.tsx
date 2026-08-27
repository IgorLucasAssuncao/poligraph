import { useEffect, useRef, useState } from 'react';
import type { Grafo, NoDoGrafo } from '../api';
import { TelaDoGrafo, type PosicaoDoCidadao } from './TelaDoGrafo';

/**
 * O grafo ocupando quase a tela toda.
 *
 * ⚠️ Numa coluna de 52rem o grafo não se lê: 655 pontos em 800px viram nuvem. Aqui ele
 * tem espaço para o zoom valer alguma coisa.
 *
 * ⭐ `<dialog>` nativo em vez de div sobreposta: traz Esc, captura de foco e inerte no
 * resto da página de graça — três coisas que uma div exigiria reimplementar, e que
 * costumam ficar pela metade.
 */
export function GrafoAmpliado({
  grafo,
  cidadao,
  aberto,
  aoFechar,
  aoSelecionar,
}: {
  grafo: Grafo;
  cidadao?: PosicaoDoCidadao | null;
  aberto: boolean;
  aoFechar: () => void;
  aoSelecionar?: (no: NoDoGrafo) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  // Monta na primeira abertura e ⛔ não desmonta ao fechar: desmontar no clique faria a
  // animação de saída acontecer sobre uma caixa vazia.
  const [jaAbriu, setJaAbriu] = useState(false);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;

    if (aberto) {
      setJaAbriu(true);
      if (!elemento.open) elemento.showModal();
    } else if (elemento.open) {
      elemento.close();
    }
  }, [aberto]);

  return (
    <dialog ref={dialogo} className="grafo-ampliado" onClose={aoFechar} onCancel={aoFechar}>
      <header>
        <div>
          <h2>Quem vota com quem</h2>
          <p className="ajuda">
            {grafo.nos.length} deputados · {grafo.arestas.length} ligações
          </p>
        </div>

        <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
          ✕
        </button>
      </header>

      {/* ⚠️ ⛔ Não monta antes da primeira abertura: o Canvas mediria o contêiner com
          altura zero e desenharia num quadro invisível. */}
      {jaAbriu && (
        <TelaDoGrafo
          grafo={grafo}
          cidadao={cidadao}
          aoSelecionar={aoSelecionar}
          altura={Math.round(window.innerHeight * 0.66)}
        />
      )}
    </dialog>
  );
}
