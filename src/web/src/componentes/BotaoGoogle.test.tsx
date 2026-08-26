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

    expect(screen.getByText(/login desativado/i)).toBeDefined();
  });

  /**
   * 🔴 O contato com o servidor do Google só acontece para quem vai realmente entrar.
   * Carregar o script sempre significaria requisição a terceiro para todo visitante.
   */
  it('não carrega o script do Google', () => {
    render(<BotaoGoogle aoEntrar={vi.fn()} />);

    expect(document.getElementById('google-gsi')).toBeNull();
  });

  /** ⭐ O aviso diz o que fazer e deixa claro que o resto do site funciona. */
  it('explica o que falta e que o site segue utilizável', () => {
    const { container } = render(<BotaoGoogle aoEntrar={vi.fn()} />);

    expect(container.textContent).toMatch(/VITE_GOOGLE_CLIENT_ID/);
    expect(container.textContent).toMatch(/funcionam normalmente/i);
  });
});
