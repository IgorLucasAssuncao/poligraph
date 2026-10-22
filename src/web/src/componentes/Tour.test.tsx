import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProvedorDoTourComponent } from './Tour';
import { useTour } from './contextoDoTour';
import { CHAVE_CONSENTIMENTO } from '../constantes';
import { VERSAO_DO_AVISO_DE_MEDICAO } from '../textos-legais';
import { PASSOS_DO_SITE, passosDoGrafo, type PassoDoTour } from '../tour';
import { TourDaTelaComponent } from './TourDaTela';
import { AjudaComponent } from './Ajuda';

function BotaoDeAbrir() {
  const { iniciar } = useTour();
  return (
    <button type="button" onClick={() => iniciar()}>
      abrir tour
    </button>
  );
}

/** Um elemento para cada alvo do tour, menos os que o teste quer ausentes. */
function Alvos({ sem = [] }: { sem?: string[] }) {
  return (
    <>
      {PASSOS_DO_SITE.filter((p) => !sem.includes(p.alvo)).map((p) => (
        <div key={p.alvo} data-tour={p.alvo}>
          {p.alvo}
        </div>
      ))}
    </>
  );
}

function renderizar(sem: string[] = []) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ProvedorDoTourComponent>
        <BotaoDeAbrir />
        <Alvos sem={sem} />
      </ProvedorDoTourComponent>
    </MemoryRouter>,
  );
}

const PASSOS_DA_TELA: PassoDoTour[] = [
  { rota: null, alvo: 'um', titulo: 'Primeiro da tela', texto: 'a' },
  { rota: null, alvo: 'dois', titulo: 'Segundo da tela', texto: 'b' },
];

/** Uma tela com tour próprio, como o grafo. */
function renderizarTela() {
  return render(
    <MemoryRouter initialEntries={['/parlamentares']}>
      <ProvedorDoTourComponent>
        <AjudaComponent />
        <TourDaTelaComponent nome="grafo" passos={PASSOS_DA_TELA} />
        <div data-tour="um">um</div>
        <div data-tour="dois">dois</div>
      </ProvedorDoTourComponent>
    </MemoryRouter>,
  );
}

function decidirConsentimento() {
  localStorage.setItem(
    CHAVE_CONSENTIMENTO,
    JSON.stringify({ versao: VERSAO_DO_AVISO_DE_MEDICAO, aceito: false, em: '2026-09-24' }),
  );
}

/**
 * O jsdom não mede nem rola: sem isto todo alvo teria altura zero e seria pulado.
 */
describe('Tour guiado', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, left: 20, bottom: 140, right: 220, width: 200, height: 40, x: 20, y: 100,
      toJSON: () => ({}),
    } as DOMRect);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => vi.restoreAllMocks());

  describe('nada se oferece sozinho', () => {
    it('nem o do site nem o da tela abrem ou aparecem sem pedido, mesmo no primeiro acesso', () => {
      decidirConsentimento();
      renderizarTela();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.queryByText('Como ler o grafo')).toBeNull();
      expect(screen.queryByText('Como o site funciona')).toBeNull();
    });
  });

  describe('o tour', () => {
    it('abre no primeiro passo e avança', async () => {
      renderizar();

      fireEvent.click(screen.getByRole('button', { name: 'abrir tour' }));

      expect(await screen.findByText(`Passo 1 de ${PASSOS_DO_SITE.length}`)).toBeDefined();
      expect(screen.getByRole('heading', { name: PASSOS_DO_SITE[0].titulo })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));

      expect(await screen.findByText(`Passo 2 de ${PASSOS_DO_SITE.length}`)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDefined();
    });

    it('"Pular" fecha e grava que a pessoa já viu', async () => {
      renderizar();
      fireEvent.click(screen.getByRole('button', { name: 'abrir tour' }));
      await screen.findByText(`Passo 1 de ${PASSOS_DO_SITE.length}`);

      fireEvent.click(screen.getByRole('button', { name: 'Pular' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(localStorage.getItem('poligraph:tour-visto')).toBe('1');
    });

    it('Esc fecha, como qualquer diálogo', async () => {
      renderizar();
      fireEvent.click(screen.getByRole('button', { name: 'abrir tour' }));
      await screen.findByText(`Passo 1 de ${PASSOS_DO_SITE.length}`);

      fireEvent(screen.getByRole('dialog', { hidden: true }), new Event('cancel', { cancelable: true }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('pula o passo cujo elemento não está na tela', async () => {
      const indiceOpcional = PASSOS_DO_SITE.findIndex((p) => p.opcional);
      const opcional = PASSOS_DO_SITE[indiceOpcional];
      renderizar([opcional.alvo]);

      fireEvent.click(screen.getByRole('button', { name: 'abrir tour' }));
      for (let i = 1; i <= indiceOpcional; i++) {
        await screen.findByText(`Passo ${i} de ${PASSOS_DO_SITE.length}`);
        fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
      }

      const seguinte = PASSOS_DO_SITE[indiceOpcional + 1];
      expect(await screen.findByRole('heading', { name: seguinte.titulo }, { timeout: 5000 })).toBeDefined();
      expect(screen.queryByRole('heading', { name: opcional.titulo })).toBeNull();
    });
  });

  describe('tour de tela', () => {
    it('o "?" do cabeçalho oferece o da tela e o do site, e abre o da tela', async () => {
      renderizarTela();

      fireEvent.click(screen.getByRole('button', { name: 'Ajuda: como ler esta tela' }));
      expect(screen.getByRole('menuitem', { name: /Como o site funciona/ })).toBeDefined();
      fireEvent.click(screen.getByRole('menuitem', { name: /Como ler o grafo/ }));

      expect(await screen.findByText('Passo 1 de 2')).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Primeiro da tela' })).toBeDefined();
    });

    it('sem tour na tela, o "?" abre direto o do site', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <ProvedorDoTourComponent>
            <AjudaComponent />
            <Alvos />
          </ProvedorDoTourComponent>
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Como o site funciona' }));

      expect(await screen.findByText(`Passo 1 de ${PASSOS_DO_SITE.length}`)).toBeDefined();
    });

    it('cada tour lembra o seu: ver o da tela não marca o do site', async () => {
      renderizarTela();
      fireEvent.click(screen.getByRole('button', { name: 'Ajuda: como ler esta tela' }));
      fireEvent.click(screen.getByRole('menuitem', { name: /Como ler o grafo/ }));
      await screen.findByText('Passo 1 de 2');

      fireEvent.click(screen.getByRole('button', { name: 'Pular' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(localStorage.getItem('poligraph:tour-visto:grafo')).toBe('1');
      expect(localStorage.getItem('poligraph:tour-visto')).toBeNull();
    });
  });
});

/**
 * O número no texto é o da execução, não um literal que envelheceria calado.
 */
describe('passos do grafo', () => {
  const base = { singular: 'deputado', plural: 'deputados', vizinhosPorNo: 10 };

  it('conta as ligações com o k da execução', () => {
    const texto = passosDoGrafo({ ...base, vizinhosPorNo: 7, temAlinhamento: true })
      .map((p) => p.texto)
      .join(' ');

    expect(texto).toContain('as 7 ligações mais fortes');
    expect(texto).not.toContain('10');
  });

  it('sem orientação do Governo, não descreve a vista de alinhamento', () => {
    const ajustes = passosDoGrafo({ ...base, singular: 'senador', plural: 'senadores', temAlinhamento: false })
      .find((p) => p.alvo === 'grafo-ajustes')!;

    expect(ajustes.texto).toContain('só existe esta vista');
    expect(ajustes.texto).not.toContain('No alinhamento');
  });
});

/**
 * "Passo 2 de 3" com um opcional ausente prometeria um passo que não vem, e o botão diria "Próximo".
 */
describe('passos opcionais ausentes', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, left: 20, bottom: 140, right: 220, width: 200, height: 40, x: 20, y: 100,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => vi.restoreAllMocks());

  it('contam só o que está na página, e o último diz Concluir', async () => {
    const passos: PassoDoTour[] = [
      { rota: null, alvo: 'um', titulo: 'Primeiro', texto: 'a' },
      { rota: null, alvo: 'dois', titulo: 'Segundo', texto: 'b' },
      { rota: null, alvo: 'ausente', titulo: 'Ausente', texto: 'c', opcional: true },
    ];
    render(
      <MemoryRouter initialEntries={['/x']}>
        <ProvedorDoTourComponent>
          <AjudaComponent />
          <TourDaTelaComponent nome="grafo" passos={passos} />
          <div data-tour="um">um</div>
          <div data-tour="dois">dois</div>
        </ProvedorDoTourComponent>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ajuda: como ler esta tela' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Como ler o grafo/ }));
    expect(await screen.findByText('Passo 1 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(await screen.findByText('Passo 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Concluir' })).toBeInTheDocument();
  });
});
