import type { ReactNode } from 'react';
import type { Periodo } from '../api';

/**
 * "Todos os anos" ou um intervalo, de uma vez — ⛔ um ano por clique.
 *
 * ⭐ O mesmo controle no mapa das emendas e no governo: ir de ano em ano obrigava a somar
 * de cabeça, e cada página com o seu jeito de escolher o ano obrigava a reaprender.
 *
 * ⚠️ O ano corrente vem marcado: ainda está sendo pago, e somado aos fechados pareceria
 * menor do que vai ser.
 */
export function SeletorDePeriodo({
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
  const corrente = new Date().getFullYear();
  const rotuloDoAno = (a: number) => (a === corrente ? `${a} (em andamento)` : String(a));

  return (
    <div className="governo-barra seletor-periodo" data-tour={tour}>
      {children && <p className="governo-escopo">{children}</p>}
      <div className="seletor-periodo-campos" role="group" aria-label={rotulo}>
        <button type="button" className={todos ? 'ativo' : ''} aria-pressed={todos} onClick={() => aoMudar(null)}>
          Todos os anos
        </button>
        {atalhos.map((a) => {
          const ativo = a.periodo.de === periodo.de && a.periodo.ate === periodo.ate;
          return (
            <button key={a.rotulo} type="button" className={ativo ? 'ativo' : ''} aria-pressed={ativo} onClick={() => aoMudar(a.periodo)}>
              {a.rotulo}
            </button>
          );
        })}
        <label>
          De{' '}
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
          até{' '}
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
      </div>
    </div>
  );
}
