import { describe, expect, it } from 'vitest';
import {
  aproximar,
  comEscala,
  distanciaAoSegmento,
  enquadrar,
  enquadrarMiolo,
  ESCALA_MAXIMA,
  ESCALA_MINIMA,
  paraMundo,
  paraTela,
  pinca,
  type Camera,
} from '../../../../src/grafo/componentes/grafo/camera';

const TELA = { largura: 800, altura: 500 };
const NEUTRA: Camera = { escala: 1, x: 0, y: 0 };

/**
 * RISCO: É a propriedade que faz o arrasto de um nó grudar no cursor. Sem ela o nó
 * descola do ponteiro conforme o zoom sobe — foi o bug da versão anterior.
 */
describe('conversão entre plano e tela', () => {
  it('leva e traz o mesmo ponto, em qualquer câmera', () => {
    const cameras: Camera[] = [
      NEUTRA,
      { escala: 12, x: -300, y: 140 },
      { escala: 0.2, x: 55, y: -20 },
    ];

    for (const camera of cameras) {
      for (const ponto of [{ x: -1, y: -1 }, { x: 0, y: 0 }, { x: 0.73, y: -0.41 }]) {
        const tela = paraTela(ponto.x, ponto.y, TELA, camera);
        const volta = paraMundo(tela.x, tela.y, TELA, camera);

        expect(volta.x).toBeCloseTo(ponto.x, 6);
        expect(volta.y).toBeCloseTo(ponto.y, 6);
      }
    }
  });

  it('o plano não tem parede: coordenada fora de [-1, 1] tem lugar na tela', () => {
    const longe = paraTela(9, -7, TELA, NEUTRA);

    expect(Number.isFinite(longe.x)).toBe(true);
    expect(Number.isFinite(longe.y)).toBe(true);
    expect(longe.x).toBeGreaterThan(TELA.largura);
  });
});

/**
 * DECISÃO: É o que faz o zoom parecer natural: aproximar no centro da tela dá a
 * sensação de que o desenho escapa do cursor.
 */
describe('zoom', () => {
  it('mantém fixo o ponto sob o cursor', () => {
    const cursor = { x: 610, y: 120 };
    const antes = paraMundo(cursor.x, cursor.y, TELA, NEUTRA);

    const depois = aproximar(NEUTRA, cursor.x, cursor.y, -400);
    const mundo = paraMundo(cursor.x, cursor.y, TELA, depois);

    expect(depois.escala).toBeGreaterThan(1);
    expect(mundo.x).toBeCloseTo(antes.x, 6);
    expect(mundo.y).toBeCloseTo(antes.y, 6);
  });

  it('respeita os dois limites de escala', () => {
    expect(comEscala(NEUTRA, 1e6, 0, 0).escala).toBe(ESCALA_MAXIMA);
    expect(comEscala(NEUTRA, 1e-6, 0, 0).escala).toBe(ESCALA_MINIMA);
  });
});

/**
 * ATENÇÃO: É a diferença entre "enquadrar" e "voltar à escala 1": depois de isolar um
 * parlamentar sobram poucos pontos, e voltar à escala 1 mostraria o vazio onde
 * o grafo inteiro costumava estar.
 */
describe('enquadrar', () => {
  it('põe a nuvem inteira dentro da tela', () => {
    const pontos = [
      { x: -0.9, y: -0.4 },
      { x: 0.8, y: 0.6 },
      { x: 0.1, y: 0.05 },
    ];

    const camera = enquadrar(pontos, TELA);

    for (const ponto of pontos) {
      const p = paraTela(ponto.x, ponto.y, TELA, camera);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(TELA.largura);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(TELA.altura);
    }
  });

  it('vai atrás de um punhado de nós num canto', () => {
    const canto = [
      { x: 0.80, y: 0.80 },
      { x: 0.84, y: 0.86 },
    ];

    const camera = enquadrar(canto, TELA);

    expect(camera.escala).toBeGreaterThan(3);
    const centro = paraTela(0.82, 0.83, TELA, camera);
    expect(centro.x).toBeCloseTo(TELA.largura / 2, 0);
    expect(centro.y).toBeCloseTo(TELA.altura / 2, 0);
  });

  it('um nó só não divide por zero', () => {
    const camera = enquadrar([{ x: 0.2, y: -0.3 }], TELA);

    expect(Number.isFinite(camera.escala)).toBe(true);
    expect(Number.isFinite(camera.x)).toBe(true);
    expect(camera.escala).toBeLessThanOrEqual(ESCALA_MAXIMA);
  });

  it('sem nenhum ponto devolve a câmera neutra', () => {
    expect(enquadrar([], TELA)).toEqual(NEUTRA);
  });
});

/**
 * Sem prender a projeção ao segmento, a aresta teria alcance infinito e o cursor
 * acertaria ligações que estão do outro lado da tela.
 */
describe('distância ao segmento', () => {
  it('mede a perpendicular quando o pé cai dentro', () => {
    expect(distanciaAoSegmento(5, 3, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(3);
  });

  it('mede até a ponta quando o pé cai fora', () => {
    expect(distanciaAoSegmento(20, 0, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(10);
  });

  it('segmento degenerado vira distância ao ponto', () => {
    expect(distanciaAoSegmento(3, 4, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

/**
 * Dedos se afastando ao dobro da distância: aproxima 2x.
 *
 * DECISÃO: O ponto entre os dedos fica parado: é o que faz a pinça parecer segurar o desenho.
 */
describe('pinça de dois dedos', () => {
  const camera = { escala: 1, x: 0, y: 0 };

  it('afastar os dedos aproxima na mesma razão', () => {
    const depois = pinca(camera, [{ x: 90, y: 100 }, { x: 110, y: 100 }], [{ x: 80, y: 100 }, { x: 120, y: 100 }]);

    expect(depois.escala).toBeCloseTo(2);
  });

  it('o ponto entre os dedos não sai do lugar', () => {
    const depois = pinca(camera, [{ x: 90, y: 100 }, { x: 110, y: 100 }], [{ x: 80, y: 100 }, { x: 120, y: 100 }]);
    const meio = { x: 100, y: 100 };

    expect((meio.x - depois.x) / depois.escala).toBeCloseTo((meio.x - camera.x) / camera.escala);
  });

  it('dois dedos andando juntos arrastam o desenho, sem aproximar', () => {
    const depois = pinca(camera, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 5, y: 7 }, { x: 15, y: 7 }]);

    expect(depois.escala).toBeCloseTo(1);
    expect(depois.x).toBeCloseTo(5);
    expect(depois.y).toBeCloseTo(7);
  });
});

/**
 * MEDIDO: O grafo da Câmara: uma nuvem no meio e uns poucos isolados nas bordas.
 */
describe('enquadrarMiolo', () => {
  function nuvemComIsolados() {
    const nuvem = Array.from({ length: 200 }, (_, i) => ({
      x: -0.3 + ((i * 37) % 60) / 100,
      y: -0.1 + ((i * 53) % 20) / 100,
    }));
    const isolados = [
      { x: -0.98, y: -0.9 }, { x: 0.97, y: 0.95 }, { x: -0.95, y: 0.9 }, { x: 0.99, y: -0.97 },
    ];
    return { nuvem, isolados, todos: [...nuvem, ...isolados] };
  }

  it('abre mais perto que enquadrar tudo: os isolados das bordas não ditam o zoom', () => {
    const { todos } = nuvemComIsolados();

    expect(enquadrarMiolo(todos, TELA).escala).toBeGreaterThan(enquadrar(todos, TELA).escala * 2);
  });

  it('a nuvem inteira continua dentro da tela', () => {
    const { nuvem, todos } = nuvemComIsolados();
    const camera = enquadrarMiolo(todos, TELA);

    for (const ponto of nuvem) {
      const p = paraTela(ponto.x, ponto.y, TELA, camera);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(TELA.largura);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(TELA.altura);
    }
  });

  it('com poucos pontos, não corta nada: é o mesmo que enquadrar', () => {
    const poucos = [{ x: 0.8, y: 0.8 }, { x: 0.84, y: 0.86 }];

    expect(enquadrarMiolo(poucos, TELA)).toEqual(enquadrar(poucos, TELA));
  });
});
