import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type {
  ConveniosDaEmenda,
  FavorecidosDaEmenda,
  PagamentoPorMes,
} from '../api';
import { listarConvenios, listarEmendas, listarFavorecidos } from '../api';
import { anosDeCotaDaEmenda, dataCurta, mesCurto, mesesContinuos, reais } from '../formato';
import { BotaoBaixarCsv } from './BotaoBaixarCsv';
import { BotaoMostrarMais } from './BotaoMostrarMais';
import { baixarCsv, buscarTodas } from '../exportar';
import { LinkDeFonte } from './LinkDeFonte';
import { NENHUM, usePaginas } from './usePaginas';
import { Termo } from './Termo';

/**
 * Para onde o dinheiro das emendas foi de fato: quem recebeu, quando e por qual convênio.
 *
 * Cada parte é exportada sozinha: a aba de emendas do perfil põe "Quem recebeu" à vista e
 * as outras em "Ver detalhes".
 */

/**
 * RISCO: O que sai da lista não sai da conta. Intermediário, pessoas e registro sem
 * identificação aparecem como linhas próprias, com o valor — a soma da seção continua
 * sendo o total recebido.
 */
export function QuemRecebeu({
  pessoaId,
  favorecidos,
  ano,
}: {
  pessoaId: number;
  favorecidos: FavorecidosDaEmenda;
  ano: number;
}) {
  const porPagina = favorecidos.maiores.length || 8;
  const lista = usePaginas(favorecidos.maiores, favorecidos.identificados, porPagina, (pagina) =>
    listarFavorecidos(pessoaId, ano, pagina, porPagina),
  );

  if (favorecidos.recebido === 0) return null;

  const foraDaLista: [string, ReactNode, number][] = [
    ['intermediario', <Termo key="intermediario" nome="intermediario">Via Banco do Brasil, que repassa</Termo>, favorecidos.viaIntermediario],
    ['pessoas', <Termo key="pessoas" nome="favorecidoPessoa">A pessoas, sem identificação</Termo>, favorecidos.aPessoas],
    ['sem', 'Sem identificação na fonte', favorecidos.semIdentificacao],
  ];

  return (
    <>
      <h3 className="titulo-secao">Quem recebeu</h3>
      <p className="ajuda ajuda-espacada">
        <strong>{reais(favorecidos.recebido)}</strong> recebidos pelas emendas de {ano}
        {favorecidos.ultimoMes && <>, até {mesCurto(favorecidos.ultimoMes)}</>}. Inclui o que
        foi pago nos anos seguintes.
      </p>

      <ul className="gastos-fornecedores lista-favorecidos">
        {lista.itens.map((f, i) => (
          <li key={`${i}-${f.nome}`}>
            <span className="gasto-nome">
              {f.cnpj ? <Link to={`/entidades/${f.cnpj}`}>{f.nome}</Link> : f.nome}
              <small>{[f.naturezaJuridica, lugar(f.municipio, f.uf)].filter(Boolean).join(' · ')}</small>
              {f.tambemNaCota != null && (
                <small className="tambem-na-cota">
                  A cota deste parlamentar também pagou {reais(f.tambemNaCota)} a este CNPJ em{' '}
                  {anosDeCotaDaEmenda(ano)}
                </small>
              )}
            </span>
            <span className="gasto-valor">{reais(f.recebido)}</span>
          </li>
        ))}
        {foraDaLista
          .filter(([, , valor]) => valor !== 0)
          .map(([chave, rotulo, valor]) => (
            <li key={chave} className="fora-da-lista">
              <span className="gasto-nome">{rotulo}</span>
              <span className="gasto-valor">{reais(valor)}</span>
            </li>
          ))}
      </ul>
      <BotaoMostrarMais {...lista} aoClicar={lista.carregarMais} />
    </>
  );
}

function lugar(municipio: string | null, uf: string | null): string | null {
  if (municipio && uf) return `${municipio} - ${uf}`;
  return municipio ?? uf;
}

/**
 * Quando o dinheiro saiu, mês a mês — do primeiro ao último pagamento, sem pular mês.
 *
 * DECISÃO: A frase vem antes do gráfico: a leitura que importa é "quanto saiu no próprio ano",
 * e ela não deveria depender de a pessoa medir barras.
 *
 * ATENÇÃO: Mês com estorno maior que o pago fica com barra zero, e a dica mostra o valor
 * negativo. A tabela logo abaixo traz todos os meses, para quem não usa o mouse.
 */
export function QuandoFoiPago({ meses, ano }: { meses: PagamentoPorMes[]; ano: number }) {
  const [emFoco, setEmFoco] = useState<PagamentoPorMes | null>(null);

  if (meses.length === 0) return null;

  const serie = mesesContinuos(meses);
  const total = serie.reduce((soma, m) => soma + m.valor, 0);
  const noAno = serie.filter((m) => m.mes.startsWith(`${ano}-`)).reduce((s, m) => s + m.valor, 0);
  const maior = Math.max(...serie.map((m) => m.valor), 1);
  const parcela = total > 0 ? Math.round((noAno / total) * 100) : 0;

  return (
    <>
      <h3 className="titulo-secao">Quando foi pago</h3>
      <p className="ajuda ajuda-espacada">
        {reais(noAno)} de {reais(total)} (<strong>{parcela}%</strong>) saíram ainda em {ano}.
      </p>

      <figure className="grafico-meses">
        <p className="grafico-meses-dica" aria-live="polite">
          {emFoco ? `${mesCurto(emFoco.mes)} · ${reais(emFoco.valor)}` : ' '}
        </p>
        <div className="grafico-meses-barras" onMouseLeave={() => setEmFoco(null)}>
          {serie.map((m) => (
            <button
              key={m.mes}
              type="button"
              className={`grafico-meses-barra ${m.mes.endsWith('-01-01') ? 'virada-de-ano' : ''}`}
              aria-label={`${mesCurto(m.mes)}: ${reais(m.valor)}`}
              onMouseEnter={() => setEmFoco(m)}
              onFocus={() => setEmFoco(m)}
              onBlur={() => setEmFoco(null)}
            >
              <span style={{ height: `${(Math.max(m.valor, 0) / maior) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="grafico-meses-eixo" aria-hidden="true">
          <span>{mesCurto(serie[0].mes)}</span>
          <span>{mesCurto(serie[serie.length - 1].mes)}</span>
        </div>

        <details className="grafico-meses-tabela">
          <summary>Ver os valores em tabela</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Mês</th>
                <th scope="col">Pago</th>
              </tr>
            </thead>
            <tbody>
              {serie
                .filter((m) => m.valor !== 0)
                .map((m) => (
                  <tr key={m.mes}>
                    <td>{mesCurto(m.mes)}</td>
                    <td>{reais(m.valor)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </figure>
    </>
  );
}

/**
 * RISCO: O valor é do convênio inteiro. Quando ele recebe emenda de mais de um autor, a
 * linha diz de quantas — sem isso, a lista leria como dinheiro deste parlamentar.
 */
export function Convenios({
  pessoaId,
  convenios,
  ano,
}: {
  pessoaId: number;
  convenios: ConveniosDaEmenda;
  ano: number;
}) {
  const porPagina = convenios.maiores.length || 8;
  const lista = usePaginas(convenios.maiores, convenios.quantidade, porPagina, (pagina) =>
    listarConvenios(pessoaId, ano, pagina, porPagina),
  );

  if (convenios.quantidade === 0) return null;

  return (
    <>
      <h3 className="titulo-secao">
        <Termo nome="convenio">Convênios</Termo>
      </h3>
      <p className="ajuda ajuda-espacada">
        {convenios.quantidade} {convenios.quantidade === 1 ? 'convênio financiado' : 'convênios financiados'}{' '}
        por estas emendas. O valor é o do convênio inteiro.
      </p>

      <ul className="lista-convenios">
        {lista.itens.map((c) => (
          <li key={c.numero}>
            <div className="convenio-cabeca">
              <strong>{c.convenente}</strong>
              <span className="gasto-valor">{reais(c.valor)}</span>
            </div>
            {c.objeto && <p className="convenio-objeto">{c.objeto}</p>}
            <p className="convenio-meta">
              Convênio {c.numero} · publicado em {dataCurta(c.dataPublicacao)}
              {c.emendasQueFinanciam > 1 && (
                <> · financiado por {c.emendasQueFinanciam} emendas, de um ou mais autores</>
              )}
              {' · '}
              <LinkDeFonte href={c.urlFonte}>no Portal</LinkDeFonte>
            </p>
          </li>
        ))}
      </ul>
      <BotaoMostrarMais {...lista} aoClicar={lista.carregarMais} />
    </>
  );
}

/**
 * As emendas uma a uma, cada qual com o link no Portal — de onde toda soma acima se confere.
 *
 * DECISÃO: Fechadas até a pessoa pedir: quem só quer o resumo não precisa delas, e quem quer
 * conferir tem o caminho.
 */
export function EmendasUmaAUma({ pessoaId, ano, total }: { pessoaId: number; ano: number; total: number }) {
  const lista = usePaginas(NENHUM, total, 8, (pagina) => listarEmendas(pessoaId, ano, pagina, 8));

  return (
    <>
      <h3 className="titulo-secao">
        Emenda por emenda{' '}
        <BotaoBaixarCsv
          rotulo="Baixar todas (CSV)"
          montar={async () => {
            const todas = await buscarTodas((pagina) => listarEmendas(pessoaId, ano, pagina, 50));
            baixarCsv(
              `emendas-${pessoaId}-${ano}.csv`,
              ['Código', 'Tipo', 'Localidade', 'Localidades', 'Função', 'Empenhado', 'Pago', 'Portal'],
              todas.map((e) => [e.codigo, e.tipo, e.localidade, e.localidades, e.funcao, e.empenhado, e.pago, e.urlFonte]),
            );
          }}
        />
      </h3>
      {lista.itens.length > 0 && (
        <ul className="lista-lancamentos">
          {lista.itens.map((e) => (
            <li key={e.codigo}>
              <span className="gasto-nome">
                {e.localidade ?? 'Sem localidade'}
                {e.localidades > 1 && ` e mais ${e.localidades - 1}`}
                <small>
                  {e.codigo} · {e.funcao ?? 'sem função'} · {reais(e.pago)} pagos
                </small>
              </span>
              <span className="lancamento-fim">
                <span className="gasto-valor">{reais(e.empenhado)}</span>
                <LinkDeFonte href={e.urlFonte}>no Portal</LinkDeFonte>
              </span>
            </li>
          ))}
        </ul>
      )}
      <BotaoMostrarMais
        {...lista}
        rotulo={lista.itens.length === 0 ? `Ver as ${total} emendas` : undefined}
        aoClicar={lista.carregarMais}
      />
    </>
  );
}
