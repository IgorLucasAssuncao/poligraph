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

/** Uma aba de {@link AbasComponent}. */
export type Aba<T> = { chave: T; rotulo: string; contagem?: number; /** O alvo do tour, quando a aba é um passo dele. */ tour?: string };

/**
 * Abas dentro de uma seção: uma lista por vez, com o nome e o tamanho de cada uma no topo.
 *
 * DECISÃO (2026-10-03, pedido do autor): o painel da cidade empilhava quatro listas longas, e os
 * títulos se perdiam no meio delas. A aba vira o título, e a contagem diz o tamanho antes do clique.
 */
export function AbasComponent<T extends string>({
  rotulo,
  abas,
  escolhida,
  aoEscolher,
}: {
  rotulo: string;
  abas: Aba<T>[];
  escolhida: T;
  aoEscolher: (chave: T) => void;
}) {
  return (
    <div className="abas abas-internas" role="tablist" aria-label={rotulo}>
      {abas.map((a) => (
        <button
          key={a.chave}
          type="button"
          role="tab"
          id={`aba-${a.chave}`}
          aria-selected={a.chave === escolhida}
          aria-controls={`painel-${a.chave}`}
          className={`aba${a.chave === escolhida ? ' aba-ativa' : ''}`}
          data-tour={a.tour}
          onClick={() => aoEscolher(a.chave)}
        >
          {a.rotulo}
          {a.contagem !== undefined && <span className="aba-contagem">{a.contagem.toLocaleString('pt-BR')}</span>}
        </button>
      ))}
    </div>
  );
}
