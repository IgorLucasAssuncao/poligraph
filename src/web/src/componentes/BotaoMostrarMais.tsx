import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';
/**
 * "Mostrar mais N" — o botão de toda lista paginada.
 *
 * DECISÃO: Diz quantos vêm e quantos faltam: um "ver mais" sem número esconde se falta um
 * item ou quinhentos.
 */
export function BotaoMostrarMaisComponent({
  proximos,
  restantes,
  carregando,
  erro,
  aoClicar,
  rotulo,
}: {
  proximos: number;
  restantes: number;
  carregando: boolean;
  erro: boolean;
  aoClicar: () => void;
  /** Troca "Mostrar mais N" — para o primeiro clique de uma lista que começa fechada. */
  rotulo?: string;
}) {
  if (restantes === 0) return null;

  return (
    <div className="carregar-mais">
      <button type="button" className="botao-secundario" onClick={aoClicar} disabled={carregando}>
        {carregando ? T.mostrarMais.carregando : (rotulo ?? T.mostrarMais.rotulo(proximos))}
      </button>
      {!rotulo && <span className="carregar-mais-resto">{T.mostrarMais.restantes(restantes.toLocaleString('pt-BR'))}</span>}
      {erro && <p className="erro">{T.mostrarMais.erro}</p>}
    </div>
  );
}
