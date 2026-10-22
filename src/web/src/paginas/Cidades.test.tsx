import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHAVE_MINHA_CIDADE } from '../constantes';
import { CidadesComponent } from './Cidades';

beforeEach(() => localStorage.clear());

describe('Cidades', () => {
  it('fica em Dinheiro público e oferece a cidade guardada neste navegador', () => {
    localStorage.setItem(CHAVE_MINHA_CIDADE, JSON.stringify({ codigoIbge: '3509502', nome: 'CAMPINAS', uf: 'SP' }));
    render(
      <MemoryRouter initialEntries={['/cidades']}>
        <CidadesComponent />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Cidades' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campinas – SP' })).toHaveAttribute('href', '/cidades/3509502');
    expect(screen.getByRole('link', { name: 'Cidades' })).toHaveAttribute('href', '/cidades');
  });
});
