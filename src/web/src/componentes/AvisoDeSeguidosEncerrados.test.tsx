import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispensarSeguidosEncerrados, obterSeguidosEncerrados } from '../api';
import { AvisoDeSeguidosEncerradosComponent } from './AvisoDeSeguidosEncerrados';

let sessao: { usuario: { nome: string } | null } = { usuario: { nome: 'Ana' } };
vi.mock('../sessao', () => ({ useSessao: () => sessao }));

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterSeguidosEncerrados: vi.fn(),
  dispensarSeguidosEncerrados: vi.fn().mockResolvedValue(undefined),
}));

function renderizar() {
  return render(
    <MemoryRouter>
      <AvisoDeSeguidosEncerradosComponent />
    </MemoryRouter>,
  );
}

/** Decisão do autor (2026-10-18): quem deixou o mandato sai da lista de seguidos, e a pessoa é avisada. */
describe('aviso de quem deixou o mandato', () => {
  beforeEach(() => {
    sessao = { usuario: { nome: 'Ana' } };
  });

  it('na virada, diz que começou a legislatura e quem saiu', async () => {
    vi.mocked(obterSeguidosEncerrados).mockResolvedValue({
      novaLegislatura: 58,
      parlamentares: [
        { idPessoa: 1, nome: 'Ana Ribeiro' },
        { idPessoa: 2, nome: 'Bruno Lima' },
      ],
    });
    renderizar();

    const aviso = await screen.findByRole('status');

    expect(aviso).toHaveTextContent(
      'Começou a 58ª legislatura. Ana Ribeiro e Bruno Lima não estão mais no mandato e saíram da sua lista de quem você segue.',
    );
  });

  it('no meio do mandato, só diz que a pessoa saiu', async () => {
    vi.mocked(obterSeguidosEncerrados).mockResolvedValue({ novaLegislatura: null, parlamentares: [{ idPessoa: 1, nome: 'Ana Ribeiro' }] });
    renderizar();

    expect(await screen.findByRole('status')).toHaveTextContent(
      /^Ana Ribeiro não está mais no mandato e saiu da sua lista de quem você segue\./,
    );
  });

  it('"Entendi" fecha e apaga o registro', async () => {
    vi.mocked(obterSeguidosEncerrados).mockResolvedValue({ novaLegislatura: null, parlamentares: [{ idPessoa: 1, nome: 'Ana Ribeiro' }] });
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Entendi' }));

    expect(screen.queryByRole('status')).toBeNull();
    expect(dispensarSeguidosEncerrados).toHaveBeenCalled();
  });

  it('sem conta ou sem ninguém encerrado, não aparece', async () => {
    vi.mocked(obterSeguidosEncerrados).mockResolvedValue({ novaLegislatura: null, parlamentares: [] });
    const { container } = renderizar();
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();

    sessao = { usuario: null };
    const semConta = renderizar();
    expect(semConta.container).toBeEmptyDOMElement();
  });
});
