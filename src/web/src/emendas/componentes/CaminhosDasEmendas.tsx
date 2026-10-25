import { obterCaminhosDasEmendas, type Periodo } from '../../nucleo/api';
import { baixarCsv } from '../../nucleo/exportar';
import { reaisCompacto } from '../../nucleo/formato';
import { TEXTOS_DAS_EMENDAS } from '../textos/emendas';
import { BotaoBaixarCsvComponent } from '../../comum/componentes/BotaoBaixarCsv';
import { EsqueletoDeTextoComponent } from '../../comum/componentes/Esqueleto';
import { GraficoDeFitasComponent } from '../../comum/componentes/GraficoDeFitas';
import { fitasDasEmendas, rotuloDoTipo } from './fitasDasEmendas';
import { useCarga } from '../../comum/componentes/useCarga';

const T = TEXTOS_DAS_EMENDAS.caminhos;

/** Quantos caminhos a tabela mostra; o arquivo leva todos. */
const CAMINHOS_NA_TABELA = 20;

/**
 * O pago em emendas do período pelos caminhos do dinheiro, em fitas: tipo da emenda, área do gasto e quem recebeu.
 *
 * DECISÃO (autor, 2026-10-23): o primeiro gráfico de fitas do site, nas emendas, porque aqui a ligação existe pagamento a
 * pagamento. As três colunas somam o mesmo total, que é o "pago em emendas" do mapa.
 */
export function CaminhosDasEmendasComponent({ periodo, textoDoPeriodo }: { periodo: Periodo | undefined; textoDoPeriodo: string }) {
  const lida = useCarga(['caminhos-das-emendas', periodo?.primeiroAno ?? null, periodo?.ultimoAno ?? null], () =>
    obterCaminhosDasEmendas(periodo),
  );

  if (lida.erro) return <p className="erro">{T.erro}</p>;
  if (!lida.dados) return <EsqueletoDeTextoComponent rotulo={T.carregando} />;
  if (lida.dados.caminhos.length === 0) return null;

  const { nos, fitas } = fitasDasEmendas(lida.dados.caminhos);
  const total = reaisCompacto(lida.dados.total);
  const ordenados = [...lida.dados.caminhos].sort((a, b) => b.valor - a.valor);

  return (
    <section className="governo-secao caminhos-das-emendas" aria-labelledby="caminhos-titulo">
      <h2 id="caminhos-titulo" className="titulo-secao">
        {T.titulo}
      </h2>
      <p className="ajuda">{T.ajuda}</p>
      <p className="nota-curta">{T.total(total, textoDoPeriodo)}</p>

      <GraficoDeFitasComponent
        rotulo={T.rotulo(total, textoDoPeriodo)}
        colunas={T.colunas}
        nos={nos}
        fitas={fitas}
        formatar={reaisCompacto}
      />

      <details className="grafico-tabela">
        <summary>{T.verTabela}</summary>
        <table>
          <thead>
            <tr>
              {T.cabecalho.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenados.slice(0, CAMINHOS_NA_TABELA).map((c, i) => (
              <tr key={i}>
                <td>{rotuloDoTipo(c.tipo)}</td>
                <td>{c.area ?? T.semArea}</td>
                <td>{T.recebedores[c.recebedor]}</td>
                <td>{reaisCompacto(c.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ordenados.length > CAMINHOS_NA_TABELA && <p className="nota-curta">{T.maisNoCsv(ordenados.length - CAMINHOS_NA_TABELA)}</p>}
        <BotaoBaixarCsvComponent
          montar={() =>
            baixarCsv(
              T.arquivo(textoDoPeriodo.replace(/\s+/g, '-')),
              [...T.cabecalho],
              ordenados.map((c) => [c.tipo ?? '', c.area ?? '', T.recebedores[c.recebedor], c.valor]),
            )
          }
        />
      </details>
    </section>
  );
}
