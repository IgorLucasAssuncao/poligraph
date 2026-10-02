/**
 * Textos jurídicos do projeto.
 *
 * 🔴 `VERSAO_CONSENTIMENTO` é gravada em `consentimento.versao` a cada aceite.
 *
 * ⚠️ SEMPRE incremente a versão ao mudar qualquer texto abaixo. Sem isso não há como
 * responder "consentiu com o quê, exatamente?" — que é a pergunta que a LGPD art. 8º §2
 * joga no colo do controlador, porque o ônus da prova do consentimento é dele.
 */
export const VERSAO_CONSENTIMENTO = 'v4-2026-10-02';

export const CONTATO = 'igorlucas1217@gmail.com';

/**
 * ⚠️ Rascunho para revisão do orientador e, se possível, de alguém da área jurídica.
 * Não é peça jurídica revisada — é o melhor esforço técnico de descrever com precisão
 * o que o sistema realmente faz.
 */
export const POLITICA_DE_PRIVACIDADE = `
# Política de Privacidade

**Versão ${VERSAO_CONSENTIMENTO}** · Última atualização: 2 de outubro de 2026.

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

A base legal é o consentimento (art. 7º, I e art. 11, I), manifestado ao entrar e ao
seguir alguém, e revogável a qualquer tempo.

---

## 4. E-mail

O site não envia e-mail. Um resumo de notícias por e-mail chegou a ser planejado e foi
retirado em 2 de outubro de 2026. Se algum aviso por e-mail voltar, ele será opcional,
virá desativado, terá consentimento próprio, e esta política será atualizada antes.

---

## 5. Medição de uso

A interface é avaliada com ferramenta de análise, como parte da pesquisa. **A medição
inclui gravação de sessão**, que registra a navegação e os cliques — inclusive as
respostas marcadas no questionário, que indicam posição política.

- Nada é coletado antes do aceite.
- As gravações podem ser exibidas na apresentação e na defesa do trabalho.
- A ferramenta é a Microsoft Clarity, com dados em servidores fora do Brasil (art. 33).
- Gravações ficam 30 dias; dados de clique, 9 meses.
- Recusar a medição não impede o uso do site.

---

## 6. Prazos de retenção

| Dado | Prazo |
|---|---|
| Conta e lista de acompanhados | Enquanto a conta existir |
| Conta sem acesso | Apagada após 12 meses de inatividade |
| Gravações de sessão | 30 dias |
| Dados de clique | 9 meses |

---

## 7. Direitos do titular (art. 18)

A qualquer momento é possível:

- obter os dados mantidos sobre você;
- corrigir dado incorreto;
- apagar tudo, em uma operação que remove conta, lista de acompanhados, consentimentos e tokens;
- revogar o consentimento, sem efeito sobre tratamentos já realizados licitamente;
- saber com quem há compartilhamento: Google, para o login, e a Microsoft, para a
  medição de uso.

Para exercer qualquer um deles, escreva para **${CONTATO}**.

---

## 8. Segurança

- Todo o tráfego é cifrado por HTTPS.
- O banco de dados não é acessível pela internet.
- Os backups são criptografados.
- Não há senha, token de acesso nem CPF gravado em texto legível. O CPF, quando usado
  para reconciliar fontes públicas, é convertido em hash antes de chegar ao banco.

Nenhum sistema é imune a incidente. Havendo vazamento com risco relevante, a comunicação
ao titular e à ANPD é feita nos termos do art. 48.

---

## 9. O que este trabalho não faz

O Registro Aberto compara votos registrados. Não avalia, não classifica e não recomenda
parlamentar algum. Concordância alta significa que as respostas coincidiram com os votos
daquela pessoa nas perguntas apresentadas, e nada além disso.
`.trim();

/**
 * 🔴 O banner precisa dizer CINCO coisas (plano/02 §4.5.2). Um "usamos cookies para
 * melhorar sua experiência" genérico NÃO autoriza o que este site grava.
 */
export const TEXTO_CONSENTIMENTO = {
  titulo: 'Antes de continuar',

  corpo: [
    'Para avaliar a interface deste trabalho acadêmico, a navegação pode ser gravada, incluindo cliques e as respostas marcadas no questionário.',
    '**Essas respostas indicam posição política.**',
    'As gravações podem ser exibidas na apresentação e na defesa deste trabalho.',
    'A ferramenta é a Microsoft Clarity, com dados em servidores fora do Brasil.',
    'Gravações ficam 30 dias; dados de clique, 9 meses.',
  ],

  // ⚠️ Os dois botões têm o MESMO peso visual, de propósito (LGPD art. 9º §3):
  //    recusar não pode ser mais difícil que aceitar.
  aceitar: 'Aceitar',
  recusar: 'Recusar',

  // ⭐ Recusar NÃO bloqueia o site — consentimento para finalidade não essencial não
  //    pode ser condição de uso.
  rodape: 'Você pode usar o site normalmente escolhendo qualquer uma das opções.',
} as const;
