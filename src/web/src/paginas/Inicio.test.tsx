import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ComoODecidiuComponent } from '../componentes/BaseDoCongresso';

/** O plenário decide mais por votação simbólica do que por nominal, e o Início diz isso (2026-10-03). */
describe('como o plenário decidiu', () => {
  it('diz quantas foram nominais e quantas simbólicas, com a dica de cada termo', () => {
    render(<ComoODecidiuComponent nominais={1125} simbolicas={4300} />);

    expect(screen.getByRole('img', { name: '1125 nominais e 4300 simbólicas' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'votação nominal' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'votação simbólica' })).toBeDefined();
    expect(document.body.textContent).toMatch(/4\.300 por votação simbólica/);
  });
});
