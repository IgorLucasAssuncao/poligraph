import type { ReactNode } from 'react';
import type { Periodo } from '../api';
import { OpcoesComponent } from './Dados';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/** O valor do botão "Todos os anos" no grupo de opções. */
const TODOS = '__todos__';

/**
 * "Todos os anos" ou um intervalo, de uma vez — não um ano por clique.
 *
 * DECISÃO: O mesmo controle no mapa das emendas e no governo: ir de ano em ano obrigava a somar
 * de cabeça, e cada página com o seu jeito de escolher o ano obrigava a reaprender.
 *
 * ATENÇÃO: O ano corrente vem marcado: ainda está sendo pago, e somado aos fechados pareceria
 * menor do que vai ser.
 */
export function SeletorDePeriodoComponent({
  anos,
  periodo,
  rotulo,
  tour,
  children,
  atalhos = [],
  aoMudar,
}: {
  anos: number[];
  periodo: Periodo;
  /** Nome do grupo para o leitor de tela: "Período das emendas". */
  rotulo: string;
  tour?: string;
  /** A frase que diz o que o período está mostrando. */
  children?: ReactNode;
  /** Recortes com nome, lado a lado com "Todos os anos": no governo, uma gestão por botão. */
  atalhos?: { rotulo: string; periodo: Periodo }[];
  aoMudar: (novo: Periodo | null) => void;
}) {
  const todos = periodo.de === anos[0] && periodo.ate === anos[anos.length - 1];
  const escolhido = todos
    ? TODOS
    : (atalhos.find((a) => a.periodo.de === periodo.de && a.periodo.ate === periodo.ate)?.rotulo ?? '');
  const corrente = new Date().getFullYear();
  const rotuloDoAno = (a: number) => (a === corrente ? T.periodo.emAndamento(a) : String(a));

  return (
    <div className="governo-barra seletor-periodo" data-tour={tour}>
      {children && <p className="governo-escopo">{children}</p>}
      <OpcoesComponent
        rotulo={rotulo}
        opcoes={[{ valor: TODOS, rotulo: T.periodo.todosOsAnos }, ...atalhos.map((a) => ({ valor: a.rotulo, rotulo: a.rotulo }))]}
        escolhida={escolhido}
        aoEscolher={(valor) => aoMudar(valor === TODOS ? null : (atalhos.find((a) => a.rotulo === valor)?.periodo ?? null))}
      >
        <span className="seletor-periodo-intervalo">
          <label>
            {T.periodo.de}{' '}
            <select
              value={periodo.de}
              onChange={(e) => {
                const novo = Number(e.target.value);
                aoMudar({ de: novo, ate: Math.max(novo, periodo.ate) });
              }}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {rotuloDoAno(a)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {T.periodo.ate}{' '}
            <select
              value={periodo.ate}
              onChange={(e) => {
                const novo = Number(e.target.value);
                aoMudar({ de: Math.min(periodo.de, novo), ate: novo });
              }}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {rotuloDoAno(a)}
                </option>
              ))}
            </select>
          </label>
        </span>
      </OpcoesComponent>
    </div>
  );
}
