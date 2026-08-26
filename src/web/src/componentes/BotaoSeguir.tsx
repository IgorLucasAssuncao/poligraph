import { useState } from 'react';
import { deixarDeSeguir, seguir } from '../api';

/**
 * 🔴 Este botão escreve na tabela `segue`, que é REGISTRO DE CONVICÇÃO POLÍTICA
 * — dado sensível pela LGPD art. 5º, II.
 *
 * ⚠️ O estado é otimista: a interface muda antes da confirmação, e volta se falhar.
 * Sem isso o clique parece travado, e a pessoa clica de novo — gerando duas chamadas
 * para uma intenção só. O `PUT` é idempotente justamente para tolerar isso.
 */
export function BotaoSeguir({
  pessoaId,
  seguindo,
  aoAlternar,
}: {
  pessoaId: number;
  seguindo: boolean;
  aoAlternar: (id: number, seguindoAgora: boolean) => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  return (
    <button
      type="button"
      className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
      disabled={ocupado}
      aria-pressed={seguindo}
      onClick={alternar}
    >
      {seguindo ? 'Seguindo' : 'Seguir'}
    </button>
  );

  async function alternar(evento: React.MouseEvent) {
    evento.preventDefault();
    evento.stopPropagation();   // o cartão inteiro é um link

    const proximo = !seguindo;
    setOcupado(true);
    aoAlternar(pessoaId, proximo);   // otimista

    try {
      await (proximo ? seguir(pessoaId) : deixarDeSeguir(pessoaId));
    } catch {
      aoAlternar(pessoaId, !proximo);   // desfaz
    } finally {
      setOcupado(false);
    }
  }
}
