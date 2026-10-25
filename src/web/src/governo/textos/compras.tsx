import type { ReactNode } from 'react';
import { TermoComponent } from '../../comum/componentes/Termo';

/** Os textos da aba Compras e contratos de Governo federal. */
export const TEXTOS_DAS_COMPRAS = {
  titulo: 'Compras e contratos',
  subtitulo: 'Os contratos que o governo federal publicou no Diário Oficial',
  carregando: 'Carregando os contratos',
  erro: 'Não foi possível carregar os contratos agora. Tente de novo em alguns minutos.',
  semDados: 'Os contratos ainda não foram carregados.',
  rotuloDoPeriodo: 'Período dos contratos',
  escopo: (periodo: string) => `Contratos do Executivo federal publicados ${periodo}.`,

  resposta: (periodo: string, contratos: string, valor: ReactNode): ReactNode => (
    <>
      {periodo}, o governo federal publicou <strong>{contratos} contratos</strong>, que somam <strong>{valor}</strong>.
    </>
  ),
  semModalidade: (valor: string): ReactNode => (
    <>
      Em {valor} o Portal não diz a <TermoComponent nome="modalidadeDeCompra">modalidade de compra</TermoComponent>, então
      não dá para saber se houve licitação.
    </>
  ),
  sigilosos: (contratos: string, valor: string): ReactNode => (
    <>
      {contratos} contratos, perto de {valor}, são <TermoComponent nome="contratoSigiloso">sigilosos</TermoComponent>.
    </>
  ),
  divergentes: (contratos: string, valor: string): ReactNode => (
    <>
      {contratos} contratos têm <TermoComponent nome="erroDeDigitacao">erro de digitação</TermoComponent> no valor.
      Contamos o menor dos dois valores, e os {valor} a mais ficam fora.
    </>
  ),
  valorDoContrato: (
    <>
      Usamos o valor final de cada contrato, já com os <TermoComponent nome="aditivo">aditivos</TermoComponent>. Contrato
      publicado de novo conta de novo, como no Portal.
    </>
  ),

  valorDosContratos: 'Valor dos contratos',
  outros: 'os demais',
  verTodos: (quantos: number) => `Ver os ${quantos}`,
  contratosNoAno: (contratos: string) => `${contratos} contratos`,
  porAno: 'Por ano',
  porAnoNota: 'Em reais de cada ano, sem correção pela inflação.',
  porModalidade: 'Por modalidade de compra',
  porOrgao: 'Por órgão',
  contratados: 'Empresas com mais dinheiro em contrato',
  /** MEDIDO em 2026-10-24: 43 empresas contratadas vêm do Portal com o nome vazio, todas com CNPJ. */
  semNome: 'Nome não publicado pelo Portal',
  contratos: (n: string) => `${n} contratos`,
  rotuloDaProcedencia: (periodo: string) => `Contratos publicados, ${periodo}`,
  fonte: 'Compras e contratos',
  portal: '(Portal da Transparência).',
} as const;
