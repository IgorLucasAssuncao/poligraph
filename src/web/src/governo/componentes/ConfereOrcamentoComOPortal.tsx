import { obterReconciliacao, type Periodo } from '../../nucleo/api';
import { reaisCompacto } from '../../nucleo/formato';
import { TEXTOS_DO_GOVERNO } from '../textos/governo';
import { useCarga } from '../../comum/componentes/useCarga';

const T = TEXTOS_DO_GOVERNO.conferencia;

/**
 * Quanto o pago do orçamento federal confere entre os dois arquivos do Portal que o publicam: os 12 mensais de execução e o
 * anual, que é o usado na página (regra 5).
 *
 * DECISÃO (autor, 2026-10-23): a diferença fica à vista em vez de só no log da carga. MEDIDO (2026-10-23): de 2014 a 2025, os
 * mensais passam o anual em R$ 7,77 bi em 2014 (0,37%) e ficam R$ 2,38 bi abaixo em 2022; nos outros anos, menos de R$ 1 bi.
 *
 * ATENÇÃO: Só ano fechado: o ano em andamento ainda não tem os 12 meses, e a carga não o compara.
 */
export function ConfereOrcamentoComOPortalComponent({ periodo }: { periodo: Periodo }) {
  const contas = useCarga(['reconciliacao', periodo.primeiroAno, periodo.ultimoAno], () => obterReconciliacao(periodo)).dados;
  const anos = (contas ?? [])
    .filter((c) => c.conjunto === 'GOVERNO_FEDERAL')
    .map((c) => ({ ano: c.anoDaFonte, anual: c.totalNaBase, diferenca: c.totalNaFonte - c.totalNaBase }));

  if (anos.length === 0) return null;

  const maior = anos.reduce((a, b) => (Math.abs(b.diferenca) > Math.abs(a.diferenca) ? b : a));
  const deCadaMil = (d: (typeof anos)[number]) => ((Math.abs(d.diferenca) / d.anual) * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return (
    <details className="confere-com-o-portal">
      <summary>
        <span className="confere-titulo">{T.titulo}</span>{' '}
        {T.resumo(reaisCompacto(Math.abs(maior.diferenca)), maior.ano, deCadaMil(maior))}{' '}
        <span className="confere-abrir">{T.verDetalhe}</span>
      </summary>
      <p>{T.explicacao}</p>
      <ul className="motivos-de-fora">
        {anos.map((d) => (
          <li key={d.ano}>
            <span>{T.ano(d.ano, reaisCompacto(d.anual))}</span>
            <span className="dado">{T.diferenca(d.diferenca, reaisCompacto(Math.abs(d.diferenca)))}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
