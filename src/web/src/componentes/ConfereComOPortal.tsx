import { useCarga } from './useCarga';
import { obterReconciliacao } from '../api';
import type { Periodo, Reconciliacao } from '../api';
import { reaisCompacto } from '../formato';
import { TEXTOS_DAS_EMENDAS } from '../textos/emendas';

const T = TEXTOS_DAS_EMENDAS.conferencia;

/**
 * Quanto o total de emendas do período confere com o Portal da Transparência (Pendência 81).
 *
 * DECISÃO do autor (2026-10-02): o orçamento tem de fechar, e o que não fecha precisa de
 * justificativa à vista. A ETL grava, por ano, o total do Portal, o da base e o que ficou fora
 * por motivo; o `conferir` garante que Portal = base + motivos.
 *
 * RISCO: o pago do arquivo de emendas e o recebido do arquivo de pagamentos não batem, e a ficha
 * mostra os dois. O conjunto `PAGO_X_RECEBIDO` diz quanto, nas duas direções.
 *
 * ATENÇÃO: Dois recortes. O empenhado é por ano da emenda, como o resto da página. Os
 * pagamentos sem código de emenda são por ano do pagamento: o Portal não diz de que emenda
 * eles são, então não cabem em nenhum período de emenda.
 */
/**
 * DECISÃO (2026-10-03, pedido do autor para encurtar a página): recolhido numa linha que já diz
 * quanto fica de fora. O detalhe, com o motivo de cada parte, fica a um clique.
 */
export function ConfereComOPortalComponent({ periodo }: { periodo: Periodo }) {
  const contas = useCarga(['reconciliacao', periodo.primeiroAno, periodo.ultimoAno], () => obterReconciliacao(periodo)).dados;

  if (!contas || contas.length === 0) return null;

  const empenhado = somar(contas.filter((c) => c.conjunto === 'EMENDAS' && c.medida === 'EMPENHADO'));
  const pagamentos = somar(contas.filter((c) => c.conjunto === 'PAGAMENTOS'));
  const semCodigo = pagamentos.motivos.get('PAGAMENTO_SEM_CODIGO_DE_EMENDA') ?? 0;
  const cruzamento = somar(contas.filter((c) => c.conjunto === 'PAGO_X_RECEBIDO'));
  const semRecebedor = cruzamento.motivos.get('PAGO_SEM_RECEBEDOR') ?? 0;
  const acimaDoPago = -(cruzamento.motivos.get('RECEBIDO_ACIMA_DO_PAGO') ?? 0);
  const fora = empenhado.fonte - empenhado.base;
  const anos = T.anos(periodo.primeiroAno, periodo.ultimoAno);

  return (
    <details className="confere-com-o-portal">
      <summary>
        <span className="confere-titulo">{T.titulo}</span>{' '}
        {fora < 0.5 ? T.resumoIgual(anos, reaisCompacto(empenhado.base)) : T.resumoFora(reaisCompacto(fora))}{' '}
        <span className="confere-abrir">{T.verDetalhe}</span>
      </summary>

      {fora < 0.5 ? (
        <p>{T.igual(anos, reaisCompacto(empenhado.base))}</p>
      ) : (
        <>
          <p>{T.fora(reaisCompacto(empenhado.fonte), anos, reaisCompacto(empenhado.base), reaisCompacto(fora))}</p>
          <ul className="motivos-de-fora">
            {[...empenhado.motivos.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([motivo, valor]) => (
                <li key={motivo}>
                  <span>{T.motivos[motivo] ?? motivo}</span>
                  <span className="dado">{reaisCompacto(valor)}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      {empenhado.inferido > 0.5 && (
        <p className="ajuda">{T.inferido(reaisCompacto(empenhado.inferido))}</p>
      )}

      {semCodigo > 0.5 && (
        <p className="ajuda">{T.semCodigo(reaisCompacto(semCodigo), anos)}</p>
      )}

      {(semRecebedor > 0.5 || acimaDoPago > 0.5) && (
        <p className="ajuda">{T.pagoXRecebido(anos, reaisCompacto(semRecebedor), reaisCompacto(acimaDoPago))}</p>
      )}
    </details>
  );
}

/** Soma os anos do período; os motivos, por nome. */
function somar(contas: Reconciliacao[]) {
  const motivos = new Map<string, number>();
  for (const c of contas) {
    for (const m of c.motivos) motivos.set(m.motivo, (motivos.get(m.motivo) ?? 0) + m.valor);
  }
  return {
    fonte: contas.reduce((s, c) => s + c.totalNaFonte, 0),
    base: contas.reduce((s, c) => s + c.totalNaBase, 0),
    inferido: contas.reduce((s, c) => s + c.totalInferido, 0),
    motivos,
  };
}
