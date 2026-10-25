import type { ReactNode } from 'react';

/** O texto do questionário e da avaliação que aparece depois do resultado. */
export const TEXTOS_DO_QUESTIONARIO = {
  opcoes: { concordo: 'Concordo', discordo: 'Discordo', naoSei: 'Não sei' },
  erroAoCarregar: 'Não foi possível carregar as perguntas.',
  carregando: 'Carregando as perguntas',
  respondidas: (opinadas: number, total: number) => `${opinadas} de ${total} respondidas`,
  pergunta: (numero: number, previstas: number) => `Pergunta ${numero} de ${previstas}`,
  escolhendo: 'Escolhendo as próximas perguntas…',
  respostasInsuficientes: (minimo: number) => `Responda ao menos ${minimo} perguntas para o resultado fazer sentido.`,
  erroAoCalcular: 'Não foi possível calcular agora. Tente de novo.',
  voceConcorda: 'Você concorda?',
  respostaRegistrada: 'Resposta registrada.',
  voltar: '← Voltar',
  pronto: 'Pronto',
  opinou: (opinadas: number, total: number): ReactNode => (
    <>
      Você opinou em <strong>{opinadas}</strong> de {total} afirmações. Agora vamos comparar com o voto registrado de cada
      deputado e senador.
    </>
  ),
  calculando: 'Calculando…',
  verResultado: 'Ver meu resultado',
  rever: 'Rever respostas',

  avaliacao: {
    obrigado: '✓ Obrigado. Sua avaliação ajuda a medir se o método funciona.',
    voltar: 'Voltar ao resultado',
    titulo: 'Ajude a avaliar',
    subtitulo: 'Duas perguntas rápidas e opcionais, para a pesquisa.',
    combinou: 'O resultado combinou com o que você esperava?',
    sim: 'Combinou',
    nao: 'Não combinou',
    posicao: 'Como você descreveria sua posição política?',
    escala: [
      [-3, 'Esquerda'],
      [-2, 'Centro-esquerda'],
      [-1, 'Centro-esq. leve'],
      [0, 'Centro'],
      [1, 'Centro-dir. leve'],
      [2, 'Centro-direita'],
      [3, 'Direita'],
    ] as [number, string][],
    privacidade: (
      <>
        Estas duas respostas são gravadas <strong>sem ligação com a sua conta</strong>. Servem só para medir se o método
        acerta.
      </>
    ),
    erro: 'Não foi possível enviar. Tente de novo.',
    enviar: 'Enviar avaliação',
    agoraNao: 'Agora não',
  },
} as const;
