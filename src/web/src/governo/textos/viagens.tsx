import type { ReactNode } from 'react';
import { TermoComponent } from '../../comum/componentes/Termo';

/** Os textos da aba Viagens de Governo federal. */
export const TEXTOS_DAS_VIAGENS = {
  titulo: 'Viagens a serviço',
  subtitulo: 'Diárias e passagens que o governo federal pagou, órgão por órgão',
  carregando: 'Carregando as viagens',
  erro: 'Não foi possível carregar as viagens agora. Tente de novo em alguns minutos.',
  semDados: 'As viagens ainda não foram carregadas.',
  rotuloDoPeriodo: 'Período das viagens',
  rotuloDoOrgao: 'Órgão',
  todosOsOrgaos: 'Todos os órgãos',
  soOExecutivo: 'Só o Executivo federal. Câmara, Senado e Judiciário publicam as viagens deles em outro lugar.',
  escopo: (periodo: string) => `Viagens a serviço do Executivo federal ${periodo}, pelo que foi pago.`,

  resposta: (periodo: string, total: ReactNode, viagens: string): ReactNode => (
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
  hospedagem: (
    <>
      A hospedagem está dentro da <TermoComponent nome="diaria">diária</TermoComponent>.
    </>
  ),
  sigiloso: (valor: string) =>
    `${valor} foram pagos em viagens que o Portal publica com o órgão "Sigiloso" e que não deu para atribuir a nenhum órgão.`,
  sigilosoAtribuido: (valor: string): ReactNode => (
    <>
      {valor} vieram com o <TermoComponent nome="orgaoSigiloso">órgão "Sigiloso"</TermoComponent> e estão somados no órgão
      de cada viagem.
    </>
  ),
  urgentes: (urgentes: string, viagens: string) => `${urgentes} de ${viagens} viagens foram marcadas como urgentes.`,

  composicao: 'Para onde foi o dinheiro das viagens',
  porAno: 'Por ano',
  porAnoNota: 'Em reais de cada ano, sem correção pela inflação.',
  porOrgao: 'Por órgão',
  outrosOrgaos: 'os demais órgãos',
  verOsOrgaos: (quantos: number) => `Ver os ${quantos} órgãos que mais gastaram`,
  linhaDoOrgao: (viagens: string) => `${viagens} viagens`,
  destinos: 'Para onde mais foram, no Brasil',
  destinosNoExterior: 'Para onde mais foram, no exterior',
  chegadas: (chegadas: string) => `${chegadas} chegadas`,
  notaDosDestinos: 'Conta chegadas: uma viagem de ida e volta conta duas.',
  rotuloDaProcedencia: (periodo: string) => `Viagens a serviço, ${periodo}`,
  fonte: 'Viagens a serviço',
  portal: '(Portal da Transparência).',
} as const;
