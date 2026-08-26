import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Resultado } from './Resultado';
import type { ResultadoAfinidade } from './api';

const RESULTADO: ResultadoAfinidade = {
  casa: 'CAMARA',
  totalPerguntasRespondidas: 3,
  maisProximos: [
    { pessoaId: 1, nome: 'Ana Ribeiro', partido: 'PARTIDO-A', uf: 'SP', acordos: 2, comparaveis: 3 },
  ],
  maisDistantes: [
    { pessoaId: 2, nome: 'Bruno Tavares', partido: 'PARTIDO-B', uf: 'MG', acordos: 0, comparaveis: 3 },
  ],
};

describe('Resultado', () => {
  it('mostra "X de Y" — o número junto da base', () => {
    const { container } = render(<Resultado resultado={RESULTADO} aoRefazer={vi.fn()} />);

    // ⚠️ o texto é quebrado por <strong>, então a checagem é sobre o conteúdo inteiro
    const texto = container.textContent!.replace(/\s+/g, ' ');

    // ⭐ RF-29: nunca o número sozinho — sempre "2 de 3"
    expect(texto).toMatch(/concordaram em 2 de 3 perguntas/);
    expect(texto).toMatch(/concordaram em 0 de 3 perguntas/);
  });

  it('🔴 NUNCA exibe percentual', () => {
    const { container } = render(<Resultado resultado={RESULTADO} aoRefazer={vi.fn()} />);

    // "67%" esconderia que a base foram 3 perguntas
    expect(container.textContent).not.toMatch(/\d+\s*%/);
    expect(container.textContent).not.toMatch(/0[.,]\d\d/);
  });

  it('mostra os mais distantes, não só os mais próximos', () => {
    render(<Resultado resultado={RESULTADO} aoRefazer={vi.fn()} />);

    // RF-28 — ver de quem você discorda é parte do método
    expect(screen.getByText('Bruno Tavares')).toBeDefined();
  });

  it('exibe o aviso de que não é recomendação de voto', () => {
    render(<Resultado resultado={RESULTADO} aoRefazer={vi.fn()} />);

    // RNF-14 — obrigatório em toda tela de resultado
    expect(screen.getByRole('note').textContent).toMatch(/não é recomendação de voto/i);
  });

  it('deixa claro quantas perguntas foram respondidas', () => {
    render(<Resultado resultado={RESULTADO} aoRefazer={vi.fn()} />);

    expect(screen.getByText(/respondeu 3 perguntas/i)).toBeDefined();
  });
});
