import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { obterProcedencia } from '../api';
import { marcarTourVisto } from '../tour';
import { ContextoDoTour } from './contextoDoTour';
import { ComProcedenciaComponent, InterruptorDoModoAnaliseComponent, ProvedorDoModoAnaliseComponent } from './ModoAnalise';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  obterProcedencia: vi.fn().mockResolvedValue({
    regra: 'Os lançamentos da cota parlamentar desta pessoa em 2025, pelo valor líquido.',
    linhas: 412,
    linhasSemCarga: 12,
    cargas: [
      {
        id: 7, fonte: 'CAMARA', orgao: 'Câmara dos Deputados',
        baseLegal: 'Lei 12.527/2011 (Lei de Acesso à Informação), art. 8º',
        url: 'https://www.camara.leg.br/cotas/Ano-2025.csv.zip',
        baixadoEm: '2026-10-02T18:40:00Z', sha256: 'a'.repeat(64), bytes: 18_874_368,
        etagDaFonte: null, modificadoNaFonte: null,
        comando: 'poligraph_etl cota --anos 2025', versao: 'etl-0123456789ab', linhas: 400,
      },
    ],
  }),
}));

/** O jsdom não implementa `showModal`: sem isto o painel nunca abriria no teste. */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

afterEach(() => localStorage.clear());

function renderizar() {
  return render(
    <ProvedorDoModoAnaliseComponent>
      <InterruptorDoModoAnaliseComponent />
      <p>
        Gastou{' '}
        <ComProcedenciaComponent consulta={{ contexto: 'cota', pessoa: 1, ano: 2025 }} rotulo="Cota parlamentar de 2025">
          <strong>R$ 412.000,00</strong>
        </ComProcedenciaComponent>
      </p>
    </ProvedorDoModoAnaliseComponent>,
  );
}

/** Pendência 73: desligado, o site fica como está; ligado, o número abre o arquivo de onde veio. */
describe('o modo análise', () => {
  it('desligado, o número é só texto', () => {
    renderizar();
    expect(screen.queryByRole('button', { name: /ver de onde veio/ })).toBeNull();
    expect(screen.getByText('R$ 412.000,00')).toBeInTheDocument();
  });

  it('ligado, o número abre o painel com o hash, a versão e as linhas sem carga', async () => {
    renderizar();
    fireEvent.click(screen.getByRole('button', { name: /Análise/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cota parlamentar de 2025: ver de onde veio' }));

    expect(obterProcedencia).toHaveBeenCalledWith({ contexto: 'cota', pessoa: 1, ano: 2025 });
    expect(await screen.findByText('a'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText('etl-0123456789ab')).toBeInTheDocument();
    expect(screen.getByText(/12 linhas foram gravadas antes do registro de procedência/)).toBeInTheDocument();
    expect(screen.getByText('18 MB')).toBeInTheDocument();
  });

  it('a escolha fica guardada no navegador', () => {
    renderizar();
    const interruptor = screen.getByRole('button', { name: /Análise/ });
    fireEvent.click(interruptor);
    expect(interruptor).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('poligraph:modo-analise')).toBe('1');
  });
});

/** O tour do modo abre na primeira vez que a pessoa liga, e só nela. */
describe('o tour do modo análise', () => {
  function comTour(iniciar: (nome?: string) => void) {
    return render(
      <ContextoDoTour.Provider value={{ iniciar, registrar: () => () => {} }}>
        <ProvedorDoModoAnaliseComponent>
          <InterruptorDoModoAnaliseComponent />
        </ProvedorDoModoAnaliseComponent>
      </ContextoDoTour.Provider>,
    );
  }

  it('abre ao ligar pela primeira vez, e não ao desligar', () => {
    const iniciar = vi.fn();
    comTour(iniciar);

    fireEvent.click(screen.getByRole('button', { name: /Análise/ }));
    expect(iniciar).toHaveBeenCalledWith('analise');

    fireEvent.click(screen.getByRole('button', { name: /Análise/ }));
    expect(iniciar).toHaveBeenCalledTimes(1);
  });

  it('não abre de novo depois de visto', () => {
    marcarTourVisto('analise');
    const iniciar = vi.fn();
    comTour(iniciar);

    fireEvent.click(screen.getByRole('button', { name: /Análise/ }));
    expect(iniciar).not.toHaveBeenCalled();
  });
});
