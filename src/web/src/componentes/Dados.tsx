import type { ReactNode } from 'react';
import { reais } from '../formato';

/**
 * Peças de apresentação de dado que se repetem pelo site: a linha com barra, o grupo de
 * opções e o número em destaque. Antes, cada tela escrevia o mesmo HTML à mão (2026-10-03).
 */

/**
 * Uma linha de lista com nome, barra proporcional e valor: categoria da cota, cidade da emenda,
 * fonte da campanha, área do orçamento.
 *
 * `minimo` é a largura mínima da barra, em %: sem ela, o menor item some ao lado do maior.
 */
export function LinhaDeValorComponent({
  nome,
  valor,
  maior,
  formatar = reais,
  minimo = 2,
}: {
  nome: ReactNode;
  valor: number;
  maior: number;
  formatar?: (valor: number) => string;
  minimo?: number;
}) {
  const largura = maior > 0 ? Math.max((Math.max(valor, 0) / maior) * 100, minimo) : 0;

  return (
    <li>
      <span className="gasto-nome">{nome}</span>
      <span className="gasto-barra">
        <span style={{ width: `${largura}%` }} />
      </span>
      <span className="gasto-valor">{formatar(valor)}</span>
    </li>
  );
}

/** Uma opção de {@link OpcoesComponent}. */
export type Opcao<T> = { valor: T; rotulo: ReactNode };

/**
 * Botões de escolha única, lado a lado: o ano da cota, a leitura do mapa, o período.
 *
 * Cada botão diz se está escolhido com `aria-pressed`, e o grupo tem nome para o leitor de tela.
 */
export function OpcoesComponent<T extends string | number | boolean | null>({
  rotulo,
  opcoes,
  escolhida,
  aoEscolher,
  children,
}: {
  rotulo: string;
  opcoes: Opcao<T>[];
  escolhida: T;
  aoEscolher: (valor: T) => void;
  /** O que vem depois dos botões, no mesmo grupo: um seletor de intervalo, uma nota. */
  children?: ReactNode;
}) {
  return (
    <div className="seletor-periodo-campos" role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          className={o.valor === escolhida ? 'ativo' : ''}
          aria-pressed={o.valor === escolhida}
          onClick={() => aoEscolher(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
      {children}
    </div>
  );
}

/** Um número em destaque, com o rótulo em cima e a definição embaixo. Vai dentro de `.numeros-do-ano`. */
export function NumeroComponent({
  rotulo,
  definicao,
  texto = false,
  children,
}: {
  rotulo: ReactNode;
  definicao?: ReactNode;
  /** Valor que é texto (uma cidade), e não número: fonte menor. */
  texto?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="numero-do-ano">
      <p className="numero-rotulo">{rotulo}</p>
      <p className={texto ? 'numero-valor numero-texto' : 'numero-valor'}>{children}</p>
      {definicao && <p className="numero-definicao">{definicao}</p>}
    </div>
  );
}
