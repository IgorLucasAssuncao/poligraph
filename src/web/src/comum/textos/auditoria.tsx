import type { ReactNode } from 'react';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto do modo auditoria: o interruptor e o painel de procedência. */
export const TEXTOS_DA_AUDITORIA = {
  interruptor: {
    desligar: 'Desligar o modo auditoria',
    ligar: 'Ligar o modo auditoria: cada número mostra de onde veio',
    rotulo: 'Auditoria',
  },
  verDeOndeVeio: (rotulo: string) => `${rotulo}: ver de onde veio`,
  painel: {
    titulo: 'De onde veio este número',
    fechar: 'Fechar',
    erro: 'Não foi possível ler a procedência agora. Tente de novo em instantes.',
    lendo: 'Lendo os arquivos de origem…',
    comoFoiContado: 'Como foi contado',
    linhas: (linhas: string, numero: number, comCarga: string): ReactNode => (
      <>
        <strong className="dado">{linhas}</strong> {plural(numero, 'linha entrou', 'linhas entraram')} na conta;{' '}
        <strong className="dado">{comCarga}</strong> com o arquivo de origem registrado.
      </>
    ),
    semCarga: (quantas: string, numero: number) =>
      `${quantas} ${plural(numero, 'linha foi gravada', 'linhas foram gravadas')} antes do registro de procedência e não dizem de que arquivo vieram.`,
    arquivos: (quantos: number) => (quantos === 1 ? 'O arquivo de origem' : `Os ${quantos} arquivos de origem`),
    nenhumArquivo: 'Nenhuma linha deste número tem o arquivo de origem registrado.',
    asLinhas: (quantas: number) => (quantas === 1 ? 'A linha' : `As ${quantas} linhas`),
  },
  carga: {
    orgao: 'Órgão',
    arquivo: 'Arquivo',
    baixadoEm: 'Baixado em',
    sha256: 'SHA-256',
    tamanho: 'Tamanho',
    versaoNaFonte: 'Versão na fonte',
    codigoQueLeu: 'Código que leu',
    semVersao: 'anterior ao registro de versão',
    comando: 'Comando',
    baseLegal: 'Base legal',
    linhasDoArquivo: 'Linhas deste arquivo',
    utc: (data: string) => `${data} UTC`,
    megabytes: (valor: string) => `${valor} MB`,
    kilobytes: (valor: string) => `${valor} KB`,
    bytes: (valor: number) => `${valor} bytes`,
  },
} as const;
