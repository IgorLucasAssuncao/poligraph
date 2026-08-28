import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotaoGoogle } from './BotaoGoogle';

/**
 * Cenário de quem clona o repositório e roda sem configurar nada.
 *
 * ⚠️ A variável é apagada explicitamente: o `.env.local` da máquina de quem roda o
 * teste pode ter um valor, e um teste que depende de arquivo local não é teste.
 */
describe('BotaoGoogle sem Client ID configurado', () => {
  beforeEach(() => vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ''));
  afterEach(() => vi.unstubAllEnvs());

  it('não quebra a aplicação', () => {
    render(<BotaoGoogle aoEntrar={vi.fn()} />);

    expect(screen.getByText(/login indisponível/i)).toBeDefined();
  });

  /**
   * 🔴 O contato com o servidor do Google só acontece para quem vai realmente entrar.
   * Carregar o script sempre significaria requisição a terceiro para todo visitante.
   */
  it('não carrega o script do Google', () => {
    render(<BotaoGoogle aoEntrar={vi.fn()} />);

    expect(document.getElementById('google-gsi')).toBeNull();
  });

  /**
   * 🔴 O aviso diz o que falta e QUAL é a consequência real.
   *
   * ⚠️ Ele afirmava que "o questionário e as fichas funcionam normalmente" — e este
   * teste travava essa frase. Era falso desde 26/08/2026, quando o login virou
   * obrigatório: sem Client ID ⛔ não há como entrar, e ⛔ não há site. Um teste verde
   * sobre uma afirmação errada é pior que teste nenhum, porque dá confiança nela.
   */
  it('explica o que falta e que sem isso não há acesso', () => {
    const { container } = render(<BotaoGoogle aoEntrar={vi.fn()} />);

    expect(container.textContent).toMatch(/VITE_GOOGLE_CLIENT_ID/);
    expect(container.textContent).toMatch(/exige conta/i);
    expect(container.textContent).not.toMatch(/funcionam normalmente/i);
  });
});
