import { useCarga } from './Atualizando';
import {
  obterEmendas,
  obterFinanciamento,
  obterGastos,
  type EmendasDoParlamentar,
  type FinanciamentoDeCampanha,
  type GastoDeCota,
} from '../api';

export type Contas = {
  gastos: GastoDeCota | null;
  emendas: EmendasDoParlamentar | null;
  fin: FinanciamentoDeCampanha | null;
};

/**
 * As três contas, carregadas juntas uma vez: a faixa do topo e as abas leem daqui.
 *
 * ATENÇÃO: As três falhando juntas é problema de rede, não ausência de dado — `erro` diz isso, e
 * a tela não mostra três traços que mentiriam "não há registro".
 */
/**
 * DECISÃO: `mandato` é a legislatura que a ficha mostra: cota, emendas e campanha saem de
 * DENTRO dela. Eram "o mais recente que existir", e a ficha de 2015–2019 mostrava os votos
 * de 2015 ao lado da cota de 2026 (2026-10-02). `'aguardando'` enquanto a ficha não chegou:
 * buscar antes traria o período errado e buscaria duas vezes.
 *
 * DECISÃO (2026-10-10): ao trocar de legislatura, as contas da anterior ficam na tela até as novas
 * chegarem, em vez de a ficha voltar ao esqueleto.
 */
export function useContas(
  idPessoa: number,
  mandato: number | null | 'aguardando' = null,
): { contas: Contas | null; erro: boolean; atualizando: boolean; chaveDasContas: string } {
  const carga = useCarga(['contas', idPessoa, mandato], () => lerContas(idPessoa, mandato === 'aguardando' ? null : mandato), {
    ativo: mandato !== 'aguardando',
    manter: 2,
  });
  return {
    contas: carga.dados ?? null,
    erro: carga.erro,
    atualizando: carga.atualizando,
    chaveDasContas: carga.chaveDoDado ?? '',
  };
}

/** As três juntas; só falha quando as três falham, que é problema de rede e não falta de dado. */
async function lerContas(idPessoa: number, mandato: number | null): Promise<Contas> {
  const [g, e, f] = await Promise.allSettled([
    obterGastos(idPessoa, mandato),
    obterEmendas(idPessoa, mandato),
    obterFinanciamento(idPessoa, mandato),
  ]);
  if (g.status === 'rejected' && e.status === 'rejected' && f.status === 'rejected') {
    throw g.reason;
  }
  return {
    gastos: g.status === 'fulfilled' ? g.value : null,
    emendas: e.status === 'fulfilled' ? e.value : null,
    fin: f.status === 'fulfilled' ? f.value : null,
  };
}
