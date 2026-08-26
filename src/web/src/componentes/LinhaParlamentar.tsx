import { Link } from 'react-router-dom';
import { Avatar } from './Avatar';
import { BotaoSeguir } from './BotaoSeguir';

/**
 * A linha de parlamentar — unidade visual repetida em toda a timeline.
 *
 * ⚠️ `detalhe` vem formatado pela tela que usa. Na afinidade é "concordaram em X de Y",
 * ⛔ nunca percentual (RF-29).
 */
export function LinhaParlamentar({
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
    <article className="linha">
      <Link to={`/parlamentar/${id}`} aria-label={nome}>
        <Avatar nome={nome} tamanho="medio" />
      </Link>

      <div className="linha-corpo">
        <div className="linha-topo">
          <Link to={`/parlamentar/${id}`} className="linha-nome">
            {nome}
          </Link>
          <span className="linha-meta">
            {partido}
            {uf && ` · ${uf}`}
          </span>
        </div>

        {detalhe && <span className="linha-detalhe">{detalhe}</span>}
      </div>

      {aoAlternarSeguir && (
        <div className="linha-acao">
          <BotaoSeguir
            pessoaId={id}
            seguindo={seguindo ?? false}
            aoAlternar={aoAlternarSeguir}
          />
        </div>
      )}
    </article>
  );
}
