import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { BotaoSeguir } from './BotaoSeguir';

/**
 * Cartão de parlamentar — a unidade visual repetida em todo o site.
 *
 * ⚠️ `detalhe` recebe texto já formatado pela tela que o usa. Na afinidade é
 * "concordaram em X de Y", ⛔ nunca percentual (RF-29).
 */
export function CartaoParlamentar({
  id,
  nome,
  partido,
  uf,
  detalhe,
  seguindo,
  aoAlternarSeguir,
}: {
  id: number;
  nome: string;
  partido: string;
  uf: string;
  detalhe?: React.ReactNode;
  seguindo?: boolean;
  aoAlternarSeguir?: (id: number, seguindoAgora: boolean) => void;
}) {
  return (
    <article className="cartao">
      <Link to={`/parlamentar/${id}`} className="cartao-link">
        <Avatar nome={nome} />

        <div className="cartao-texto">
          <strong className="cartao-nome">{nome}</strong>
          <span className="cartao-filiacao">
            {partido}
            {uf && ` · ${uf}`}
          </span>
          {detalhe && <span className="cartao-detalhe">{detalhe}</span>}
        </div>
      </Link>

      {aoAlternarSeguir && (
        <BotaoSeguir
          pessoaId={id}
          seguindo={seguindo ?? false}
          aoAlternar={aoAlternarSeguir}
        />
      )}
    </article>
  );
}
