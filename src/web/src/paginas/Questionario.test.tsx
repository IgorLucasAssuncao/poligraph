import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Questionario } from './Questionario';

vi.mock('../api', async () => {
  const real = await vi.importActual<typeof import('../api')>('../api');

  return {
    ...real,
    obterPerguntas: vi.fn(),
    calcularAfinidade: vi.fn(),
  };
});

const { calcularAfinidade, obterPerguntas } = await import('../api');

const PERGUNTAS = [
  { id: 'q1', texto: 'Primeira afirmação', ordem: 1, totalVotos: 480, totalPossivel: 513 },
  { id: 'q2', texto: 'Segunda afirmação', ordem: 2, totalVotos: 501, totalPossivel: 513 },
];

function renderizar() {
  return render(
    <MemoryRouter>
      <Questionario />
    </MemoryRouter>,
  );
}

describe('Questionario', () => {
  beforeEach(() => {
    vi.mocked(obterPerguntas).mockResolvedValue(PERGUNTAS);
    vi.mocked(calcularAfinidade).mockReset();
  });

  it('mostra uma pergunta por vez, nunca a lista inteira', async () => {
    renderizar();

    // ⭐ A decisão de desenho que este teste protege: a segunda afirmação só existe
    //    depois de a primeira ser respondida. Uma lista longa fazia a pessoa varrer
    //    tudo e responder no automático.
    expect(await screen.findByText('Primeira afirmação')).toBeDefined();
    expect(screen.queryByText('Segunda afirmação')).toBeNull();
  });

  it('avança sozinho depois de responder', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Concordo' }));

    // ⚠️ A pausa é real (setTimeout), então o avanço é assíncrono de propósito.
    await waitFor(() => expect(screen.getByText('Segunda afirmação')).toBeDefined());
  });

  it('🔴 no retorno mostra o comparecimento, NUNCA o placar', async () => {
    const usuario = userEvent.setup();
    const { container } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Discordo' }));

    // ⭐ Revelar "310 votaram Sim" antes das próximas perguntas induziria conformidade,
    //    e o instrumento passaria a medir adesão à maioria. Ver `PerguntaPublica`.
    await waitFor(() => expect(container.textContent).toMatch(/480/));
    expect(container.textContent).not.toMatch(/votaram sim|votaram não|a favor|contra/i);

    // ⭐ E o painel desenhado também não: exatamente DOIS estados de marca, cheia e
    //    vazada. Um terceiro estado seria direção codificada em forma.
    const estados = new Set(
      [...container.querySelectorAll('.marca')].map((m) => m.className),
    );
    expect(estados).toEqual(new Set(['marca', 'marca marca-cheia']));
  });

  it('sem placar registrado, não afirma "0 deputados se posicionaram"', async () => {
    // ⚠️ Acontece quando a ingestão não trouxe o placar oficial daquela votação.
    //    O que falta é o dado — dizer "0" seria afirmar um comparecimento inexistente.
    vi.mocked(obterPerguntas).mockResolvedValue([{ ...PERGUNTAS[0], totalVotos: 0 }]);

    const usuario = userEvent.setup();
    const { container } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Concordo' }));

    await waitFor(() => expect(container.textContent).toMatch(/registrada/i));
    expect(container.textContent).not.toMatch(/0 deputados|se posicionaram/i);
  });

  it('conta apenas as respostas com opinião — "Não sei" não vira concordância', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Não sei' }));
    await waitFor(() => expect(screen.getByText('Segunda afirmação')).toBeDefined());

    await usuario.click(screen.getByRole('button', { name: 'Concordo' }));

    // 🔴 duas perguntas percorridas, UMA opinião — o encerramento não pode dizer "2"
    const encerramento = await screen.findByText(/opinou em/i);
    expect(encerramento.textContent).toMatch(/opinou em 1 de 2/i);
  });
});
