import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import type { MandatoNoTse } from '../api';
import { CargosNoTseComponent } from './CargosNoTse';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterFichaDoPolitico: vi.fn(),
}));

const mandato = (cargo: MandatoNoTse['cargo'], nivel: MandatoNoTse['nivel'], anoEleicao: number, uf: string | null): MandatoNoTse => ({
  cargo, nivel, anoEleicao, primeiroAno: anoEleicao + 1, ultimoAno: anoEleicao + 4, uf, municipio: null, partido: 'PSL',
});

describe('mandatos do TSE na ficha do parlamentar', () => {
  it('o presidente que foi deputado tem os dois cargos na lista completa', async () => {
    vi.mocked(api.obterFichaDoPolitico).mockResolvedValue({
      idPessoa: 1060, nome: 'JAIR BOLSONARO', nomeCivil: null, urlFoto: null, parlamentar: true, redesSociais: [],
      mandatos: [mandato('PRESIDENTE', 'FEDERAL', 2018, null), mandato('DEPUTADO_FEDERAL', 'FEDERAL', 2014, 'RJ')],
    });
    render(
      <MemoryRouter>
        <CargosNoTseComponent idPessoa={1060} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Eleito também, pelo TSE/)).toHaveTextContent(/Presidente/);
    fireEvent.click(screen.getByText('Ver os 2 mandatos eleitos, pelo TSE'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'ver os outros eleitos' })).toHaveLength(2);
  });
});
