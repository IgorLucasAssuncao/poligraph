import { describe, expect, it } from 'vitest';
import { buscarTodas, paraCsv } from './exportar';

/**
 * ATENÇÃO: Vírgula entre colunas juntaria tudo numa coluna só no Excel brasileiro.
 */
describe('CSV para planilha em português', () => {
  it('usa ponto e vírgula entre colunas e vírgula no decimal', () => {
    expect(paraCsv(['Área', 'Pago'], [['Saúde', 234.3]])).toBe('Área;Pago\r\nSaúde;234,3');
  });

  it('protege o texto que tem ponto e vírgula ou aspas', () => {
    expect(paraCsv(['Objeto'], [['Reforma; "urgente"']])).toBe('Objeto\r\n"Reforma; ""urgente"""');
  });

  it('célula vazia para o que não existe, e não "null"', () => {
    expect(paraCsv(['A', 'B'], [[null, undefined]])).toBe('A;B\r\n;');
  });
});

/**
 * DECISÃO: Exporta a lista inteira, e não só a página que está na tela.
 */
describe('buscarTodas', () => {
  it('percorre as páginas até o total', async () => {
    const paginas = [[1, 2], [3, 4], [5]];
    const todas = await buscarTodas(async (pagina) => ({
      itens: paginas[pagina - 1] ?? [], pagina, tamanho: 2, total: 5,
    }));

    expect(todas).toEqual([1, 2, 3, 4, 5]);
  });
});
