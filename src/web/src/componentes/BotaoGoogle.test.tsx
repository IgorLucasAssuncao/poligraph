import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotaoGoogleComponent } from './BotaoGoogle';

/**
 * Cenário de quem clona o repositório e roda sem configurar nada.
 *
 * ATENÇÃO: A variável é apagada explicitamente: o `.env.local` da máquina de quem roda o
 * teste pode ter um valor, e um teste que depende de arquivo local não é teste.
 *
 * RISCO: O contato com o servidor do Google só acontece para quem vai realmente entrar.
 * Carregar o script sempre significaria requisição a terceiro para todo visitante.
 *
 * RISCO: O aviso diz o que falta e QUAL é a consequência real.
 *
 * ATENÇÃO: Ele afirmava que "o questionário e as fichas funcionam normalmente" — e este
 * teste travava essa frase. Era falso desde 26/08/2026, quando o login virou
 * obrigatório: sem Client ID não há como entrar, e não há site. Um teste verde
 * sobre uma afirmação errada é pior que teste nenhum, porque dá confiança nela.
 */
describe('BotaoGoogle sem Client ID configurado', () => {
  beforeEach(() => vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ''));
  afterEach(() => vi.unstubAllEnvs());

  it('não quebra a aplicação', () => {
    render(<BotaoGoogleComponent aoEntrar={vi.fn()} />);

    expect(screen.getByText(/login indisponível/i)).toBeDefined();
  });

  it('não carrega o script do Google', () => {
    render(<BotaoGoogleComponent aoEntrar={vi.fn()} />);

    expect(document.getElementById('google-gsi')).toBeNull();
  });

  it('explica o que falta e que só a entrada fica indisponível', () => {
    const { container } = render(<BotaoGoogleComponent aoEntrar={vi.fn()} />);

    expect(container.textContent).toMatch(/VITE_GOOGLE_CLIENT_ID/);
    expect(container.textContent).toMatch(/não há como entrar/i);
    expect(container.textContent).toMatch(/o resto do site funciona/i);
  });
});

describe('BotaoGoogle com Client ID', () => {
  /** O callback que o botão registra no Google, para o teste chamar como se o Google respondesse. */
  let callback: ((resposta: { credential: string }) => void) | undefined;

  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'cliente.apps.googleusercontent.com');
    callback = undefined;
    window.google = {
      accounts: {
        id: {
          initialize: (config) => {
            callback = config.callback;
          },
          renderButton: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    document.getElementById('google-gsi')?.remove();
    delete window.google;
  });

  /** Põe o script como já carregado: o botão não pede de novo. */
  function scriptJaCarregado() {
    const script = document.createElement('script');
    script.id = 'google-gsi';
    document.head.appendChild(script);
  }

  it('entra com o token do Google e avisa quem pediu', async () => {
    scriptJaCarregado();
    const fetchSimulado = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ nome: 'Fulana', fotoUrl: null })));
    vi.stubGlobal('fetch', fetchSimulado);
    const aoEntrar = vi.fn();

    render(<BotaoGoogleComponent aoEntrar={aoEntrar} />);
    await waitFor(() => expect(callback).toBeDefined());
    await act(async () => callback!({ credential: 'token' }));

    expect(aoEntrar).toHaveBeenCalledWith({ nome: 'Fulana', fotoUrl: null });
    const [url, opcoes] = fetchSimulado.mock.calls[0];
    expect(url).toBe('/api/auth/google');
    expect(opcoes?.headers).toMatchObject({ 'X-Requested-With': 'poligraph' });
  });

  it('a recusa do servidor vira erro na tela', async () => {
    scriptJaCarregado();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 401 })));

    render(<BotaoGoogleComponent aoEntrar={vi.fn()} />);
    await waitFor(() => expect(callback).toBeDefined());
    await act(async () => callback!({ credential: 'token' }));

    expect(screen.getByRole('alert').textContent).toMatch(/não foi possível entrar/i);
  });

  it('se o script do Google não carregar, a tela diz', async () => {
    render(<BotaoGoogleComponent aoEntrar={vi.fn()} />);

    const script = document.getElementById('google-gsi') as HTMLScriptElement;
    await act(async () => script.onerror?.(new Event('error')));

    expect(screen.getByRole('alert').textContent).toMatch(/falha ao carregar o google/i);
  });
});
