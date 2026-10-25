import type { Item } from './itensDoQueMudou';
import './novidades.css';

/**
 * A lista de novidades sobre quem a pessoa segue: data em mono e o fato. É a mesma no modal por
 * parlamentar e no sininho do cabeçalho, para os dois não divergirem.
 *
 * DECISÃO (2026-10-18): Compacta, com a data sobre o texto. As duas colunas ocupavam meia tela no
 * início e não cabiam no modal nem no painel do sininho.
 *
 * `nova`: diz quais ainda não foram vistas neste navegador; essas levam o traço de realce.
 * `comFonte`: a linha do órgão e do link do registro, que o sininho deixa de fora para caber.
 */
export function ListaDeNovidadesComponent({
  itens,
  nova,
  comFonte = true,
}: {
  itens: Item[];
  nova?: (chave: string) => boolean;
  comFonte?: boolean;
}) {
  return (
    <ul className="lista-novidades">
      {itens.map((item) => (
        <li key={item.chave} className={nova?.(item.chave) ? 'novidade-nova' : undefined}>
          <span className="novidade-data">{item.quando}</span>
          <p className="novidade-texto">{item.texto}</p>
          {comFonte && <p className="novidade-fonte">{item.fonte}</p>}
        </li>
      ))}
    </ul>
  );
}
