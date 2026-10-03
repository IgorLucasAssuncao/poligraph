import { useEffect, useState } from 'react';
import { obterReconciliacao } from '../api';
import type { Periodo, Reconciliacao } from '../api';
import { reaisCompacto } from '../formato';

/**
 * Quanto o total de emendas do período confere com o Portal da Transparência (Pendência 81).
 *
 * DECISÃO do autor (2026-10-02): o orçamento tem de fechar, e o que não fecha precisa de
 * justificativa à vista. A ETL grava, por ano, o total do Portal, o da base e o que ficou fora
 * por motivo; o `conferir` garante que Portal = base + motivos.
 *
 * ATENÇÃO: Dois recortes. O empenhado é por ano da emenda, como o resto da página. Os
 * pagamentos sem código de emenda são por ano do pagamento: o Portal não diz de que emenda
 * eles são, então não cabem em nenhum período de emenda.
 */
export function ConfereComOPortalComponent({ periodo }: { periodo: Periodo }) {
  const [contas, setContas] = useState<Reconciliacao[] | null>(null);

  useEffect(() => {
    let atual = true;
    obterReconciliacao(periodo)
      .then((c) => atual && setContas(c))
      .catch(() => atual && setContas(null));
    return () => {
      atual = false;
    };
  }, [periodo]);

  if (!contas || contas.length === 0) return null;

  const empenhado = somar(contas.filter((c) => c.conjunto === 'EMENDAS' && c.medida === 'EMPENHADO'));
  const pagamentos = somar(contas.filter((c) => c.conjunto === 'PAGAMENTOS'));
  const semCodigo = pagamentos.motivos.get('PAGAMENTO_SEM_CODIGO_DE_EMENDA') ?? 0;
  const fora = empenhado.fonte - empenhado.base;
  const anos = periodo.de === periodo.ate ? `de ${periodo.de}` : `de ${periodo.de} a ${periodo.ate}`;

  return (
    <section className="confere-com-o-portal" aria-labelledby="titulo-confere">
      <h2 id="titulo-confere">Quanto confere com o Portal da Transparência</h2>

      {fora < 0.5 ? (
        <p>
          O empenhado nas emendas {anos} é o mesmo do Portal: <strong>{reaisCompacto(empenhado.base)}</strong>.
        </p>
      ) : (
        <>
          <p>
            O Portal publica <strong>{reaisCompacto(empenhado.fonte)}</strong> empenhados em emendas {anos}. Aqui
            estão <strong>{reaisCompacto(empenhado.base)}</strong>. Os outros {reaisCompacto(fora)} ficam de fora
            porque o Portal publica essas emendas sem dizer quem é o autor:
          </p>
          <ul className="motivos-de-fora">
            {[...empenhado.motivos.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([motivo, valor]) => (
                <li key={motivo}>
                  <span>{MOTIVO[motivo] ?? motivo}</span>
                  <span className="dado">{reaisCompacto(valor)}</span>
                </li>
              ))}
          </ul>
        </>
      )}

      {empenhado.inferido > 0.5 && (
        <p className="ajuda">
          Entre as que estão aqui, {reaisCompacto(empenhado.inferido)} são emendas de bancada que o Portal publica sem
          a bancada. A bancada foi deduzida pelo estado para onde o dinheiro foi, o que acerta em 97 de cada 100 casos
          em que o Portal diz a bancada.
        </p>
      )}

      {semCodigo > 0.5 && (
        <p className="ajuda">
          O Portal também registra {reaisCompacto(semCodigo)} em pagamentos feitos {anos} sem o número da emenda. Eles
          não entram no mapa, porque não dá para saber de que emenda são.
        </p>
      )}
    </section>
  );
}

const MOTIVO: Record<string, string> = {
  RELATOR_SEM_AUTOR: 'Emendas de relator',
  COMISSAO_SEM_AUTOR: 'Emendas de comissão, sem dizer qual comissão',
  BANCADA_SEM_AUTOR_E_SEM_UF: 'Emendas de bancada sem o estado',
  INDIVIDUAL_SEM_AUTOR: 'Emendas individuais sem o autor',
  OUTRA_SEM_AUTOR: 'Outras emendas sem autor',
  INCOERENTE: 'Linhas em que o código do autor não confere com o da emenda',
};

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
