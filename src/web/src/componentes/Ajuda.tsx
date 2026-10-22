import { useEffect, useId, useRef, useState } from 'react';
import { APRESENTACAO_DO_TOUR } from '../tour';
import { TEXTOS_DO_SITE as T } from '../textos/site';
import { useTour } from './contextoDoTour';

/**
 * O "?" do cabeçalho, ao lado da auditoria: a ajuda num lugar só (decisão do autor, 2026-10-22).
 *
 * Na tela que tem tour, abre um menu com dois caminhos: como ler esta tela e como o site funciona.
 * Nas outras, abre direto o do site: um menu de uma opção só seria um clique a mais.
 *
 * O menu fecha com Esc, com clique fora e ao escolher; o foco volta ao botão, como num menu nativo.
 */
export function AjudaComponent() {
  const { iniciar, daTela } = useTour();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    };
    document.addEventListener('mousedown', aoClicarFora);
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('mousedown', aoClicarFora);
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [aberto]);

  const abrir = (nome?: Parameters<typeof iniciar>[0]) => {
    setAberto(false);
    iniciar(nome);
  };

  return (
    <div className="ajuda-cabecalho" ref={caixa}>
      <button
        ref={botao}
        type="button"
        className="botao-ajuda botao-icone"
        aria-label={daTela ? T.ajuda.rotuloComTela : T.ajuda.rotulo}
        title={daTela ? T.ajuda.rotuloComTela : T.ajuda.rotulo}
        aria-haspopup={daTela ? 'menu' : undefined}
        aria-expanded={daTela ? aberto : undefined}
        aria-controls={daTela && aberto ? id : undefined}
        onClick={() => (daTela ? setAberto((a) => !a) : abrir())}
      >
        <span aria-hidden="true">?</span>
      </button>

      {aberto && daTela && (
        <div className="menu-ajuda" id={id} role="menu">
          <button type="button" role="menuitem" autoFocus onClick={() => abrir(daTela)}>
            <strong>{APRESENTACAO_DO_TOUR[daTela].titulo}</strong>
            <small>{APRESENTACAO_DO_TOUR[daTela].texto}</small>
          </button>
          <button type="button" role="menuitem" onClick={() => abrir('site')}>
            <strong>{APRESENTACAO_DO_TOUR.site.titulo}</strong>
            <small>{APRESENTACAO_DO_TOUR.site.texto}</small>
          </button>
        </div>
      )}
    </div>
  );
}
