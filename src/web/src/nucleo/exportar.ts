import type { PaginaDe } from './api';

type Celula = string | number | null | undefined;

/**
 * CSV no formato que o Excel e o LibreOffice em português abrem sem pergunta.
 *
 * ATENÇÃO: Ponto e vírgula entre colunas e vírgula no decimal: com vírgula entre colunas, o
 * Excel brasileiro juntaria tudo numa coluna só, e "1234.56" viraria mil duzentos e
 * trinta e quatro mil. O BOM no começo é o que faz o Excel ler os acentos.
 */
export function paraCsv(cabecalho: string[], linhas: Celula[][]): string {
  const celula = (valor: Celula) => {
    if (valor === null || valor === undefined) return '';
    const texto = typeof valor === 'number' ? String(valor).replace('.', ',') : valor;
    return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  return [cabecalho, ...linhas].map((linha) => linha.map(celula).join(';')).join('\r\n');
}

/** Oferece o CSV para baixar, com o nome dado. */
export function baixarCsv(nome: string, cabecalho: string[], linhas: Celula[][]): void {
  const arquivo = new Blob(['﻿' + paraCsv(cabecalho, linhas)], { type: 'text/csv;charset=utf-8' });
  const endereco = URL.createObjectURL(arquivo);

  const link = document.createElement('a');
  link.href = endereco;
  link.download = nome;
  link.click();

  URL.revokeObjectURL(endereco);
}

/**
 * Busca todas as páginas de uma lista, para exportar a lista inteira — não só o que já
 * está na tela.
 */
export async function buscarTodas<T>(
  buscar: (pagina: number) => Promise<PaginaDe<T>>,
): Promise<T[]> {
  const itens: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const atual = await buscar(pagina);
    itens.push(...atual.itens);
    if (atual.itens.length === 0 || itens.length >= atual.total) return itens;
  }
}
