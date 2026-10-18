/**
 * Textos jurídicos do projeto.
 *
 * RISCO: `VERSAO_CONSENTIMENTO` é gravada em `consentimento.versao` a cada aceite.
 *
 * ATENÇÃO: SEMPRE incremente a versão ao mudar qualquer texto abaixo. Sem isso não há como
 * responder "consentiu com o quê, exatamente?" — que é a pergunta que a LGPD art. 8º §2
 * joga no colo do controlador, porque o ônus da prova do consentimento é dele.
 */
export const VERSAO_CONSENTIMENTO = 'v7-2026-10-18';

/**
 * A versão do aviso de medição (Clarity), separada da política (2026-10-18).
 *
 * DECISÃO: Só incremente quando mudar o que o aviso pede: o `TEXTO_CONSENTIMENTO` ou a parte da
 * política sobre medição de uso. Usando a versão da política, toda mudança em outro assunto (como os
 * avisos no navegador, na v7) reabria o aviso para todo mundo, e quem já tinha escolhido o via de
 * novo sem nada novo para decidir.
 */
export const VERSAO_DO_AVISO_DE_MEDICAO = 'v6-2026-10-15';

export const CONTATO = 'igorlucas1217@gmail.com';

/**
 * ATENÇÃO: Rascunho para revisão do orientador e, se possível, de alguém da área jurídica.
 * Não é peça jurídica revisada — é o melhor esforço técnico de descrever com precisão
 * o que o sistema realmente faz.
 */
export const POLITICA_DE_PRIVACIDADE = `
# Política de Privacidade

**Versão ${VERSAO_CONSENTIMENTO}** · Última atualização: 18 de outubro de 2026.

O Registro Aberto é um trabalho de conclusão de curso. Ele compara as respostas de um
questionário com o voto registrado em plenário de deputados federais e senadores,
a partir dos dados abertos da Câmara dos Deputados e do Senado Federal.

Este texto descreve o que o sistema faz com dados pessoais.

---

## 1. A conta é opcional

A conta serve para uma coisa: **seguir parlamentares**. O questionário, o resultado e
todos os dados públicos funcionam sem entrar.

Durante o período eleitoral de 2026, por cautela com a legislação eleitoral, o site pode
exigir conta para qualquer uso. Nesse período, só esta política e a explicação do método
ficam acessíveis sem login.

**As respostas do questionário não são gravadas.** O cálculo do resultado acontece na
requisição, com as respostas enviadas naquele momento, e nem as respostas nem o
resultado ficam no banco.

---

## 2. Dados recebidos do Google

Entrar tem uma finalidade: manter a lista de parlamentares acompanhados, entre acessos e
entre dispositivos.

| Dado | Finalidade |
|---|---|
| Identificador da conta | Reconhecer a mesma pessoa em acessos seguintes |
| E-mail | Mostrar à pessoa qual conta está usando. **Nenhum e-mail é enviado** |
| Nome | Identificar a pessoa na interface |
| Foto do perfil | Exibir o avatar |
| Idioma | Ajustar a interface |

A autenticação acontece no Google. O sistema não recebe senha. O token de identidade
devolvido pelo Google é validado e descartado na mesma requisição: nenhum token é
gravado.

---

## 3. A lista de parlamentares acompanhados

Seguir um parlamentar grava essa escolha vinculada à conta.

A Lei Geral de Proteção de Dados classifica dado sobre convicção política como **dado
pessoal sensível** (art. 5º, II), categoria com exigências mais estritas de tratamento.
Esta lista é tratada nessa condição:

- é usada para montar a lista exibida no site, e para nada além disso;
- não é vendida, cedida, compartilhada nem usada para publicidade;
- não alimenta segmentação de nenhum tipo;
- pode ser apagada a qualquer momento, item a item ou por inteiro.

A base legal é o consentimento (art. 7º, I e art. 11, I). Ele é pedido na primeira vez
que você segue alguém, e de novo quando este texto muda; o site guarda a data e a versão
do texto aceito. Pode ser revogado a qualquer tempo na página da conta, e a lista é
apagada junto.

---

## 4. Avisos no navegador

Quem segue parlamentares pode receber um aviso no navegador quando há novidade sobre eles:
voto contra a orientação do partido, troca de partido, e os gastos da cota e as emendas pagas
de cada mês. É opcional, vem desligado, e tem consentimento próprio, separado do de seguir.

Ao ligar, o site guarda:

- o endereço que o seu navegador recebeu do serviço de avisos do fabricante (Google, Mozilla ou
  Apple) e as duas chaves que cifram o aviso;
- quais novidades já foram avisadas, para não repetir. Esse registro diz sobre quem você foi
  avisado e é apagado depois de 90 dias.

O aviso sai cifrado do servidor e só o seu navegador consegue ler. O serviço do fabricante
entrega, mas não vê o conteúdo. O texto nunca traz nome de parlamentar, porque aparece na tela
de bloqueio: diz só quantas novidades há.

Você pode desligar neste navegador, ou revogar o consentimento na página da conta, o que apaga
todos os navegadores inscritos e o registro do que já foi avisado. Deixar de seguir alguém
apaga também o registro dos avisos sobre essa pessoa.

---

## 5. E-mail

O site não envia e-mail. Um resumo de notícias por e-mail chegou a ser planejado e foi
retirado em 2 de outubro de 2026. Os avisos sobre quem você segue chegam pelo navegador (seção 4). Se algum aviso por e-mail voltar, ele será opcional,
virá desativado, terá consentimento próprio, e esta política será atualizada antes.

---

## 6. Medição de uso

A interface é avaliada com ferramenta de análise, como parte da pesquisa. **A medição
inclui gravação de sessão**, que registra a navegação e os cliques — inclusive as
respostas marcadas no questionário, que indicam posição política.

- Nada da gravação de sessão é coletado antes do aceite.
- As gravações podem ser exibidas na apresentação e na defesa do trabalho.
- A ferramenta é a Microsoft Clarity, com dados em servidores fora do Brasil (art. 33).
- Gravações ficam 30 dias; dados de clique, 9 meses.
- Recusar a medição não impede o uso do site.

Separado disso, a Cloudflare, que entrega o site, conta as visitas de forma agregada (Web
Analytics): páginas vistas, de onde a visita veio, tipo de aparelho e navegador, país e o
tempo de carregamento das páginas. Não usa cookie, não grava a sessão e não identifica quem
visita, por isso não depende do aceite. Os dados ficam em servidores da Cloudflare, fora do
Brasil (art. 33).

---

## 7. Prazos de retenção

| Dado | Prazo |
|---|---|
| Conta e lista de acompanhados | Enquanto a conta existir |
| Navegadores inscritos para avisos | Até você desligar, revogar o consentimento ou o navegador deixar de existir |
| Registro dos avisos enviados | 90 dias |
| Conta sem acesso | Apagada após 12 meses de inatividade |
| Gravações de sessão | 30 dias |
| Dados de clique | 9 meses |

---

## 8. Direitos do titular (art. 18)

A qualquer momento é possível:

- obter os dados mantidos sobre você;
- corrigir dado incorreto;
- apagar tudo, em uma operação que remove conta, lista de acompanhados, navegadores inscritos, avisos enviados e consentimentos;
- revogar o consentimento de seguir, na página da conta, o que apaga a lista de acompanhados, sem efeito sobre tratamentos já realizados licitamente;
- revogar o consentimento dos avisos, na página da conta, o que apaga os navegadores inscritos e o registro dos avisos;
- saber com quem há compartilhamento: Google, para o login; a Microsoft, para a
  medição de uso; a Cloudflare, que entrega o site e conta as visitas; e o serviço de avisos do
  fabricante do seu navegador, que entrega o aviso cifrado, se você ligar os avisos.

Para exercer qualquer um deles, escreva para **${CONTATO}**.

---

## 9. Segurança

- Todo o tráfego é cifrado por HTTPS.
- O banco de dados não é acessível pela internet.
- Os backups são criptografados.
- Não há senha, token de acesso nem CPF gravado em texto legível. O CPF, quando usado
  para reconciliar fontes públicas, é convertido em hash antes de chegar ao banco.

Nenhum sistema é imune a incidente. Havendo vazamento com risco relevante, a comunicação
ao titular e à ANPD é feita nos termos do art. 48.

---

## 10. O que este trabalho não faz

O Registro Aberto compara votos registrados. Não avalia, não classifica e não recomenda
parlamentar algum. Concordância alta significa que as respostas coincidiram com os votos
daquela pessoa nas perguntas apresentadas, e nada além disso.
`.trim();

/**
 * RISCO: O banner precisa dizer QUATRO coisas (plano/02 §4.5.2, menos a exibição na banca). Um "usamos cookies para
 * melhorar sua experiência" genérico NÃO autoriza o que este site grava.
 *
 * ATENÇÃO: Os dois botões têm o MESMO peso visual, de propósito (LGPD art. 9º §3):
 * recusar não pode ser mais difícil que aceitar.
 *
 * DECISÃO: Recusar NÃO bloqueia o site — consentimento para finalidade não essencial não
 * pode ser condição de uso.
 */
export const TEXTO_CONSENTIMENTO = {
  titulo: 'Antes de continuar',

  corpo: [
    'Usamos sua navegação, como cliques e respostas do questionário, para melhorar a ferramenta.',
    'As respostas indicam posição política, por isso só gravamos se você aceitar.',
    'Os dados ficam no Microsoft Clarity, fora do Brasil: gravações por 30 dias, cliques por 9 meses.',
  ],

  aceitar: 'Aceitar',
  recusar: 'Recusar',

  rodape: 'Você pode usar o site normalmente escolhendo qualquer uma das opções.',
} as const;

/**
 * O pedido de consentimento que aparece na primeira vez que a pessoa segue alguém
 * (Pendência 62). A versão gravada com o aceite é `VERSAO_CONSENTIMENTO`.
 */
export const TEXTO_CONSENTIMENTO_SEGUIR = {
  titulo: 'Antes de seguir',
  texto:
    'A lista de quem você segue indica posição política, e a lei a trata como dado sensível. ' +
    'Ela fica na sua conta, serve só para montar a sua lista no site e não é compartilhada. ' +
    'Você pode deixar de seguir, ou apagar a lista inteira, quando quiser.',
  aceitar: 'Concordo e quero seguir',
  recusar: 'Agora não',
};

/**
 * O pedido de consentimento dos avisos no navegador (Pendência 89), separado do de seguir: é outra
 * finalidade (art. 8º, §4º). A versão gravada com o aceite é `VERSAO_CONSENTIMENTO`.
 */
export const TEXTO_CONSENTIMENTO_AVISOS = {
  titulo: 'Avisos neste navegador',
  texto:
    'Avisamos quando alguém que você segue vota contra o partido ou troca de partido, e quando chegam os gastos do mês. ' +
    'Para isso guardamos o endereço que o seu navegador usa para receber avisos. O aviso não traz nomes, ' +
    'só quantas novidades há, porque aparece na tela de bloqueio. Você pode desligar quando quiser.',
  aceitar: 'Concordo e quero receber',
  recusar: 'Agora não',
};
