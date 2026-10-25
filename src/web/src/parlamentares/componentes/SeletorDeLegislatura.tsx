import { periodoDaLegislatura } from '../../nucleo/formato';
import type { EscolhaDeLegislatura } from './useLegislatura';
import { TEXTOS_DOS_COMPONENTES as T } from '../../comum/textos/componentes';

/**
 * O seletor de período, igual em todo o site.
 *
 * DECISÃO: Só o período ("2019–2023"): "56ª legislatura" Não diz nada a quem não acompanha o
 * Congresso. O número fica no `title`, para quem procura por ele — na opção, ele
 * dobrava a largura da pílula sem ajudar a escolher.
 *
 * DECISÃO: `<select>` e não botões: são até sete legislaturas, e sete botões tomariam a linha
 * dos outros filtros.
 */
export function SeletorDeLegislaturaComponent({
  opcoes,
  atual,
  aoTrocar,
  comTodas = false,
  rotulo = T.legislatura.rotulo,
  rotuloVisivel = true,
}: {
  /** Da mais recente para a mais antiga; a primeira é a corrente. */
  opcoes: number[];
  atual: number | 'todas';
  aoTrocar: (nova: EscolhaDeLegislatura) => void;
  /** "Todas", na lista: cada pessoa com o último mandato. */
  comTodas?: boolean;
  rotulo?: string;
  /** Falso quando o texto ao lado já nomeia a escolha: o rótulo fica para o leitor de tela. */
  rotuloVisivel?: boolean;
}) {
  return (
    <label className="seletor-legislatura">
      <span className={rotuloVisivel ? undefined : 'so-leitor'}>{rotulo}</span>
      <select
        value={String(atual)}
        title={atual === 'todas' ? T.legislatura.todos : T.legislatura.numero(atual)}
        onChange={(e) => {
          const valor = e.target.value;
          if (valor === 'todas') aoTrocar('todas');
          else aoTrocar(Number(valor) === opcoes[0] ? undefined : Number(valor));
        }}
      >
        {opcoes.map((l, i) => (
          <option key={l} value={l}>
            {periodoDaLegislatura(l)}
            {i === 0 ? T.legislatura.atual : ''}
          </option>
        ))}
        {comTodas && <option value="todas">{T.legislatura.todos}</option>}
      </select>
    </label>
  );
}
