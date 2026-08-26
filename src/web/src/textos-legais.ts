/**
 * Textos jurídicos do projeto.
 *
 * 🔴 `VERSAO_CONSENTIMENTO` é gravada em `consentimento.versao` a cada aceite.
 *
 * ⚠️ SEMPRE incremente a versão ao mudar qualquer texto abaixo. Sem isso não há como
 * responder "consentiu com o quê, exatamente?" — que é a pergunta que a LGPD art. 8º §2
 * joga no colo do controlador, porque o ônus da prova do consentimento é dele.
 */
export const VERSAO_CONSENTIMENTO = 'v1-2026-08-26';

export const CONTATO = 'igorlucas1217@gmail.com';

/**
 * ⚠️ Rascunho para revisão do orientador e, se possível, de alguém da área jurídica.
 * Não é peça jurídica revisada — é o melhor esforço técnico de descrever com precisão
 * o que o sistema realmente faz.
 */
export const POLITICA_DE_PRIVACIDADE = `
# Política de Privacidade — Poligraph

**Versão ${VERSAO_CONSENTIMENTO}**

O Poligraph é uma ferramenta **acadêmica**, desenvolvida como trabalho de conclusão de
curso. Ele compara o que você responde num questionário com o **voto real** de deputados
federais, usando dados abertos da Câmara dos Deputados.

Esta política descreve exatamente o que o sistema faz com dados — nem mais, nem menos.

---

## 1. Você pode usar quase tudo sem se identificar

Responder o questionário, ver o resultado, consultar a ficha de um parlamentar, explorar
o grafo e ler as notícias **não exigem login**.

**Suas respostas do questionário não são gravadas em lugar nenhum.** O cálculo acontece
no momento em que você pede o resultado, e o resultado não é armazenado.

---

## 2. O que guardamos se você entrar com o Google

Entrar serve para **uma coisa**: manter sua lista de parlamentares acompanhados entre
dispositivos, e — se você pedir — receber notícias por e-mail.

Ao entrar, recebemos e guardamos do Google:

| Dado | Para quê |
|---|---|
| Identificador da conta | Reconhecer que é você ao voltar |
| E-mail | Enviar o resumo de notícias, se você tiver pedido |
| Nome e sobrenome | Cumprimentá-lo na tela e no e-mail |
| Foto do perfil | Exibir seu avatar |
| Idioma | Ajustar a interface |

**Nunca recebemos sua senha.** A autenticação acontece inteiramente no Google.
Também **não guardamos nenhum token de acesso**.

---

## 3. 🔴 A lista de quem você acompanha é dado sensível

Ao seguir um parlamentar, gravamos essa escolha vinculada à sua conta.

Pela **Lei Geral de Proteção de Dados (art. 5º, II)**, opinião política é **dado pessoal
sensível** — uma categoria com proteção mais rígida. Tratamos essa lista com esse peso:

- ela existe **apenas** para montar sua lista e o resumo por e-mail;
- **não é vendida, compartilhada, cedida ou usada para publicidade**;
- **não é usada para segmentar você** em nada;
- você pode apagá-la a qualquer momento, item a item ou de uma vez.

**A base legal é o seu consentimento** (art. 7º, I e art. 11, I), que você dá ao entrar e
ao seguir alguém, e pode retirar quando quiser.

---

## 4. E-mail: só se você pedir

O resumo por e-mail é **opcional** e desligado por padrão. Se você ativar:

- enviamos apenas notícias de parlamentares que **você** acompanha;
- **o assunto do e-mail nunca cita nome de parlamentar**, para que sua preferência
  política não fique visível na caixa de entrada ou na tela de bloqueio do celular;
- todo e-mail traz um link de **descadastro em um clique**, que funciona sem login;
- descadastrar **não** apaga sua conta.

O envio é feito por um serviço terceirizado de e-mail, que processa o endereço apenas
para entregar a mensagem.

---

## 5. Medição de uso

Usamos ferramentas de análise para entender como as pessoas usam a interface — é parte
da avaliação acadêmica do trabalho.

🔴 **Isso inclui gravação de sessão**, que registra sua navegação e os cliques, incluindo
as respostas que você marcar no questionário. **Essas respostas indicam sua posição
política.**

- Nada disso é coletado **antes** de você aceitar.
- As gravações **podem ser exibidas na apresentação e na defesa** deste trabalho.
- A ferramenta é a **Microsoft Clarity**; os dados ficam em servidores **fora do Brasil**
  (art. 33 da LGPD).
- Gravações são retidas por **30 dias**; dados de clique, por **9 meses**.
- Recusar **não impede** o uso do site.

---

## 6. Quanto tempo guardamos

| Dado | Prazo |
|---|---|
| Conta e lista de acompanhados | Enquanto a conta existir |
| Conta sem acesso | Apagada após **12 meses** de inatividade |
| Gravações de sessão | 30 dias |
| Dados de clique | 9 meses |

---

## 7. Seus direitos (LGPD art. 18)

Você pode, a qualquer momento:

- **ver** os dados que temos sobre você;
- **corrigir** o que estiver errado;
- **apagar tudo** — a exclusão remove conta, lista de acompanhados, consentimentos e
  tokens, de uma vez;
- **retirar o consentimento**, sem que isso afete o que já foi feito legitimamente antes;
- **saber com quem compartilhamos** — hoje: Google (login), o serviço de e-mail, e a
  Microsoft (medição de uso).

Para exercer qualquer um deles: **${CONTATO}**.

---

## 8. Segurança

- Todo o tráfego é cifrado (HTTPS).
- O banco de dados **não é acessível pela internet**.
- Backups são criptografados.
- Não guardamos senha, nem token de acesso, nem CPF em texto legível.

⚠️ Nenhum sistema é imune a incidente. Em caso de vazamento que possa gerar risco a você,
comunicaremos você e a ANPD, como exige o art. 48.

---

## 9. Isto não é recomendação de voto

O Poligraph compara **votos registrados**. Ele não avalia, não classifica e não recomenda
nenhum parlamentar. Um alto grau de concordância significa apenas que suas respostas
coincidiram com votos daquela pessoa nas perguntas apresentadas — nada além disso.

---

*Última atualização: 26 de agosto de 2026.*
`.trim();

/**
 * 🔴 O banner precisa dizer CINCO coisas (plano/02 §4.5.2). Um "usamos cookies para
 * melhorar sua experiência" genérico NÃO autoriza o que este site grava.
 */
export const TEXTO_CONSENTIMENTO = {
  titulo: 'Antes de continuar',

  corpo: [
    'Para avaliar a interface deste trabalho acadêmico, podemos **gravar sua navegação**, incluindo cliques e **as respostas que você marcar no questionário**.',
    '**Essas respostas indicam sua posição política.**',
    'As gravações **podem ser exibidas na apresentação e na defesa** deste trabalho.',
    'A ferramenta é a **Microsoft Clarity**; os dados ficam em servidores fora do Brasil.',
    'Gravações são guardadas por **30 dias**; dados de clique, por **9 meses**.',
  ],

  // ⚠️ Os dois botões têm o MESMO peso visual, de propósito (LGPD art. 9º §3):
  //    recusar não pode ser mais difícil que aceitar.
  aceitar: 'Aceitar',
  recusar: 'Recusar',

  // ⭐ Recusar NÃO bloqueia o site — consentimento para finalidade não essencial não
  //    pode ser condição de uso.
  rodape: 'Você pode usar o site normalmente escolhendo qualquer uma das opções.',
} as const;

/** Texto do opt-in de e-mail. ⚠️ Desmarcado por padrão — é consentimento separado. */
export const TEXTO_OPTIN_EMAIL =
  'Quero receber por e-mail notícias dos parlamentares que eu seguir. ' +
  'O assunto não cita nomes, e há link para sair em todo e-mail.';
