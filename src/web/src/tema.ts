import { CHAVE_DO_TEMA, EVENTO_TEMA } from './constantes';
/**
 * Claro, escuro ou o que o sistema disser.
 *
 * ## RISCO: Três estados, não dois
 *
 * "Sistema" não é o mesmo que "claro". É a ausência de escolha, e precisa continuar
 * seguindo o SO depois — quem alterna o tema do computador ao anoitecer espera que o
 * site acompanhe. Um interruptor de duas posições não consegue representar isso: ele
 * congela a pessoa no valor que estava valendo quando ela clicou.
 *
 * ## Como chega ao CSS
 *
 * `sistema` não carimba nada no elemento raiz — aí só `prefers-color-scheme` decide,
 * que é o comportamento correto. As outras duas carimbam `data-tema`, e o CSS as faz
 * vencer o sistema nos dois sentidos.
 */

export type Tema = 'sistema' | 'claro' | 'escuro';


export const TEMAS: Tema[] = ['claro', 'sistema', 'escuro'];

/** O rótulo de cada opção na tela. */

/**
 * O tema guardado, ou `sistema`.
 *
 * ATENÇÃO: `localStorage` estoura em janela anônima e com armazenamento bloqueado, e um tema
 * não vale derrubar a aplicação: qualquer falha cai no padrão.
 */
export function temaGuardado(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE_DO_TEMA);

    return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
  } catch {
    return 'sistema';
  }
}

/**
 * Carimba a escolha no elemento raiz e guarda.
 *
 * RISCO: `sistema` REMOVE o atributo. Carimbar `data-tema="sistema"` faria o seletor
 * `:not([data-tema='claro'])` continuar valendo por acidente, e o dia em que
 * alguém escrevesse `[data-tema]` como seletor genérico o padrão quebraria.
 *
 * Sem armazenamento a escolha vale só nesta aba — melhor que não valer nada.
 */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;

  if (tema === 'sistema') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);

  window.dispatchEvent(new Event(EVENTO_TEMA));

  try {
    if (tema === 'sistema') localStorage.removeItem(CHAVE_DO_TEMA);
    else localStorage.setItem(CHAVE_DO_TEMA, tema);
  } catch {
  }
}


/**
 * Se a tela está escura AGORA, somando a escolha do botão e a do sistema.
 *
 * O CSS resolve isso sozinho pelos seletores; quem pinta em canvas não tem seletor, e
 * perguntar só ao `prefers-color-scheme` ignora o botão: com o sistema claro e o site em
 * escuro, o grafo saía com as cores do tema claro sobre a página escura.
 */
export function temaEfetivoEscuro(): boolean {
  const escolhido = document.documentElement.getAttribute('data-tema');
  if (escolhido === 'escuro') return true;
  if (escolhido === 'claro') return false;

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/**
 * Avisa quando o tema efetivo pode ter mudado: pelo botão do site ou pelo sistema.
 * Devolve a função que cancela a inscrição, no formato que o `useEffect` espera.
 */
export function aoMudarTema(aviso: () => void): () => void {
  const sistema = window.matchMedia?.('(prefers-color-scheme: dark)');

  window.addEventListener(EVENTO_TEMA, aviso);
  sistema?.addEventListener('change', aviso);

  return () => {
    window.removeEventListener(EVENTO_TEMA, aviso);
    sistema?.removeEventListener('change', aviso);
  };
}
