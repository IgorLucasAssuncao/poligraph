import type { ReactNode } from 'react';

/** Os textos da aba Compras e contratos de Governo federal. */
export const TEXTOS_DAS_COMPRAS = {
  titulo: 'Compras e contratos',
  subtitulo: 'Os contratos que o governo federal publicou no Diário Oficial',
  carregando: 'Carregando os contratos',
  erro: 'Não foi possível carregar os contratos agora. Tente de novo em alguns minutos.',
  semDados: 'Os contratos ainda não foram carregados.',
  rotuloDoPeriodo: 'Período dos contratos',
  escopo: (periodo: string) => `Contratos do Executivo federal publicados ${periodo}.`,

  resposta: (periodo: string, contratos: string, valor: string): ReactNode => (
    <>
      {periodo}, o governo federal publicou <strong>{contratos} contratos</strong>, que somam <strong>{valor}</strong>.
    </>
  ),
  semModalidade: (valor: string) =>
    `${valor} vêm do Portal sem a modalidade de compra: não dá para saber se houve licitação.`,
  sigilosos: (contratos: string, valor: string) =>
    `${contratos} contratos, cerca de ${valor}, têm contratado e objeto protegidos por sigilo.`,
  divergentes: (contratos: string, valor: string) =>
    `Em ${contratos} contratos o Portal publica um valor inicial e um final que diferem mais de 100 vezes, ` +
    `o que é erro de digitação. Esses contratos entram com o menor dos dois; os ${valor} do maior ficam fora da soma.`,
  valorDoContrato:
    'O valor de cada contrato é o final, depois dos aditivos. Republicação de contrato entra de novo, como o Portal publica.',

  porAno: 'Por ano',
  porAnoNota: 'Em reais de cada ano, sem correção pela inflação.',
  porModalidade: 'Por modalidade de compra',
  porOrgao: 'Por órgão',
  contratados: 'Empresas com mais dinheiro em contrato',
  contratos: (n: string) => `${n} contratos`,
  fonte: 'Compras e contratos',
  portal: '(Portal da Transparência).',
} as const;
