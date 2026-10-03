import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** O texto da tela de entrada e da página da conta. */
export const TEXTOS_DA_CONTA = {
  login: {
    titulo: 'Quem vota como você?',
    chamada: (
      <>
        Compare sua posição com o <strong>voto registrado em plenário</strong> de deputados e senadores, votação por
        votação.
      </>
    ),
    opcional: (voltar: string): ReactNode => (
      <>
        A conta serve para <strong>seguir parlamentares</strong>. O questionário e todos os dados funcionam sem ela.{' '}
        <Link to={voltar}>Continuar sem conta</Link>
      </>
    ),
    oQueTem: [
      'Um questionário montado a partir de votações nominais reais',
      'O perfil de cada parlamentar, com histórico de votos e gastos do mandato',
      'O desenho de quem vota parecido com quem',
    ],
    privacidade: (
      <>
        Ao entrar, guardamos seu nome, e-mail e foto do Google, e a lista de quem você seguir.{' '}
        <strong>A lista de quem você segue indica posição política</strong> e é tratada como dado sensível. Você pode apagar
        tudo a qualquer momento. <Link to="/privacidade">Política de privacidade</Link>
        {' · '}
        <Link to="/metodologia">Como calculamos</Link>
      </>
    ),
    naoERecomendacao: 'Não é recomendação de voto.',
    base: (votos: string, votacoes: string) => `${votos} votos em ${votacoes} votações`,
  },

  conta: {
    titulo: 'Conta',
    semNome: 'Sem nome',
    entradaGoogle: 'Entrada feita com a sua conta Google.',
    sessao: 'Sessão',
    sair: 'Sair deste aparelho',
    seusDados: 'Seus dados',
    guardamos: (
      <>
        Guardamos seu nome, e-mail e foto do Google, e a lista de quem você segue.{' '}
        <Link to="/privacidade">Veja o detalhe</Link>.
      </>
    ),
    revogarAjuda:
      'Revogar o consentimento de seguir apaga a lista de quem você segue. Para seguir de novo, o site pede o consentimento outra vez.',
    revogado: 'Consentimento revogado. A lista foi apagada.',
    revogar: 'Revogar o consentimento de seguir',
    apagar: 'Apagar minha conta',
    confirmacao: (
      <>
        <strong>Isto apaga tudo:</strong> sua conta, a lista de quem você segue e seus consentimentos. Não dá para desfazer.
      </>
    ),
    apagarDefinitivamente: 'Apagar definitivamente',
    cancelar: 'Cancelar',
    erro: 'Não foi possível concluir agora. Tente de novo.',
  },
} as const;
