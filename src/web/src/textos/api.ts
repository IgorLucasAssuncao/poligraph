/** Os nomes das casas, e as mensagens dos erros que a camada de acesso à API levanta. */
export const TEXTOS_DA_API = {
  casas: {
    CAMARA: { nome: 'Câmara dos Deputados', doNome: 'da Câmara dos Deputados', plural: 'deputados', singular: 'deputado' },
    SENADO: { nome: 'Senado Federal', doNome: 'do Senado Federal', plural: 'senadores', singular: 'senador' },
  },
  erros: {
    faltaConsentimento: 'Falta o consentimento para seguir.',
    sessaoExpirada: 'Sessão expirada.',
    respostasInsuficientes: 'Responda mais perguntas para o resultado ter significado.',
    sessaoNaoVerificada: 'Falha ao verificar a sessão.',
    avaliacao: (status: number) => `Falha ao registrar avaliação (${status}).`,
    falhaEm: (url: string, status: number) => `Falha em ${url} (${status}).`,
    afinidade: (status: number) => `Falha ao calcular afinidade (${status}).`,
    consulta: (url: string, status: number) => `Falha ao consultar ${url} (${status}).`,
    entidade: (status: number) => `Falha ao consultar a entidade (${status}).`,
    politico: (status: number) => `Falha ao consultar o político (${status}).`,
  },
} as const;
