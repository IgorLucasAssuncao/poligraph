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
  fotoUrl,
  detalhe,
  seguindo,
  aoAlternarSeguir,
  legislatura,
}: {
  id: number;
  nome: string;
  partido: string;
  uf: string;
  fotoUrl?: string | null;
  detalhe?: React.ReactNode;
  seguindo?: boolean;
  aoAlternarSeguir?: (id: number, seguindoAgora: boolean) => void;
  /** A ficha abre neste mandato. Sem ela, no mais recente. */
  legislatura?: number;
}) {
  const ficha = `/parlamentar/${id}${legislatura ? `?legislatura=${legislatura}` : ''}`;

  return (
    <article className="linha">
      <Link to={ficha} aria-label={nome}>
        <Avatar nome={nome} fotoUrl={fotoUrl} tamanho="medio" />
      </Link>

      <div className="linha-corpo">
        <div className="linha-topo">
          <Link to={ficha} className="linha-nome">
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
