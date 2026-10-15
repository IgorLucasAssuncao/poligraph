import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvaliacaoComponent } from './Avaliacao';
import type { ResultadoAfinidade } from '../api';

vi.mock('../api', async () => {
  const real = await vi.importActual<typeof import('../api')>('../api');

  return { ...real, registrarAvaliacao: vi.fn() };
});

const { registrarAvaliacao } = await import('../api');

/**
 * Sem execução do grafo não há posição — a tela omite o desenho.
 */
const RESULTADO: ResultadoAfinidade = {
  totalPerguntasRespondidas: 12,
  porCasa: [
    {
      casa: 'CAMARA',
      perguntasRespondidas: 12,
      maisProximos: [
        {
          idPessoa: 1, nome: 'Ana Ribeiro', partido: 'A', uf: 'SP',
          acordos: 9, comparaveis: 12,
          acordou: ['p-1', 'p-2'], discordou: ['p-3'],
        },
      ],
      maisDistantes: [],
      posicaoNoGrafo: null,
      escala: { comparados: 12, medianoAcordos: 1, medianoComparaveis: 3 },
    },
  ],
};

/**
 * Os dublês de `showModal`/`close` vivem em `vitest.setup.ts` — o jsdom não os tem.
 */
beforeEach(() => {
  vi.mocked(registrarAvaliacao).mockReset();
  vi.mocked(registrarAvaliacao).mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

/**
 * Renderiza e deixa o modal ABERTO.
 *
 * ATENÇÃO: `<dialog>` fechado esconde o conteúdo da árvore de acessibilidade, então
 * `getByRole` não acha nada antes de o modal subir. E `userEvent` precisa saber
 * adiantar o relógio falso, senão trava esperando um `setTimeout` que nunca corre.
 */
async function abrir() {
  const usuario = userEvent.setup();

  render(<AvaliacaoComponent resultado={RESULTADO} esperaMs={0} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeDefined(),
  );

  return usuario;
}

/**
 * ATENÇÃO: Abrir junto com o resultado atropelaria a leitura, e a pessoa fecharia sem
 * ter visto o que veio responder.
 *
 * ATENÇÃO: Aos 3 s a pessoa ainda está lendo o nome do primeiro parlamentar.
 *
 * RISCO: Recusar tem de ser tão fácil quanto aceitar, e não pode gravar nada.
 *
 * RISCO: LGPD: a autodeclaração é gravada SEM vínculo com a conta. Se algum campo de
 * identidade aparecer aqui, ela deixa de responder "o método acerta?" e passa a
 * responder "o que o Fulano pensa?".
 *
 * ATENÇÃO: Dito onde a pessoa decide, não escondido na política de privacidade.
 */
describe('Avaliacao', () => {
  it('abre sozinha, mas só depois de a pessoa ver o resultado', () => {
    vi.useFakeTimers();
    render(<AvaliacaoComponent resultado={RESULTADO} />);

    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  });

  it('não abre por cima de outro diálogo, e tenta de novo depois', () => {
    vi.useFakeTimers();
    const outro = document.createElement('dialog');
    outro.setAttribute('open', '');
    document.body.append(outro);

    render(<AvaliacaoComponent resultado={RESULTADO} />);
    vi.advanceTimersByTime(8000);
    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();

    outro.remove();
    vi.advanceTimersByTime(1500);
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
  });

  it('RISCO: "Agora não" fecha sem enviar nada', async () => {
    const usuario = await abrir();

    await usuario.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(registrarAvaliacao).not.toHaveBeenCalled();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it('não deixa enviar em branco', async () => {
    await abrir();

    const enviar = screen.getByRole('button', { name: 'Enviar avaliação' });

    expect((enviar as HTMLButtonElement).disabled).toBe(true);
  });

  it('envia a autodeclaração sem nada que identifique a pessoa', async () => {
    const usuario = await abrir();

    await usuario.click(screen.getByText('Combinou'));
    await usuario.click(screen.getByText('Centro'));
    await usuario.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

    await waitFor(() => expect(registrarAvaliacao).toHaveBeenCalledOnce());

    const enviado = vi.mocked(registrarAvaliacao).mock.calls[0][0];

    expect(enviado.acertou).toBe(true);
    expect(enviado.posicaoAutodeclarada).toBe(0);

    const chaves = Object.keys(enviado);
    expect(chaves).not.toContain('usuarioId');
    expect(chaves).not.toContain('email');
    expect(chaves).not.toContain('nome');
  });

  it('avisa que a resposta não fica ligada à conta, na hora de decidir', async () => {
    const { container } = render(<AvaliacaoComponent resultado={RESULTADO} esperaMs={0} />);
    await waitFor(() => expect(container.textContent).toMatch(/Ajude a avaliar/));

    expect(container.textContent).toMatch(/sem ligação com a sua conta/i);
  });
});
