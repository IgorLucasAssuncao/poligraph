import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Mandato } from '../api';
import { mesCurto, periodoDaLegislatura } from '../formato';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * Os mandatos do parlamentar, e qual deles a ficha está mostrando.
 *
 * DECISÃO: Um mandato só não vira seletor: vira a linha que diz de quando é o que está na tela.
 * Com dois ou mais, cada um é um link — `?legislatura=` no endereço, para o "voltar" do
 * navegador e o link compartilhado continuarem valendo.
 *
 * ATENÇÃO: Partido e UF são os do último voto DAQUELE mandato: quem trocou de partido aparece
 * com a sigla de então, não com a de hoje.
 *
 * ATENÇÃO: O período é o do primeiro ao último voto, e não o da legislatura. MEDIDO (2026-10-09):
 * na 57ª, 122 dos 643 deputados pararam de votar mais de 90 dias antes da última votação da casa e
 * 142 começaram depois de março de 2023; "Votou em 2023–2027" estava errado para eles.
 *
 * DECISÃO (2026-10-22): com mais de MANDATOS_A_VISTA, os mais antigos ficam recolhidos atrás de "ver
 * as outras N". Quem foi deputado e senador (Pendência 90, pessoas fundidas) tinha sete cartões antes das
 * abas. O mandato aberto na ficha aparece sempre, mesmo que seja antigo.
 *
 * ATENÇÃO: "Mandatos" dizia errado no Senado: o mandato de senador tem oito anos e cobre
 * duas legislaturas, e a lista mostrava um mandato só como dois.
 */
export function MandatosDoParlamentarComponent({
  mandatos,
  atual,
  caminho,
}: {
  mandatos: Mandato[];
  atual: number | null;
  /** O endereço da aba aberta, sem a busca: o mandato troca e a aba fica. */
  caminho: string;
}) {
  const [todos, setTodos] = useState(false);
  if (mandatos.length === 0) return null;

  if (mandatos.length === 1) {
    const [unico] = mandatos;
    return (
      <p className="mandatos-unico">
        {T.mandatos.votouDe}
        <span className="dado">{mesCurto(unico.primeiroVoto)}</span>
        {T.mandatos.ate}
        <span className="dado">{mesCurto(unico.ultimoVoto)}</span>
        {T.mandatos.naLegislatura}
        <span className="dado">{periodoDaLegislatura(unico.legislatura)}</span>
      </p>
    );
  }

  return (
    <nav className="mandatos" aria-label={T.mandatos.rotulo}>
      <span className="mandatos-rotulo">
        {T.mandatos.rotulo}
        {mandatos.some((m) => m.casa === 'SENADO') && <small>{T.mandatos.senadoCobreDuas}</small>}
      </span>
      <ul>
        {mandatos.map((m, i) => {
          const recolhido = !todos && i >= MANDATOS_A_VISTA && m.legislatura !== atual;
          if (recolhido) return null;
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
                  {m.casa === 'SENADO' ? T.mandatos.senado : T.mandatos.camara}
                  {m.partido && ` · ${m.partido}`}
                  {m.uf && `-${m.uf}`}
                  {` · ${mesCurto(m.primeiroVoto)}${T.mandatos.ate}${mesCurto(m.ultimoVoto)}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!todos && mandatos.length > MANDATOS_A_VISTA && (
        <button type="button" className="botao-texto mandatos-mais" onClick={() => setTodos(true)}>
          {T.mandatos.verOsOutros(mandatos.filter((m, i) => i >= MANDATOS_A_VISTA && m.legislatura !== atual).length)}
        </button>
      )}
    </nav>
  );
}

/** Quantos mandatos aparecem antes de "ver os outros": os mais recentes. */
const MANDATOS_A_VISTA = 3;
