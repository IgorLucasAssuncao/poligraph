const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/** O texto do sininho do cabeçalho e dos avisos no navegador (Pendência 89). */
export const TEXTOS_DOS_AVISOS = {
  sininho: {
    rotulo: (novas: number) => (novas > 0 ? `Novidades de quem você segue, ${novas} ${plural(novas, 'nova', 'novas')}` : 'Novidades de quem você segue'),
    titulo: 'Novidades de quem você segue',
    nadaNovo: 'Nada novo desde a última atualização.',
    ninguem: 'Você ainda não segue ninguém.',
    procurar: 'Procurar parlamentares',
    verTudo: 'Ver tudo no início',
    erro: 'Não foi possível carregar as novidades agora.',
  },
  navegador: {
    titulo: 'Avisos neste navegador',
    explicacao: 'Um aviso quando alguém que você segue vota contra o partido ou troca de partido, e quando chegam os gastos do mês.',
    ligar: 'Receber avisos neste navegador',
    desligar: 'Parar neste navegador',
    ligado: 'Este navegador recebe avisos.',
    outros: (n: number) => `${n} ${plural(n, 'outro navegador seu recebe', 'outros navegadores seus recebem')} avisos.`,
    semSuporte: 'Este navegador não recebe avisos. No iPhone, adicione o site à tela de início primeiro.',
    bloqueado: 'Os avisos estão bloqueados neste navegador. Libere nas configurações do site, no cadeado da barra de endereço.',
    erro: 'Não deu para ligar os avisos agora. Tente de novo em instantes.',
    ocupado: 'Um momento…',
  },
  conta: {
    revogar: 'Revogar o consentimento dos avisos',
    revogarAjuda: 'Desliga os avisos em todos os seus navegadores e apaga o registro do que já foi avisado.',
    revogado: 'Consentimento revogado. Nenhum navegador seu recebe avisos.',
  },
} as const;
