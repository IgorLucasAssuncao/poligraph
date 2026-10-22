import { createContext, useContext } from 'react';
import type { NomeDoTour, PassoDoTour } from '../tour';

/** O tour que a tela aberta oferece, com os passos montados a partir do dado dela. */
export type TourDaTela = { nome: Exclude<NomeDoTour, 'site'>; passos: PassoDoTour[] };

export type ContextoDoTour = {
  /** Sem nome, abre o tour do site. */
  iniciar: (nome?: NomeDoTour) => void;
  /** Anuncia o tour da tela; devolve a função que o retira ao sair dela. */
  registrar: (tela: TourDaTela) => () => void;
  /** O tour da tela aberta, se ela tem um: o menu de ajuda do cabeçalho o oferece. */
  daTela: TourDaTela['nome'] | null;
};

export const ContextoDoTour = createContext<ContextoDoTour>({
  iniciar: () => {},
  registrar: () => () => {},
  daTela: null,
});

/** Abre um tour de qualquer lugar da moldura, como o "?" do cabeçalho. */
export function useTour(): ContextoDoTour {
  return useContext(ContextoDoTour);
}
