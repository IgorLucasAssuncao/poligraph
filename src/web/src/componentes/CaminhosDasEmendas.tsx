import { obterCaminhosDasEmendas, type CaminhoDaEmenda, type Periodo } from '../api';
import { baixarCsv } from '../exportar';
import { reaisCompacto } from '../formato';
import { TEXTOS_DAS_EMENDAS } from '../textos/emendas';
import { BotaoBaixarCsvComponent } from './BotaoBaixarCsv';
import { EsqueletoDeTextoComponent } from './Esqueleto';
import { GraficoDeFitasComponent, type Fita, type NoDasFitas } from './GraficoDeFitas';
import { useCarga } from './useCarga';

const T = TEXTOS_DAS_EMENDAS.caminhos;

/** Quantas áreas ganham caixa própria; as outras se juntam numa só, que diz quantas são. */
const AREAS_A_VISTA = 7;
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

  const { nos, fitas } = montarFitas(lida.dados.caminhos);
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

function rotuloDoTipo(tipo: string | null): string {
  return tipo ? (T.tipos[tipo] ?? tipo) : T.semTipo;
}

/** As três colunas: tipo → área → quem recebeu. As áreas menores se juntam numa caixa, e cada coluna soma o mesmo total. */
function montarFitas(caminhos: CaminhoDaEmenda[]): { nos: NoDasFitas[]; fitas: Fita[] } {
  const porArea = new Map<string, number>();
  for (const c of caminhos) {
    const area = c.area ?? T.semArea;
    porArea.set(area, (porArea.get(area) ?? 0) + c.valor);
  }
  const areas = [...porArea.entries()].sort((a, b) => b[1] - a[1]);
  const aVista = new Set(areas.slice(0, AREAS_A_VISTA).map(([a]) => a));
  const outras = areas.length - aVista.size;
  const areaDe = (c: CaminhoDaEmenda) => {
    const area = c.area ?? T.semArea;
    return aVista.has(area) ? area : T.outrasAreas(outras);
  };

  const nos = new Map<string, NoDasFitas>();
  const somas = new Map<string, Fita>();
  const somar = (de: string, para: string, valor: number) => {
    const chave = `${de}→${para}`;
    const fita = somas.get(chave) ?? { de, para, valor: 0 };
    fita.valor += valor;
    somas.set(chave, fita);
  };

  for (const c of caminhos) {
    const tipo = `tipo:${c.tipo ?? ''}`;
    const area = `area:${areaDe(c)}`;
    const recebedor = `recebedor:${c.recebedor}`;
    nos.set(tipo, { id: tipo, rotulo: rotuloDoTipo(c.tipo), coluna: 0 });
    nos.set(area, { id: area, rotulo: areaDe(c), coluna: 1 });
    nos.set(recebedor, { id: recebedor, rotulo: T.recebedores[c.recebedor], coluna: 2 });
    somar(tipo, area, c.valor);
    somar(area, recebedor, c.valor);
  }

  return { nos: [...nos.values()], fitas: [...somas.values()] };
}
