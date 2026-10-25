import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TEXTOS_DOS_COMPONENTES as T } from '../../../src/comum/textos/componentes';
import { ParlamentaresComponent } from '../../../src/parlamentares/paginas/Parlamentares';

vi.mock('../../../src/parlamentares/paginas/Explorar', () => ({ ExplorarComponent: () => <p>vista em lista</p> }));
vi.mock('../../../src/grafo/paginas/Grafo', () => ({ GrafoComponent: () => <p>vista em grafo</p> }));
vi.mock('../../../src/parlamentares/componentes/BarraDePeriodo', () => ({
  BarraDePeriodoComponent: ({ comTodas }: { comTodas?: boolean }) => <p>{comTodas ? 'período com todas' : 'período sem todas'}</p>,
}));

/** O endereço atual, para o teste conferir o que a aba escreveu nele. */
function EnderecoComponent() {
  const local = useLocation();
  return <output>{local.search}</output>;
}

function abrir(endereco: string) {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <ParlamentaresComponent />
      <EnderecoComponent />
    </MemoryRouter>,
  );
}

describe('lista e grafo de parlamentares', () => {
  it('abre na lista, com o período que aceita "todas"', () => {
    abrir('/parlamentares');

    expect(screen.getByText('vista em lista')).toBeDefined();
    expect(screen.getByText('período com todas')).toBeDefined();
    expect(screen.getByRole('tab', { name: T.vistas.lista }).getAttribute('aria-selected')).toBe('true');
  });

  it('a aba grafo vai para o endereço, e a lista tira o parâmetro', () => {
    abrir('/parlamentares?legislatura=56');

    fireEvent.click(screen.getByRole('tab', { name: T.vistas.grafo }));
    expect(screen.getByText('vista em grafo')).toBeDefined();
    expect(screen.getByText('período sem todas')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe('?legislatura=56&vista=grafo');

    fireEvent.click(screen.getByRole('tab', { name: T.vistas.lista }));
    expect(screen.getByRole('status').textContent).toBe('?legislatura=56');
  });
});
