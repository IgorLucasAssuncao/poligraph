import { useState, type ReactNode } from 'react';
import { TEXTOS_DOS_COMPONENTES } from '../textos/componentes';

const T = TEXTOS_DOS_COMPONENTES.graficos;

/** Um ano no gráfico de colunas: um valor por série, na ordem de `series`. */
export type AnoNoGrafico = { ano: number; valores: number[]; nota?: string };

/**
 * Colunas por ano, baixas, com uma ou mais séries lado a lado.
 *
 * DECISÃO (2026-10-10): substitui a lista de linhas "por ano", que pedia ler número a número para
 * ver a tendência. Passar o mouse ou focar com Tab mostra o valor exato; com `aoEscolher`, clicar
 * num ano o escolhe como período. A tabela com os mesmos números fica recolhida logo abaixo, para
 * quem quer conferir e para o leitor de tela.
 *
 * DECISÃO (2026-10-23): com uma série só, o valor fica escrito em cima de cada coluna, e todo ano tem rótulo. Antes, o número
 * só aparecia com o mouse, e metade dos anos ficava sem nome mesmo com espaço. Com várias séries lado a lado, os valores
 * se encavalariam: ficam no balão e na tabela. Na tela estreita, um ano sim, um não, e os valores somem.
 *
 * ATENÇÃO: as séries se distinguem por tom do mesmo teal, nunca por cor de partido (RNF-16).
 * Valor negativo vira coluna vazia; o número aparece no balão e na tabela.
 */
export function ColunasPorAnoComponent({
  rotulo,
  series,
  anos,
  formatar,
  anoEscolhido,
  aoEscolher,
  tabela,
}: {
  /** O nome do gráfico para o leitor de tela. */
  rotulo: string;
  series: string[];
  anos: AnoNoGrafico[];
  formatar: (valor: number) => string;
  /** O ano que está sozinho no período, aceso no gráfico. */
  anoEscolhido?: number | null;
  aoEscolher?: (ano: number) => void;
  /** Uma tabela própria no lugar da que o gráfico monta, quando ela tem colunas a mais. */
  tabela?: ReactNode;
}) {
  const [emFoco, setEmFoco] = useState<{ ano: number; serie: number } | null>(null);
  const maior = Math.max(...anos.flatMap((a) => a.valores), 1);
  const focado = emFoco && anos.find((a) => a.ano === emFoco.ano);
  const pulaRotulo = anos.length > 10;
  const comValor = series.length === 1;

  return (
    <figure className="grafico-colunas" aria-label={rotulo}>
      <p className="grafico-dica" aria-live="polite">
        {focado && emFoco
          ? `${focado.ano}${series.length > 1 ? ` · ${series[emFoco.serie]}` : ''}: ${formatar(focado.valores[emFoco.serie])}${focado.nota ? ` · ${focado.nota}` : ''}`
          : semMouse()
            ? aoEscolher
              ? T.dicaComEscolhaNoToque
              : T.dicaNoToque
            : aoEscolher
              ? T.dicaComEscolha
              : T.dica}
      </p>
      <div className="grafico-colunas-area" onMouseLeave={() => setEmFoco(null)}>
        {anos.map((a, i) => (
          <div
            key={a.ano}
            className={`grafico-colunas-ano${anoEscolhido === a.ano ? ' escolhido' : ''}`}
          >
            <div className="grafico-colunas-barras">
              {a.valores.map((valor, serie) => (
                <button
                  key={series[serie]}
                  type="button"
                  className={`grafico-colunas-barra tom-${serie}`}
                  aria-label={`${a.ano}, ${series[serie]}: ${formatar(valor)}`}
                  aria-pressed={aoEscolher ? anoEscolhido === a.ano : undefined}
                  onMouseEnter={() => setEmFoco({ ano: a.ano, serie })}
                  onFocus={() => setEmFoco({ ano: a.ano, serie })}
                  onBlur={() => setEmFoco(null)}
                  onClick={aoEscolher ? () => aoEscolher(a.ano) : undefined}
                >
                  {comValor && (
                    <small className="grafico-colunas-valor" aria-hidden="true">
                      {formatar(valor)}
                    </small>
                  )}
                  <span
                    style={{
                      height: comValor
                        ? `calc((100% - 1.1rem) * ${Math.max(valor, 0) / maior})`
                        : `${(Math.max(valor, 0) / maior) * 100}%`,
                    }}
                  />
                </button>
              ))}
            </div>
            <span
              className={`grafico-colunas-rotulo${pulaRotulo && i % 2 === 1 && i !== anos.length - 1 ? ' rotulo-secundario' : ''}`}
              aria-hidden="true"
            >
              {a.ano}
            </span>
          </div>
        ))}
      </div>

      {series.length > 1 && <LegendaComponent nomes={series} />}

      <details className="grafico-tabela">
        <summary>{T.verTabela}</summary>
        {tabela ?? (
          <table>
            <thead>
              <tr>
                <th scope="col">{T.ano}</th>
                {series.map((s) => (
                  <th key={s} scope="col">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anos.map((a) => (
                <tr key={a.ano}>
                  <th scope="row">
                    {a.ano}
                    {a.nota && <small> · {a.nota}</small>}
                  </th>
                  {a.valores.map((v, i) => (
                    <td key={series[i]}>{formatar(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </figure>
  );
}

/** Se a tela é de toque, sem mouse para passar por cima: a dica fala em tocar. */
function semMouse(): boolean {
  return window.matchMedia?.('(hover: none)').matches ?? false;
}

/** Uma parte do todo na barra de composição. */
export type ParteDoTodo = { nome: string; valor: number; definicao?: string };

/**
 * Uma barra só, dividida nas partes de um total: diárias, passagens e o resto.
 *
 * DECISÃO (2026-10-10): ocupa uma linha no lugar de três números soltos e mostra de saída quanto
 * cada parte pesa. A legenda abaixo é a tabela: nome, valor, a parte de cada R$ 100 e a definição.
 * Passar o mouse numa parte, na barra ou na legenda, acende as duas.
 *
 * ATENÇÃO: as partes somam 100 exatos na legenda (maior resto), como no "de cada R$ 100" do
 * orçamento. Parte negativa ou zero fica fora da barra e aparece na legenda.
 */
export function ComposicaoComponent({
  rotulo,
  partes,
  formatar,
}: {
  rotulo: string;
  partes: ParteDoTodo[];
  formatar: (valor: number) => string;
}) {
  const [emFoco, setEmFoco] = useState<number | null>(null);
  const positivas = partes.map((p) => Math.max(p.valor, 0));
  const total = positivas.reduce((s, v) => s + v, 0);
  const cem = partesDeCem(positivas);

  return (
    <figure className="grafico-composicao" aria-label={rotulo} onMouseLeave={() => setEmFoco(null)}>
      <div className="grafico-composicao-barra">
        {partes.map((p, i) =>
          positivas[i] > 0 ? (
            <button
              key={p.nome}
              type="button"
              className={`grafico-composicao-parte tom-${i}${emFoco === i ? ' em-foco' : ''}`}
              style={{ flexGrow: positivas[i] / Math.max(total, 1) }}
              aria-label={`${p.nome}: ${formatar(p.valor)}, ${T.deCadaCem(cem[i])}`}
              onMouseEnter={() => setEmFoco(i)}
              onFocus={() => setEmFoco(i)}
              onBlur={() => setEmFoco(null)}
            />
          ) : null,
        )}
      </div>
      <ul className="grafico-legenda grafico-composicao-legenda">
        {partes.map((p, i) => (
          <li
            key={p.nome}
            className={emFoco === i ? 'em-foco' : undefined}
            onMouseEnter={() => setEmFoco(i)}
          >
            <span className={`grafico-amostra tom-${i}`} aria-hidden="true" />
            <span className="grafico-legenda-nome">
              {p.nome}
              {p.definicao && <small>{p.definicao}</small>}
            </span>
            <span className="grafico-legenda-valor">
              {formatar(p.valor)}
              <small>{T.deCadaCem(cem[i])}</small>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A legenda das séries de um gráfico de colunas. */
function LegendaComponent({ nomes }: { nomes: string[] }) {
  return (
    <ul className="grafico-legenda grafico-legenda-series" aria-hidden="true">
      {nomes.map((n, i) => (
        <li key={n}>
          <span className={`grafico-amostra tom-${i}`} />
          {n}
        </li>
      ))}
    </ul>
  );
}

/** Divide 100 entre as partes pelo maior resto: a soma dá 100 exatos. */
function partesDeCem(valores: number[]): number[] {
  const total = valores.reduce((s, v) => s + v, 0);
  if (total <= 0) {
    return valores.map(() => 0);
  }
  const brutas = valores.map((v) => (v / total) * 100);
  const inteiras = brutas.map(Math.floor);
  let falta = 100 - inteiras.reduce((s, v) => s + v, 0);
  const ordem = brutas.map((b, i) => [b - Math.floor(b), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of ordem) {
    if (falta <= 0) {
      break;
    }
    inteiras[i] += 1;
    falta -= 1;
  }
  return inteiras;
}
