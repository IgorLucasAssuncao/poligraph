import { useEffect } from 'react';
import { useTour, type TourDaTela } from './contextoDoTour';

/**
 * Anuncia o tour da tela ao provedor, sem desenhar nada: quem o abre é o "?" do cabeçalho (`AjudaComponent`).
 *
 * Era o botão "Entenda esta tela" de cada página. DECISÃO (autor, 2026-10-22): a ajuda mora num lugar só,
 * ao lado da auditoria, e nenhuma página oferece tour sozinha. `passos` precisa vir memorizado, senão cada
 * desenho da tela anunciaria de novo.
 */
export function TourDaTelaComponent({ nome, passos }: TourDaTela) {
  const { registrar } = useTour();

  useEffect(() => registrar({ nome, passos }), [registrar, nome, passos]);

  return null;
}
