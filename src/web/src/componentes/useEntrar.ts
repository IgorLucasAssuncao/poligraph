import { useLocation } from 'react-router-dom';

/**
 * O endereço de entrar que devolve a pessoa para onde ela estava.
 *
 * ⭐ A conta só é pedida quando a pessoa usa algo que precisa dela — seguir alguém, a
 * própria conta. Mandar para a página inicial depois do login a faria procurar de novo
 * quem ia seguir.
 */
export function useEntrar(): string {
  const { pathname, search } = useLocation();
  const aqui = pathname + search;

  return aqui.startsWith('/entrar') ? aqui : `/entrar?voltar=${encodeURIComponent(aqui)}`;
}

/** Só caminho interno: um `voltar` com outro domínio viraria redirecionamento aberto. */
export function destinoSeguro(voltar: string | null): string {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') ? voltar : '/';
}
