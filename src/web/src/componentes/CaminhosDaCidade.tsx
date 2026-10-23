import { obterCaminhosDaCidade, type CaminhoNaCidade, type Periodo } from '../api';
import { nomeDePessoa, reaisCompacto } from '../formato';
import { TEXTOS_DA_CIDADE } from '../textos/cidade';
import { TEXTOS_DAS_EMENDAS } from '../textos/emendas';
import { EsqueletoDeTextoComponent } from './Esqueleto';
import { GraficoDeFitasComponent } from './GraficoDeFitas';
import { montarColunas } from './colunasDasFitas';
import { useCarga } from './useCarga';

const T = TEXTOS_DA_CIDADE.caminhos;
const RECEBEDORES = TEXTOS_DAS_EMENDAS.caminhos.recebedores;

/** Quantos autores e quantas áreas ganham caixa própria; os outros se juntam numa caixa que diz quantos são. */
const AUTORES_A_VISTA = 7;
const AREAS_A_VISTA = 6;

/**
 * O que chegou de emenda a quem tem sede na cidade, em fitas: quem mandou, a área do gasto e quem recebeu.
 *
 * DECISÃO (autor, 2026-10-23): o mesmo gráfico das emendas, com quem mandou no lugar do tipo: na cidade, a pergunta é de
 * qual deputado ou bancada veio o dinheiro. O total é o mesmo do "quem mandou e quem recebeu", no mesmo período.
 */
export function CaminhosDaCidadeComponent({ codigoIbge, periodo }: { codigoIbge: string; periodo: Periodo | undefined }) {
  const lida = useCarga(['caminhos-da-cidade', codigoIbge, periodo?.primeiroAno ?? null, periodo?.ultimoAno ?? null], () =>
    obterCaminhosDaCidade(codigoIbge, periodo),
  );

  if (lida.erro) return <p className="erro">{T.erro}</p>;
  if (lida.dados === undefined) return <EsqueletoDeTextoComponent rotulo={T.carregando} />;
  if (!lida.dados || lida.dados.caminhos.length === 0) return null;

  const { nos, fitas } = montarColunas(lida.dados.caminhos, (c) => c.valor, [
    { chave: (c: CaminhoNaCidade) => c.quemMandou ?? '', rotulo: (nome) => (nome ? nomeDePessoa(nome) : T.semAutor), aVista: AUTORES_A_VISTA, resto: T.outrosAutores },
    { chave: (c: CaminhoNaCidade) => c.area ?? T.semArea, rotulo: (area) => area, aVista: AREAS_A_VISTA, resto: T.outrasAreas },
    { chave: (c: CaminhoNaCidade) => c.recebedor, rotulo: (r) => RECEBEDORES[r as CaminhoNaCidade['recebedor']] },
  ]);
  const total = reaisCompacto(lida.dados.total);

  return (
    <div className="caminhos-da-cidade">
      <p className="ajuda">{T.ajuda(total)}</p>
      <GraficoDeFitasComponent rotulo={T.rotulo(total)} colunas={T.colunas} nos={nos} fitas={fitas} formatar={reaisCompacto} altura={400} />
    </div>
  );
}
