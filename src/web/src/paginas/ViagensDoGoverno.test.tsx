import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import type { ViagensDoGoverno } from '../api';
import { ViagensDoGovernoComponent } from './ViagensDoGoverno';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterViagensDoGoverno: vi.fn(),
}));

const VIAGENS: ViagensDoGoverno = {
  periodo: { primeiroAno: 2025, ultimoAno: 2026 },
  anosDisponiveis: [2025, 2026],
  total: 2.4e9, diarias: 1.4e9, passagens: 0.98e9, restituicao: 10e6, seguro: 10e6,
  viagens: 900_000, urgentes: 120_000, naoRealizadas: 9_000, sigiloso: 235e6,
  porAno: [
    { anoDaViagem: 2025, diarias: 0.7e9, passagens: 0.5e9, total: 1.2e9, viagens: 450_000 },
    { anoDaViagem: 2026, diarias: 0.7e9, passagens: 0.48e9, total: 1.2e9, viagens: 450_000 },
  ],
  porOrgao: [
    { orgao: 'Sigiloso', total: 235e6, diarias: 100e6, passagens: 135e6, viagens: 40_000, urgentes: 1_000 },
    { orgao: 'Ministério da Educação', total: 180e6, diarias: 120e6, passagens: 60e6, viagens: 60_000, urgentes: 500 },
  ],
  destinos: [{ pais: 'Brasil', uf: 'Distrito Federal', cidade: 'Brasília', chegadas: 80_000 }],
  destinosNoExterior: [{ pais: 'França', uf: null, cidade: 'Paris', chegadas: 900 }],
};

function renderizar() {
  return render(
    <MemoryRouter>
      <ViagensDoGovernoComponent />
    </MemoryRouter>,
  );
}

describe('viagens a serviço', () => {
  it('diz o total, separa diárias e passagens e responde onde está a hospedagem', async () => {
    vi.mocked(api.obterViagensDoGoverno).mockResolvedValue(VIAGENS);
    renderizar();

    expect(await screen.findByText('Diárias')).toBeDefined();
    const texto = document.body.textContent ?? '';
    expect(texto).toMatch(/De 2025 a 2026, o governo federal pagou R\$\s*2,4\s*bi em 900\.000 viagens a serviço/);
    expect(texto).toMatch(/Hospedagem não aparece separada: no serviço público federal ela é paga pela diária/);
  });

  it('o órgão sigiloso fica na lista e ganha frase própria', async () => {
    vi.mocked(api.obterViagensDoGoverno).mockResolvedValue(VIAGENS);
    renderizar();

    await screen.findByText('Por órgão');
    expect(document.body.textContent).toMatch(/R\$\s*235\s*mi foram pagos em viagens que o Portal publica com o órgão "Sigiloso"/);
    expect(screen.getByText('Sigiloso')).toBeDefined();
  });

  it('destino no exterior mostra o país no lugar da UF', async () => {
    vi.mocked(api.obterViagensDoGoverno).mockResolvedValue(VIAGENS);
    renderizar();

    expect(await screen.findByText('Paris, França')).toBeDefined();
    expect(screen.getByText('Brasília, Distrito Federal')).toBeDefined();
  });

  it('sem carga, diz que as viagens ainda não foram carregadas', async () => {
    vi.mocked(api.obterViagensDoGoverno).mockResolvedValue(null);
    renderizar();

    expect(await screen.findByText('As viagens ainda não foram carregadas.')).toBeDefined();
  });
});
