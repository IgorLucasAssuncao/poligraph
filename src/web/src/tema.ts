/**
 * Claro, escuro ou o que o sistema disser.
 *
 * ## 🔴 Três estados, ⛔ não dois
 *
 * "Sistema" ⛔ não é o mesmo que "claro". É a ausência de escolha, e precisa continuar
 * seguindo o SO depois — quem alterna o tema do computador ao anoitecer espera que o
 * site acompanhe. Um interruptor de duas posições ⛔ não consegue representar isso: ele
 * congela a pessoa no valor que estava valendo quando ela clicou.
 *
 * ## Como chega ao CSS
 *
 * `sistema` ⛔ não carimba nada no elemento raiz — aí só `prefers-color-scheme` decide,
 * que é o comportamento correto. As outras duas carimbam `data-tema`, e o CSS as faz
 * vencer o sistema nos dois sentidos.
 */

export type Tema = 'sistema' | 'claro' | 'escuro';

const CHAVE = 'poligraph:tema';

export const TEMAS: Tema[] = ['claro', 'sistema', 'escuro'];

/** O rótulo de cada opção na tela. */
export const NOME_DO_TEMA: Record<Tema, string> = {
  claro: 'Claro',
  sistema: 'Sistema',
  escuro: 'Escuro',
};

/**
 * O tema guardado, ou `sistema`.
 *
 * ⚠️ `localStorage` estoura em janela anônima e com armazenamento bloqueado, e um tema
 * ⛔ não vale derrubar a aplicação: qualquer falha cai no padrão.
 */
export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE);

    return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
  } catch {
    return 'sistema';
  }
}

/** Carimba a escolha no elemento raiz e guarda. */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;

  // 🔴 `sistema` REMOVE o atributo. Carimbar `data-tema="sistema"` faria o seletor
  //    `:not([data-tema='claro'])` continuar valendo por acidente, e o dia em que
  //    alguém escrevesse `[data-tema]` como seletor genérico o padrão quebraria.
  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);

  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem armazenamento a escolha vale só nesta aba — melhor que não valer nada.
  }
}
