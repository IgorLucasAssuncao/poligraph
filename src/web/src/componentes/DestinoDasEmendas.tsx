import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type {
  ConveniosDaEmenda,
  FavorecidosDaEmenda,
  PagamentoPorMes,
} from '../api';
import { listarConvenios, listarEmendas, listarFavorecidos } from '../api';
import { anosDeCotaDaEmenda, dataCurta, mesCurto, mesesContinuos, nomeProprio, reais } from '../formato';
import { BotaoBaixarCsvComponent } from './BotaoBaixarCsv';
import { BotaoMostrarMaisComponent } from './BotaoMostrarMais';
import { baixarCsv, buscarTodas } from '../exportar';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { NENHUM, useAVista, usePaginas } from './usePaginas';
import { TEXTOS_DAS_CONTAS } from '../textos/contasDoParlamentar';

const T = TEXTOS_DAS_CONTAS.paraOndeFoi;

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
export function QuemRecebeuComponent({
  pessoaId,
  favorecidos,
  ano,
}: {
  pessoaId: number;
  favorecidos: FavorecidosDaEmenda;
  ano: number;
}) {
  const porPagina = favorecidos.maiores.length || 8;
  const lista = useAVista(
    usePaginas(favorecidos.maiores, favorecidos.identificados, porPagina, (pagina) =>
      listarFavorecidos(pessoaId, ano, pagina, porPagina),
    ),
  );

  if (favorecidos.recebido === 0) return null;

  const foraDaLista: [string, ReactNode, number][] = [
    ['intermediario', T.viaBanco, favorecidos.viaIntermediario],
    ['pessoas', T.aPessoas, favorecidos.aPessoas],
    ['sem', T.semIdentificacao, favorecidos.semIdentificacao],
  ];

  return (
    <>
      <h3 className="titulo-secao">{T.quemRecebeu}</h3>
      <p className="ajuda ajuda-espacada">
        {T.recebidos(reais(favorecidos.recebido), ano, favorecidos.ultimoMes ? mesCurto(favorecidos.ultimoMes) : null)}
      </p>

      <ul className="gastos-fornecedores lista-favorecidos">
        {lista.itens.map((f, i) => (
          <li key={`${i}-${f.nome}`}>
            <span className="gasto-nome">
              {f.cnpj ? <Link to={`/entidades/${f.cnpj}`}>{nomeProprio(f.nome)}</Link> : nomeProprio(f.nome)}
              <small>{[f.naturezaJuridica, lugar(f.municipio, f.uf)].filter(Boolean).join(' · ')}</small>
              {f.tambemNaCota != null && (
                <small className="tambem-na-cota">{T.tambemNaCota(reais(f.tambemNaCota), anosDeCotaDaEmenda(ano))}</small>
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
      <BotaoMostrarMaisComponent {...lista} aoClicar={lista.carregarMais} />
    </>
  );
}

function lugar(municipio: string | null, uf: string | null): string | null {
  if (municipio && uf) return `${nomeProprio(municipio)} – ${uf}`;
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
export function QuandoFoiPagoComponent({ meses, ano }: { meses: PagamentoPorMes[]; ano: number }) {
  const [emFoco, setEmFoco] = useState<PagamentoPorMes | null>(null);

  if (meses.length === 0) return null;

  const serie = mesesContinuos(meses);
  const total = serie.reduce((soma, m) => soma + m.valor, 0);
  const noAno = serie.filter((m) => m.mes.startsWith(`${ano}-`)).reduce((s, m) => s + m.valor, 0);
  const maior = Math.max(...serie.map((m) => m.valor), 1);
  const parcela = total > 0 ? Math.round((noAno / total) * 100) : 0;

  return (
    <>
      <h3 className="titulo-secao">{T.quandoFoiPago}</h3>
      <p className="ajuda ajuda-espacada">{T.noProprioAno(reais(noAno), reais(total), parcela, ano)}</p>

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
          <summary>{T.verTabela}</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">{T.mes}</th>
                <th scope="col">{T.pago}</th>
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
export function ConveniosComponent({
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
      <h3 className="titulo-secao">{T.convenios}</h3>
      <p className="ajuda ajuda-espacada">{T.conveniosFinanciados(convenios.quantidade)}</p>

      <ul className="lista-convenios">
        {lista.itens.map((c) => (
          <li key={c.numero}>
            <div className="convenio-cabeca">
              <strong>{c.convenente}</strong>
              <span className="gasto-valor">{reais(c.valor)}</span>
            </div>
            {c.objeto && <p className="convenio-objeto">{c.objeto}</p>}
            <p className="convenio-meta">
              {T.convenio(c.numero, dataCurta(c.dataPublicacao))}
              {c.emendasQueFinanciam > 1 && T.financiadoPor(c.emendasQueFinanciam)}
              {' · '}
              <LinkDeFonteComponent href={c.urlFonte}>{T.noPortal}</LinkDeFonteComponent>
            </p>
          </li>
        ))}
      </ul>
      <BotaoMostrarMaisComponent {...lista} aoClicar={lista.carregarMais} />
    </>
  );
}

/**
 * As emendas uma a uma, cada qual com o link no Portal — de onde toda soma acima se confere.
 *
 * DECISÃO: Fechadas até a pessoa pedir: quem só quer o resumo não precisa delas, e quem quer
 * conferir tem o caminho.
 */
export function EmendasUmaAUmaComponent({ pessoaId, ano, total }: { pessoaId: number; ano: number; total: number }) {
  const lista = usePaginas(NENHUM, total, 8, (pagina) => listarEmendas(pessoaId, ano, pagina, 8));

  return (
    <>
      <h3 className="titulo-secao">
        {T.emendaPorEmenda}{' '}
        <BotaoBaixarCsvComponent
          rotulo={T.baixarTodas}
          montar={async () => {
            const todas = await buscarTodas((pagina) => listarEmendas(pessoaId, ano, pagina, 50));
            baixarCsv(
              T.arquivo(pessoaId, ano),
              [...T.colunas],
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
                {e.localidade ?? T.semLocalidade}
                {e.localidades > 1 && T.eMais(e.localidades - 1)}
                <small>
                  {e.codigo} · {e.funcao ?? T.semFuncao} · {T.pagos(reais(e.pago))}
                </small>
              </span>
              <span className="lancamento-fim">
                <span className="gasto-valor">{reais(e.empenhado)}</span>
                <LinkDeFonteComponent href={e.urlFonte}>{T.noPortal}</LinkDeFonteComponent>
              </span>
            </li>
          ))}
        </ul>
      )}
      <BotaoMostrarMaisComponent
        {...lista}
        rotulo={lista.itens.length === 0 ? T.verTodas(total) : undefined}
        aoClicar={lista.carregarMais}
      />
    </>
  );
}
