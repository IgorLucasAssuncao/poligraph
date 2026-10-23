import { Link } from 'react-router-dom';
import { nomeDePessoa } from '../formato';
import { AvatarComponent } from './Avatar';
import { BotaoSeguirComponent } from './BotaoSeguir';

/**
 * A linha de parlamentar — unidade visual repetida em toda a timeline.
 *
 * ATENÇÃO: `detalhe` vem formatado pela tela que usa. Na afinidade é "concordaram em X de Y",
 * nunca percentual (RF-29).
 */
export function LinhaParlamentarComponent({
  idPessoa,
  nome,
  partido,
  uf,
  fotoUrl,
  detalhe,
  seguindo,
  aoAlternarSeguir,
  legislatura,
}: {
  idPessoa: number;
  nome: string;
  partido: string;
  uf: string;
  fotoUrl?: string | null;
  detalhe?: React.ReactNode;
  seguindo?: boolean;
  aoAlternarSeguir?: (idPessoa: number, seguindoAgora: boolean) => void;
  /** A ficha abre neste mandato. Sem ela, no mais recente. */
  legislatura?: number;
}) {
  const ficha = `/parlamentar/${idPessoa}${legislatura ? `?legislatura=${legislatura}` : ''}`;
  const exibido = nomeDePessoa(nome);

  return (
    <article className="linha">
      <Link to={ficha} aria-label={exibido}>
        <AvatarComponent nome={exibido} fotoUrl={fotoUrl} tamanho="medio" />
      </Link>

      <div className="linha-corpo">
        <div className="linha-topo">
          <Link to={ficha} className="linha-nome">
            {exibido}
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
          <BotaoSeguirComponent
            idPessoa={idPessoa}
            seguindo={seguindo ?? false}
            aoAlternar={aoAlternarSeguir}
          />
        </div>
      )}
    </article>
  );
}
