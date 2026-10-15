import { Link } from 'react-router-dom';

/** O texto da tela de entrada e da página da conta. */
export const TEXTOS_DA_CONTA = {
  login: {
    titulo: 'Quem vota como você?',
    chamada: (
      <>
        Compare seu voto com o <strong>voto registrado</strong> de deputados e senadores e veja para onde vai o
        dinheiro público.
      </>
    ),
    opcional: 'Só precisa entrar para seguir parlamentares.',
    semConta: 'Continuar sem conta',
    paraOInicio: 'Ir para a página inicial',
    oQueTem: [
      'Um questionário com votações reais do plenário',
      'Votos, cota, emendas e campanha de cada parlamentar',
      'Quem vota parecido com quem',
      'Emendas por cidade e gastos do governo federal',
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
    dinheiro: 'dinheiro do mandato',
    dinheiroDetalhe: (cota: string, emendas: string, de: number, ate: number) =>
      `${cota} de cota e ${emendas} pagos em emendas, ${de} a ${ate}`,
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
