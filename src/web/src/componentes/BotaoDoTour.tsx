import { useEffect } from 'react';
import { useTour, type TourDaTela } from './contextoDoTour';
import { TEXTOS_DOS_COMPONENTES as T } from '../textos/componentes';

/**
 * "Entenda esta tela": anuncia o tour da tela ao provedor e o abre quando clicado.
 *
 * Anunciar é o que permite a oferta do primeiro acesso: o provedor só sabe que o grafo
 * tem tour enquanto o botão dele está montado. `passos` precisa vir memorizado, senão
 * cada desenho da tela anunciaria de novo.
 */
export function BotaoDoTourComponent({ nome, passos }: TourDaTela) {
  const { iniciar, registrar } = useTour();

  useEffect(() => registrar({ nome, passos }), [registrar, nome, passos]);

  return (
    <button type="button" className="botao-tour" onClick={() => iniciar(nome)}>
      <span aria-hidden="true">?</span>
      {T.entendaEstaTela}
    </button>
  );
}
