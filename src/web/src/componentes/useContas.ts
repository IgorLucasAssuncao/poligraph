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
 * ⚠️ As três falhando juntas é problema de rede, ⛔ ausência de dado — `erro` diz isso, e
 * a tela ⛔ mostra três traços que mentiriam "não há registro".
 */
export function useContas(pessoaId: number): { contas: Contas | null; erro: boolean } {
  const [estado, setEstado] = useState<{ pessoaId: number; contas: Contas | null; erro: boolean }>({
    pessoaId,
    contas: null,
    erro: false,
  });

  useEffect(() => {
    let vivo = true;

    Promise.allSettled([obterGastos(pessoaId), obterEmendas(pessoaId), obterFinanciamento(pessoaId)]).then(
      ([g, e, f]) => {
        if (!vivo) return;
        if (g.status === 'rejected' && e.status === 'rejected' && f.status === 'rejected') {
          setEstado({ pessoaId, contas: null, erro: true });
          return;
        }
        setEstado({
          pessoaId,
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
  }, [pessoaId]);

  return estado.pessoaId === pessoaId ? estado : { contas: null, erro: false };
}
