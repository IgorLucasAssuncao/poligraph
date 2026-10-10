import { useEffect, useState } from 'react';
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
  const chave = `${idPessoa}-${mandato}`;
  const [estado, setEstado] = useState<{ chave: string; contas: Contas | null; erro: boolean }>({
    chave,
    contas: null,
    erro: false,
  });

  useEffect(() => {
    if (mandato === 'aguardando') return;
    let vivo = true;

    void Promise.allSettled([
      obterGastos(idPessoa, mandato),
      obterEmendas(idPessoa, mandato),
      obterFinanciamento(idPessoa, mandato),
    ]).then(
      ([g, e, f]) => {
        if (!vivo) return;
        if (g.status === 'rejected' && e.status === 'rejected' && f.status === 'rejected') {
          setEstado({ chave, contas: null, erro: true });
          return;
        }
        setEstado({
          chave,
          erro: false,
          contas: {
            gastos: g.status === 'fulfilled' ? g.value : null,
            emendas: e.status === 'fulfilled' ? e.value : null,
            fin: f.status === 'fulfilled' ? f.value : null,
          },
        });
      },
    );

    return () => {
      vivo = false;
    };
  }, [idPessoa, mandato, chave]);

  if (estado.chave === chave) {
    return { ...estado, atualizando: false, chaveDasContas: estado.chave };
  }
  const anteriores = estado.chave.startsWith(`${idPessoa}-`) ? estado.contas : null;
  return { contas: anteriores, erro: false, atualizando: anteriores !== null, chaveDasContas: estado.chave };
}
