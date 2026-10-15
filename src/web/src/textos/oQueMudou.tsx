import type { ReactNode } from 'react';

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto da seção "O que mudou" do Início, sobre quem a pessoa segue. */
export const TEXTOS_DO_QUE_MUDOU = {
  titulo: 'O que mudou',
  janela: (de: string, ate: string, carga: string | null): ReactNode => (
    <>
      Sobre quem você segue. Votos de {de} a {ate}
      {carga && <>; base atualizada em {carga}</>}.
    </>
  ),
  nadaNovo: (carga: string | null) => `Nada novo desde a última atualização${carga ? `, em ${carga}` : ''}.`,
  orgao: { CAMARA: 'Câmara dos Deputados', SENADO: 'Senado Federal' },
  semana: (de: string, ate: string) => `${de} a ${ate}`,
  votouNaSemana: (quem: ReactNode, votou: number, ausente: number | null, justificado: number | null): ReactNode => (
    <>
      {quem} votou em <strong>{votou}</strong> {plural(votou, 'votação', 'votações')} de plenário
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
    quem: ReactNode,
    voto: string,
    proposicao: string | null,
    bancada: string,
    partido: string,
    orientacao: string,
    descricao: string | null,
  ): ReactNode => (
    <>
      {quem} votou <strong>{voto}</strong>
      {proposicao ? <> na {proposicao}</> : ''}; a bancada {bancada}, do {partido}, orientou <strong>{orientacao}</strong>.
      {descricao && <span className="novidade-detalhe">{descricao}</span>}
    </>
  ),
  registroDaVotacao: 'registro da votação',
  trocou: (quem: ReactNode, novo: string, desde: string, anterior: string): ReactNode => (
    <>
      {quem} votou pelo <strong>{novo}</strong> a partir de {desde}; antes, pelo {anterior}.
    </>
  ),
  gastouNaCota: (quem: ReactNode, total: string, mes: string, maior: string, categoria: string): ReactNode => (
    <>
      {quem} gastou <strong>{total}</strong> da cota em {mes}; o maior gasto, {maior} com {categoria}.
    </>
  ),
  fonteDaCota: (orgao: string, senado: boolean) => `${orgao} · ${senado ? 'CEAPS' : 'CEAP'}`,
  cotaParlamentar: 'Cota parlamentar',
  emendaPaga: (quem: ReactNode, pago: string, mes: string, destino: string | null, lugar: string | null): ReactNode => (
    <>
      {quem}: <strong>{pago}</strong> pagos em emendas em {mes}
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
