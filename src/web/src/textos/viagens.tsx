import type { ReactNode } from 'react';

/** Os textos da aba Viagens de Governo federal. */
export const TEXTOS_DAS_VIAGENS = {
  titulo: 'Viagens a serviço',
  subtitulo: 'Diárias e passagens que o governo federal pagou, órgão por órgão',
  carregando: 'Carregando as viagens',
  erro: 'Não foi possível carregar as viagens agora. Tente de novo em alguns minutos.',
  semDados: 'As viagens ainda não foram carregadas.',
  rotuloDoPeriodo: 'Período das viagens',
  escopo: (periodo: string) => `Viagens a serviço do Executivo federal ${periodo}, pelo que foi pago.`,

  resposta: (periodo: string, total: string, viagens: string): ReactNode => (
    <>
      {periodo}, o governo federal pagou <strong>{total}</strong> em {viagens} viagens a serviço.
    </>
  ),
  diarias: 'Diárias',
  diariasDefinicao: 'Pagam hospedagem, alimentação e deslocamento na cidade',
  passagens: 'Passagens',
  passagensDefinicao: 'Avião, ônibus e outros meios de transporte',
  outros: 'Seguro e restituição',
  outrosDefinicao: 'Seguro de viagem e o que o servidor adiantou e recebeu de volta',
  hospedagem:
    'Hospedagem não aparece separada: no serviço público federal ela é paga pela diária, junto com alimentação e ' +
    'deslocamento na cidade (Decreto 5.992/2006).',
  sigiloso: (valor: string) =>
    `${valor} foram pagos em viagens que o Portal publica com o órgão "Sigiloso": o valor aparece, quem viajou e de que órgão não.`,
  urgentes: (urgentes: string, viagens: string) => `${urgentes} de ${viagens} viagens foram marcadas como urgentes.`,

  porAno: 'Por ano',
  porAnoNota: 'Em reais de cada ano, sem correção pela inflação.',
  porOrgao: 'Por órgão',
  linhaDoOrgao: (viagens: string) => `${viagens} viagens`,
  destinos: 'Para onde mais foram, no Brasil',
  destinosNoExterior: 'Para onde mais foram, no exterior',
  chegadas: (chegadas: string) => `${chegadas} chegadas`,
  notaDosDestinos: 'Conta chegadas, não pessoas: uma viagem de ida e volta chega a dois lugares.',
  fonte: 'Viagens a serviço',
  portal: '(Portal da Transparência).',
} as const;
