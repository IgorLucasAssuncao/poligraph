import type { ReactNode } from 'react';
import { TermoComponent } from '../../comum/componentes/Termo';

/** O texto da ficha do parlamentar: cabeçalho, abas, votos, quem vota parecido e o alinhamento. */
export const TEXTOS_DA_FICHA = {
  titulo: 'Parlamentar',
  erro: 'Não foi possível carregar este parlamentar.',
  abas: {
    votos: 'Como vota',
    emendas: 'Emendas',
    cota: 'Cota',
    campanha: 'Campanha',
    linhaDoTempo: 'Linha do tempo',
  },
  rotuloDasAbas: 'Seções do perfil',
  foraDoMandato: (periodo: string) =>
    `Fora do Congresso. Só é possível seguir quem está em exercício na legislatura atual (${periodo}).`,
  senador: 'Senador',
  deputado: 'Deputado',
  paginaNoSenado: 'Página oficial no Senado',
  paginaNaCamara: 'Página oficial na Câmara',
  votosComPosicao: 'Votos com posição',
  votosComPosicaoDefinicao: 'votos com posição, em plenário e comissões',
  descricaoDoGrafo: (casa: string | null | undefined) => (casa === 'SENADO' ? 'Senado' : 'Câmara'),
  tituloDosVotos: 'Votos',

  votos: {
    nenhum: 'Nenhum voto registrado.',
    placeholder: 'Buscar nos votos: assunto, projeto (PEC 45/2019)…',
    rotuloDaBusca: 'Buscar nos votos',
    semRito: 'Esconder votos de rito (requerimento, urgência, adiamento)',
    erroDaBusca: 'Não foi possível buscar agora.',
    buscando: 'Buscando nos votos',
    nenhumComBusca: (busca: string) =>
      `Nenhum voto com “${busca}” nesta legislatura. A busca olha o assunto do projeto, a descrição da votação e o número da matéria.`,
    contagemDaBusca: (mostrados: string, total: number, busca: string) =>
      `${mostrados} ${total === 1 ? 'voto' : 'votos'} com “${busca}”`,
    deTotal: (mostrados: number, total: number) => `${mostrados} de ${total}`,
    contagemSemRito: (mostrados: number, total: number) => `${mostrados} de ${total} registros de voto, sem os de rito`,
    contagem: (mostrados: number, total: number) => `${mostrados} de ${total} registros de voto`,
    semPosicao: (quantos: number) => `, ${quantos} deles sem posição (abstenção, obstrução ou ausência registrada)`,
    baixarEncontrados: 'Baixar os encontrados (CSV)',
    baixarTodos: 'Baixar todos (CSV)',
    arquivo: (pessoa: number) => `votos-${pessoa}.csv`,
    colunas: ['Votação', 'Data', 'Voto', 'Orientação do Governo', 'Matéria', 'Descrição', 'Categoria', 'Proposição', 'Registro', 'Texto integral'],
    rito: (
      <>
        <TermoComponent nome="procedimental">Questão de rito</TermoComponent>: votou o andamento da proposta, como urgência ou
        adiamento
      </>
    ),
    ritoCurto: (
      <>
        <TermoComponent nome="procedimental">Questão de rito</TermoComponent>:{' '}
      </>
    ),
    governoPediu: (orientacao: string, acompanhou: boolean): ReactNode => (
      <>
        Governo pediu <b>{orientacao}</b>
        {!acompanhou && <em> (votou diferente)</em>}
      </>
    ),
    votacoesNaProposicao: (quantas: number) => `${quantas} votações nesta proposição`,
    proposicao: 'proposição',
    registro: 'registro da votação',
    inteiroTeor: 'ler o projeto',
    abstencao: <TermoComponent nome="abstencao">Abstenção</TermoComponent>,
  },

  rotuloDoVoto: {
    sim: 'Sim',
    nao: 'Não',
    abstencao: 'Abstenção',
    ausente: 'Ausente',
  },

  similares: {
    vazio: 'A análise de similaridade ainda não rodou para esta legislatura.',
    titulo: 'Quem vota parecido',
    detalhe: (iguais: number, comuns: number): ReactNode => (
      <>
        votaram igual em <strong>{iguais}</strong> de <strong>{comuns}</strong> votações
      </>
    ),
    verTodos: (quantos: number) => `Ver os ${quantos}`,
  },

  alinhamento: {
    presenca: (
      <>
        <TermoComponent nome="participacao">Presença</TermoComponent> no plenário
      </>
    ),
    votacoes: (porcento: number) => `votações (${porcento}%)`,
    ausencias: (quantas: number) => ` · ${quantas} ausências com licença ou missão`,
    medianaDaCasa: (casa: string | null | undefined, porcento: number) =>
      `mediana ${casa === 'SENADO' ? 'do Senado' : 'da Câmara'}: ${porcento}%`,
    governo: (
      <>
        Seguiu a <TermoComponent nome="orientacao">orientação</TermoComponent> do Governo
      </>
    ),
    partido: (partido: string | null) => `Seguiu a orientação do ${partido}`,
    votacoesOrientadas: (porcento: number) => `votações orientadas (${porcento}%)`,
    basePequena: ' · poucas para tirar conclusão',
    medianaDaCamara: (porcento: number) => `mediana da Câmara: ${porcento}%`,
  },
} as const;
