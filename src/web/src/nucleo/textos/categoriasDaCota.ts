/**
 * O nome que a tela mostra para cada categoria da cota parlamentar, a partir do nome oficial que a
 * Câmara (CEAP) e o Senado (CEAPS) publicam.
 *
 * DECISÃO (2026-10-18, pedido do autor): o nome oficial ia cru para a tela, em maiúsculas, com
 * ponto no fim e vírgula fora do lugar: "Hospedagem ,exceto do parlamentar no distrito federal."
 * A chave é o nome oficial em maiúsculas, sem pontuação no fim; o nome oficial continua no CSV
 * baixado e na consulta do modo auditoria, que precisam casar com a fonte.
 *
 * ATENÇÃO: Categoria nova na fonte cai no nome oficial arrumado (minúsculas, sem ponto no fim) até
 * entrar aqui. MEDIDO em 2026-10-18: as 29 categorias de 2023 a 2026 estão mapeadas.
 */
export const NOMES_DAS_CATEGORIAS_DA_COTA: Record<string, string> = {
  'COMBUSTÍVEIS E LUBRIFICANTES': 'Combustível',
  'PASSAGEM AÉREA - SIGEPA': 'Passagens aéreas',
  'PASSAGEM AÉREA - RPA': 'Passagens aéreas (RPA)',
  'PASSAGEM AÉREA - REEMBOLSO': 'Passagens aéreas (reembolso)',
  'SERVIÇO DE TÁXI, PEDÁGIO E ESTACIONAMENTO': 'Táxi, pedágio e estacionamento',
  'MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR': 'Escritório de apoio',
  'DIVULGAÇÃO DA ATIVIDADE PARLAMENTAR': 'Divulgação do mandato',
  TELEFONIA: 'Telefone',
  'FORNECIMENTO DE ALIMENTAÇÃO DO PARLAMENTAR': 'Alimentação',
  'LOCOMOÇÃO, HOSPEDAGEM, ALIMENTAÇÃO, COMBUSTÍVEIS E LUBRIFICANTES': 'Viagem: transporte, hotel e alimentação',
  'HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL': 'Hotel fora de Brasília',
  'LOCAÇÃO OU FRETAMENTO DE VEÍCULOS AUTOMOTORES': 'Aluguel de carro',
  'ALUGUEL DE IMÓVEIS PARA ESCRITÓRIO POLÍTICO, COMPREENDENDO DESPESAS CONCERNENTES A ELES': 'Aluguel de escritório',
  'PASSAGENS AÉREAS, AQUÁTICAS E TERRESTRES NACIONAIS': 'Passagens',
  'CONTRATAÇÃO DE CONSULTORIAS, ASSESSORIAS, PESQUISAS, TRABALHOS TÉCNICOS E OUTROS SERVIÇOS DE APOIO AO EXERCÍCIO DO MANDATO PARLAMENTAR':
    'Consultorias e assessorias',
  'AQUISIÇÃO DE MATERIAL DE CONSUMO PARA USO NO ESCRITÓRIO POLÍTICO, INCLUSIVE AQUISIÇÃO OU LOCAÇÃO DE SOFTWARE, DESPESAS POSTAIS, AQUISIÇÃO DE PUBLICAÇÕES, LOCAÇÃO DE MÓVEIS E DE EQUIPAMENTOS':
    'Material de escritório',
  'COMPLEMENTAÇÃO DO AUXÍLIO-MORADIA': 'Auxílio-moradia',
  'PASSAGENS TERRESTRES, MARÍTIMAS OU FLUVIAIS': 'Passagens de ônibus e barco',
  'SERVIÇO DE SEGURANÇA PRESTADO POR EMPRESA ESPECIALIZADA': 'Segurança',
  'SERVIÇOS DE SEGURANÇA PRIVADA': 'Segurança',
  'SERVIÇOS POSTAIS': 'Correio',
  'ASSINATURA DE PUBLICAÇÕES': 'Assinatura de jornais e revistas',
  'LOCAÇÃO OU FRETAMENTO DE AERONAVES': 'Aluguel de avião',
  'LOCAÇÃO OU FRETAMENTO DE EMBARCAÇÕES': 'Aluguel de barco',
  'CONSULTORIAS, PESQUISAS E TRABALHOS TÉCNICOS': 'Consultorias e pesquisas',
  'AQUISIÇÃO DE TOKENS E CERTIFICADOS DIGITAIS': 'Certificado digital',
  'PARTICIPAÇÃO EM CURSO, PALESTRA OU EVENTO SIMILAR': 'Cursos e eventos',
  'SEM CATEGORIA': 'Sem categoria',
};
