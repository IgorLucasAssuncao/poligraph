import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deixarDeSeguir, seguir } from '../api';
import { useSessao } from '../sessao';
import { useEntrar } from './useEntrar';

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
  const { usuario } = useSessao();
  const entrar = useEntrar();

  /**
   * ⭐ Sem conta, o botão aparece igual e leva a entrar (2026-10-02, decisão do autor):
   * a conta só existe para seguir. Esconder o botão escondia também que dava para seguir.
   */
  if (!usuario) {
    return (
      <Link to={entrar} className="botao-seguir" title="Entre com o Google para seguir">
        <span>Seguir</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={seguindo ? 'botao-seguindo' : 'botao-seguir'}
      disabled={ocupado}
      aria-pressed={seguindo}
      onClick={alternar}
    >
      {/* ⚠️ O <span> não é decorativo: o CSS o esconde no hover para revelar
          "Deixar de seguir" no lugar. Sem ele, os dois textos aparecem juntos. */}
      <span>{seguindo ? 'Seguindo' : 'Seguir'}</span>
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
