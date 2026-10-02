import { Link } from 'react-router-dom';
import type { Mandato } from '../api';
import { periodoDaLegislatura } from '../formato';

/**
 * Os mandatos do parlamentar, e qual deles a ficha está mostrando.
 *
 * ⭐ Um mandato só ⛔ vira seletor: vira a linha que diz de quando é o que está na tela.
 * Com dois ou mais, cada um é um link — `?legislatura=` no endereço, para o "voltar" do
 * navegador e o link compartilhado continuarem valendo.
 *
 * ⚠️ Partido e UF são os do último voto DAQUELE mandato: quem trocou de partido aparece
 * com a sigla de então, ⛔ com a de hoje.
 */
export function MandatosDoParlamentar({
  mandatos,
  atual,
  caminho,
}: {
  mandatos: Mandato[];
  atual: number | null;
  /** O endereço da aba aberta, sem a busca: o mandato troca e a aba fica. */
  caminho: string;
}) {
  if (mandatos.length === 0) return null;

  if (mandatos.length === 1) {
    const [unico] = mandatos;
    return (
      <p className="mandatos-unico">
        Mandato <span className="dado">{periodoDaLegislatura(unico.legislatura)}</span>
      </p>
    );
  }

  return (
    <nav className="mandatos" aria-label="Mandatos">
      <span className="mandatos-rotulo">Mandatos</span>
      <ul>
        {mandatos.map((m, i) => {
          const ativo = m.legislatura === atual;
          const destino = i === 0 ? caminho : `${caminho}?legislatura=${m.legislatura}`;

          return (
            <li key={`${m.legislatura}-${m.casa}`}>
              <Link
                to={destino}
                replace
                className={ativo ? 'ativo' : ''}
                aria-current={ativo ? 'true' : undefined}
              >
                <span className="dado">{periodoDaLegislatura(m.legislatura)}</span>
                <span className="mandatos-detalhe">
                  {m.casa === 'SENADO' ? 'Senado' : 'Câmara'}
                  {m.partido && ` · ${m.partido}`}
                  {m.uf && `-${m.uf}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
