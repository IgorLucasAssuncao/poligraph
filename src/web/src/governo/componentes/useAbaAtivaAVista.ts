import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Rola a barra de abas até a aba do endereço, quando ela não cabe na tela (no celular, "Governo federal" ficava escondida à
 * direita). Só a barra rola; a página fica onde está.
 */
export function useAbaAtivaAVista<E extends HTMLElement>() {
  const barra = useRef<E>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const nav = barra.current;
    const ativa = nav?.querySelector<HTMLElement>('.active');
    if (!nav || !ativa) return;
    const sobra = ativa.getBoundingClientRect().right - nav.getBoundingClientRect().right;
    if (sobra > 0) nav.scrollLeft += sobra + 24;
  }, [pathname]);

  return barra;
}
