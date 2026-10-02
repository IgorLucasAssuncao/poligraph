import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { obterNovidades } from '../api';
import type { Novidades } from '../api';
import { OQueMudou } from './OQueMudou';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterNovidades: vi.fn(),
}));

const VAZIAS: Novidades = {
  semana: { de: '2026-09-26', ate: '2026-10-02' },
  atualizacoes: [{ fonte: 'CAMARA', orgao: 'Câmara dos Deputados', ultimaCarga: '2026-10-02T14:58:55Z' }],
  votosNaSemana: [],
  contraOPartido: [],
  trocasDePartido: [],
  gastosNaCota: [],
  emendasPagas: [],
};

function renderizar(novidades: Novidades) {
  vi.mocked(obterNovidades).mockResolvedValue(novidades);
  return render(
    <MemoryRouter>
      <OQueMudou />
    </MemoryRouter>,
  );
}

/** PL63: fato com a fonte e a data da carga, do mais recente; vazio honesto. */
describe('o que mudou', () => {
  it('vazio diz a data da carga, não "hoje"', async () => {
    renderizar(VAZIAS);

    expect(await screen.findByText('Nada novo desde a última atualização, em 02/10.')).toBeInTheDocument();
  });

  it('o voto contra o partido diz o voto e a orientação, sem adjetivo', async () => {
    renderizar({
      ...VAZIAS,
      contraOPartido: [{
        pessoaId: 7, nome: 'Ana Ribeiro', votacaoId: '2645346-18', data: '2026-10-01', proposicao: 'PL 2630/2020',
        descricao: 'Aprovado o Projeto', partido: 'PT', bancada: 'Fdr PT-PCdoB-PV', orientacao: 'Não', voto: 'Sim',
        urlFonte: 'https://www.camara.leg.br/presenca-comissoes/votacao-portal?reuniao=1',
      }],
    });

    const item = (await screen.findByText(/Fdr PT-PCdoB-PV/)).closest('li')!;
    expect(item.textContent).toMatch(/Ana Ribeiro votou Sim na PL 2630\/2020; a bancada Fdr PT-PCdoB-PV, do PT, orientou Não\./);
    expect(item.textContent).not.toMatch(/traiu|contrariou|rebelde/i);
  });

  it('a ausência só aparece no Senado, e o mais recente vem primeiro', async () => {
    renderizar({
      ...VAZIAS,
      votosNaSemana: [
        { pessoaId: 1, nome: 'Deputada A', casa: 'CAMARA', votou: 12, ausente: null, ausenteJustificado: null },
        { pessoaId: 2, nome: 'Senador B', casa: 'SENADO', votou: 4, ausente: 2, ausenteJustificado: 1 },
      ],
      gastosNaCota: [{
        pessoaId: 1, nome: 'Deputada A', casa: 'CAMARA', ano: 2026, mes: 9, total: 38000,
        maiorCategoria: 'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR', maiorCategoriaValor: 12000,
      }],
    });

    const itens = await screen.findAllByRole('listitem');
    expect(itens[0].textContent).toMatch(/votou em 12 votações de plenário\./);
    expect(itens[1].textContent).toMatch(/ausente em 3 \(1 com justificativa\)/);
    expect(itens[2].textContent).toMatch(/gastou R\$\s*38\.000,00 da cota em/);
  });
});
