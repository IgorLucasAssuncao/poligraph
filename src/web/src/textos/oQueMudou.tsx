import type { ReactNode } from 'react';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/**
 * O sujeito da frase: o nome do parlamentar, ou, no modal agrupado por parlamentar, onde o nome
 * já é o título do grupo, só o verbo com maiúscula.
 */
const sujeito = (quem: ReactNode | null, verbo: string): ReactNode =>
  quem ? (
    <>
      {quem} {verbo}
    </>
  ) : (
    verbo.charAt(0).toUpperCase() + verbo.slice(1)
  );

/** O texto das novidades de quem a pessoa segue: o cartão do início, o modal e os fatos. */
export const TEXTOS_DO_QUE_MUDOU = {
  titulo: 'Novidades de quem você segue',
  cartao: {
    novas: (n: number) => `${n} ${plural(n, 'novidade nova', 'novidades novas')}`,
    semNovas: 'Nada novo desde a sua última visita',
    abrir: 'Ver por parlamentar',
  },
  modal: {
    sobre: 'Quem você segue',
    fechar: 'Fechar',
    pessoas: 'Filtrar por parlamentar',
    todos: 'Todos',
    tipos: 'Filtrar por tipo',
    tipo: {
      todos: 'Tudo',
      contra: 'Contra o partido',
      troca: 'Troca de partido',
      cota: 'Cota',
      emenda: 'Emendas',
      semana: 'Votos da semana',
    },
    soNovas: 'Só as novas',
    nova: 'Nova',
    temNova: 'tem novidade',
    nadaNoFiltro: 'Nada com esses filtros.',
    limpar: 'Limpar filtros',
  },
  nadaNovo: (carga: string | null) => `Nada novo desde a última atualização${carga ? `, em ${carga}` : ''}.`,
  orgao: { CAMARA: 'Câmara dos Deputados', SENADO: 'Senado Federal' },
  semana: (de: string, ate: string) => `${de} a ${ate}`,
  votouNaSemana: (quem: ReactNode | null, votou: number, ausente: number | null, justificado: number | null): ReactNode => (
    <>
      {sujeito(quem, 'votou em')} <strong>{votou}</strong> {plural(votou, 'votação', 'votações')} de plenário
      {ausente !== null && ausente > 0 && (
        <>
          ; ausente em <strong>{ausente}</strong>
          {justificado ? ` (${justificado} com justificativa)` : ''}
        </>
      )}
      .
    </>
  ),
  contraOPartido: (
    quem: ReactNode | null,
    voto: string,
    proposicao: string | null,
    bancada: string,
    partido: string,
    orientacao: string,
    descricao: string | null,
  ): ReactNode => (
    <>
      {sujeito(quem, 'votou')} <strong>{voto}</strong>
      {proposicao ? <> na {proposicao}</> : ''}; a bancada {bancada}, do {partido}, orientou <strong>{orientacao}</strong>.
      {descricao && <span className="novidade-detalhe">{descricao}</span>}
    </>
  ),
  registroDaVotacao: 'registro da votação',
  trocou: (quem: ReactNode | null, novo: string, desde: string, anterior: string): ReactNode => (
    <>
      {sujeito(quem, 'votou pelo')} <strong>{novo}</strong> a partir de {desde}; antes, pelo {anterior}.
    </>
  ),
  gastouNaCota: (quem: ReactNode | null, total: string, mes: string, maior: string, categoria: string): ReactNode => (
    <>
      {sujeito(quem, 'gastou')} <strong>{total}</strong> da cota em {mes}; o maior gasto, {maior} com {categoria}.
    </>
  ),
  fonteDaCota: (orgao: string, senado: boolean) => `${orgao} · ${senado ? 'CEAPS' : 'CEAP'}`,
  cotaParlamentar: 'Cota parlamentar',
  emendaPaga: (quem: ReactNode | null, pago: string, mes: string, destino: string | null, lugar: string | null): ReactNode => (
    <>
      {quem && <>{quem}: </>}
      <strong>{pago}</strong> pagos em emendas em {mes}
      {destino && (
        <>
          ; o maior valor para {destino}
          {lugar ? `, ${lugar}` : ''}
        </>
      )}
      .
    </>
  ),
  portal: 'Portal da Transparência',
} as const;
