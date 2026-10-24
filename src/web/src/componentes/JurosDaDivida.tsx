import type { Governo } from '../api';
import { reaisCompacto } from '../formato';
import { governantesPorAno } from './governantes';
import { TEXTOS_DO_GOVERNO } from '../textos/governo';
import { ColunasPorAnoComponent } from './Graficos';
import { LinkDeFonteComponent } from './LinkDeFonte';
import { FONTES } from '../fontes';

const T = TEXTOS_DO_GOVERNO.divida;

/**
 * Os juros que o governo federal pagou da dívida, ano a ano, com a Selic do mesmo ano logo abaixo e quem governava no fundo.
 *
 * DECISÃO (autor, 2026-10-24): dois gráficos, um em reais e outro em porcentagem, com os anos alinhados. Um eixo duplo
 * desenharia uma relação que a escala escolhe; dois gráficos deixam comparar a tendência sem inventar proporção.
 *
 * RISCO: o juro pago não acompanha a Selic do ano. Parte da dívida tem juro fixo ou corrigido pela inflação, e o título paga
 * o juro quando vence. A frase da tela diz isso, e a página não calcula correlação.
 *
 * A tabela traz também a amortização, o refinanciamento (a rolagem) e o que o governo pegou emprestado no ano.
 */
export function JurosDaDividaComponent({ dados }: { dados: Governo }) {
  const divida = dados.divida ?? [];
  if (divida.length === 0) return null;

  const governantes = governantesPorAno(dados.gestoesDisponiveis, divida.map((d) => d.ano));
  const nota = (ano: number) => (ano === dados.emAndamento ? T.emAndamento : undefined);
  const notaDaSelic = (meses: number | null | undefined) => (meses && meses < 12 ? T.meses(meses) : undefined);
  const emprestado = new Map(dados.porAno.map((a) => [a.anoDoOrcamento, a.pegouEmprestado]));
  const comSelic = divida.filter((d) => d.selic != null);

  const tabela = (
    <div className="tabela-rolavel">
      <table className="tabela-orcamento">
        <caption className="sr-apenas">{T.legenda}</caption>
        <thead>
          <tr>
            {T.colunas.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {divida.map((d) => (
            <tr key={d.ano}>
              <th scope="row">
                {d.ano}
                {nota(d.ano) && <small className="ano-andamento">{nota(d.ano)}</small>}
              </th>
              <td className="coluna-gestao">{governantes.get(d.ano) ?? ''}</td>
              <td>{d.selic != null ? T.porcento(d.selic) : '—'}</td>
              <td>{reaisCompacto(d.jurosPagos)}</td>
              <td>{reaisCompacto(d.amortizacaoPaga)}</td>
              <td>{reaisCompacto(d.refinanciamentoPago)}</td>
              <td>{emprestado.has(d.ano) ? reaisCompacto(emprestado.get(d.ano) ?? 0) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <section className="governo-secao" aria-labelledby="divida-titulo">
      <h2 id="divida-titulo" className="titulo-secao">
        {T.titulo}
      </h2>
      <p className="ajuda">{T.ajuda}</p>

      <h3 className="subtitulo-grafico">{T.jurosTitulo}</h3>
      <ColunasPorAnoComponent
        rotulo={T.jurosRotulo}
        series={[T.juros]}
        anos={divida.map((d) => ({ ano: d.ano, valores: [d.jurosPagos], nota: nota(d.ano) }))}
        formatar={reaisCompacto}
        governantes={governantes}
        tabela={tabela}
      />

      {comSelic.length > 0 && (
        <>
          <h3 className="subtitulo-grafico">{T.selicTitulo}</h3>
          <ColunasPorAnoComponent
            rotulo={T.selicRotulo}
            series={[T.selic]}
            anos={comSelic.map((d) => ({ ano: d.ano, valores: [d.selic ?? 0], nota: notaDaSelic(d.mesesDaSelic) }))}
            formatar={T.porcento}
            governantes={governantes}
          />
        </>
      )}

      <p className="nota-curta" role="note">
        {T.ressalva}
      </p>
      <p className="nota-curta">
        {T.fontes}{' '}
        <LinkDeFonteComponent href={FONTES.orcamento.url}>{T.fonteOrcamento}</LinkDeFonteComponent> ·{' '}
        <LinkDeFonteComponent href={FONTES.selic.url}>{T.fonteSelic}</LinkDeFonteComponent>
      </p>
    </section>
  );
}
