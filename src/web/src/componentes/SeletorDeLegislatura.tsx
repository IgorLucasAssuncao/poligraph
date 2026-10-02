import { periodoDaLegislatura } from '../formato';
import type { EscolhaDeLegislatura } from './useLegislatura';

/**
 * O seletor de período, igual em todo o site.
 *
 * ⭐ O período ("2019–2023") na frente do número: "56ª legislatura" ⛔ diz nada a quem
 * ⛔ acompanha o Congresso. O número vem depois, para quem procura por ele.
 *
 * ⭐ `<select>` e ⛔ botões: são até sete legislaturas, e sete botões tomariam a linha
 * dos outros filtros.
 */
export function SeletorDeLegislatura({
  opcoes,
  atual,
  aoTrocar,
  comTodas = false,
  rotulo = 'Período',
}: {
  /** Da mais recente para a mais antiga; a primeira é a corrente. */
  opcoes: number[];
  atual: number | 'todas';
  aoTrocar: (nova: EscolhaDeLegislatura) => void;
  /** "Todas", na lista: cada pessoa com o último mandato. */
  comTodas?: boolean;
  rotulo?: string;
}) {
  return (
    <label className="seletor-legislatura">
      <span>{rotulo}</span>
      <select
        value={String(atual)}
        onChange={(e) => {
          const valor = e.target.value;
          if (valor === 'todas') aoTrocar('todas');
          else aoTrocar(Number(valor) === opcoes[0] ? undefined : Number(valor));
        }}
      >
        {opcoes.map((l, i) => (
          <option key={l} value={l}>
            {periodoDaLegislatura(l)}
            {i === 0 ? ' (atual)' : ` · ${l}ª`}
          </option>
        ))}
        {comTodas && <option value="todas">Todos os períodos</option>}
      </select>
    </label>
  );
}
