import type { CaminhoDaEmenda } from '../api';
import { TEXTOS_DAS_EMENDAS } from '../textos/emendas';
import { montarColunas } from './colunasDasFitas';

const T = TEXTOS_DAS_EMENDAS.caminhos;

/** Quantas áreas ganham caixa própria; as outras se juntam numa só, que diz quantas são. */
const AREAS_A_VISTA = 7;

/** O tipo como o Portal escreve, encurtado para caber na coluna; sem tipo, a tela diz isso. */
export function rotuloDoTipo(tipo: string | null): string {
  return tipo ? (T.tipos[tipo] ?? tipo) : T.semTipo;
}

/**
 * As três colunas das emendas: tipo → área → quem recebeu. A página de emendas e a ficha do parlamentar usam as mesmas,
 * para o mesmo gráfico ler igual nas duas.
 */
export function fitasDasEmendas(caminhos: CaminhoDaEmenda[]) {
  return montarColunas(caminhos, (c) => c.valor, [
    { chave: (c) => c.tipo ?? '', rotulo: (tipo) => rotuloDoTipo(tipo || null) },
    { chave: (c) => c.area ?? T.semArea, rotulo: (area) => area, aVista: AREAS_A_VISTA, resto: T.outrasAreas },
    { chave: (c) => c.recebedor, rotulo: (r) => T.recebedores[r as CaminhoDaEmenda['recebedor']] },
  ]);
}
