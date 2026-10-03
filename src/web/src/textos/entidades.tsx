import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TermoComponent } from '../componentes/Termo';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto da página de uma entidade e da lista de entidades. */
export const TEXTOS_DAS_ENTIDADES = {
  entidade: {
    erro: 'Não foi possível carregar esta entidade agora.',
    carregando: 'Carregando a entidade',
    naoRecebeu: (
      <>
        Este CNPJ não recebeu dinheiro de emenda nos anos carregados. <Link to="/entidades">Ver todas as entidades</Link>
      </>
    ),
    rotuloDosNumeros: 'O que a entidade recebeu',
    recebeu: 'Recebeu de emendas',
    recebeuDefinicao: (emendas: number, de: number | string, ate: number | string): ReactNode => (
      <>
        em {emendas} {plural(emendas, 'emenda', 'emendas')}, de {de} a {ate}
      </>
    ),
    semAno: '—',
    rotuloDaProcedencia: (nome: string) => `Recebido por ${nome}`,
    sede: 'Sede',
    sedeDefinicao: (
      <>
        <TermoComponent nome="sedeDoFavorecido">onde fica registrada</TermoComponent>, que pode ser diferente de onde aplicou
        o dinheiro
      </>
    ),
    semSede: '—',
    porAno: 'Por ano',
    porAnoAjuda: 'O ano é o da emenda: uma emenda de 2024 paga em 2025 conta em 2024.',
    quemMandou: 'Quem mandou o dinheiro',
    cnpj: (formatado: string) => `CNPJ ${formatado} ·`,
    noPortal: 'tudo o que esta entidade recebeu, no Portal da Transparência',
  },

  parlamentares: {
    titulo: 'Deputados e senadores',
    resumo: (quantos: number, valor: string): ReactNode => (
      <>
        {quantos} parlamentares, {valor} em <TermoComponent nome="emendaIndividual">emendas individuais</TermoComponent>. O
        nome leva à página de cada um.
      </>
    ),
    baixar: 'Baixar a lista (CSV)',
    arquivo: (cnpj: string) => `entidade-${cnpj}-parlamentares.csv`,
    colunas: ['Parlamentar', 'Partido', 'UF', 'Casa', 'Emendas', 'Recebido'],
  },

  naCota: {
    titulo: 'Também aparece na cota parlamentar',
    aviso: (total: string, notas: number): ReactNode => (
      <>
        Parlamentares pagaram {total} a esta mesma entidade com a <TermoComponent nome="cota">cota</TermoComponent>, em{' '}
        {notas} {plural(notas, 'nota', 'notas')}. Isso, sozinho, não indica irregularidade: a cota paga despesas do
        escritório à própria prefeitura, passagens à companhia aérea, combustível ao posto.
      </>
    ),
    senado: 'Senado',
    camara: 'Câmara',
    notas: (quantas: number) => `· ${quantas} ${plural(quantas, 'nota', 'notas')}`,
  },

  convenios: {
    titulo: 'O que foi combinado',
    assinados: (quantos: number) =>
      `${quantos} ${plural(quantos, 'convênio assinado', 'convênios assinados')} com dinheiro de emenda.`,
    objetoNaoInformado: 'Objeto não informado',
    assinadoEm: (data: string) => `assinado em ${data}`,
    convenio: (numero: string) => `convênio ${numero}`,
    combinados: (valor: string) => `${valor} combinados`,
    liberados: (valor: string) => `${valor} liberados`,
  },

  lista: {
    titulo: 'Entidades',
    subtitulo: 'Quem recebeu dinheiro de emenda parlamentar',
    buscar: 'Buscar entidade',
    placeholder: 'Nome ou CNPJ',
    tipo: 'Tipo de entidade',
    erro: 'Não foi possível carregar as entidades agora.',
    carregando: 'Carregando as entidades',
    quantas: (total: string, numero: number) =>
      `${total} ${plural(numero, 'entidade', 'entidades')}, da que mais recebeu à que menos recebeu, somando as emendas de todos os anos carregados.`,
    nenhuma: 'Nenhuma entidade com esse nome recebeu dinheiro de emenda.',
    fontes: 'Fontes:',
    paraASede: ', para a sede.',
    grupos: {
      todas: 'Todas',
      semFinsLucrativos: 'Associações e fundações',
      empresas: 'Empresas',
      prefeituras: 'Prefeituras',
      governosEstaduais: 'Governos estaduais',
      outras: 'Outras',
    },
  },
} as const;
