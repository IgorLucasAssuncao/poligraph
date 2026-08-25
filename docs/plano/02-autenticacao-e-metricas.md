# Autenticação, privacidade e métricas de uso

> **Status:** v1.4 — 2026-08-25
> **v1.4:** ✅ DECIDIDO — login só com Google, identidade opaca (§3). Resolve a RQ9 como
> opção D. Nova §3.2.4: sem senha não significa sem sessão.
> **v1.3:** §3.2 — o passo a passo concreto do login com Google (Google Cloud, escopos,
> código, esforço).
> **v1.2:** ✅ PL6 DECIDIDA — Clarity em produção, gravando tudo, com consentimento
> prévio bloqueante (§4.5). PL8 e PL9 caem junto; nascem PL25 (texto do banner) e PL24 (CEP).
> **v1.1:** §4.2–4.5 reescritas contra a documentação oficial do Clarity. 🔴 Duas
> mitigações da v1.0 estavam erradas: máscara não esconde clique, e "só heatmap" é pior
> que gravação. Consent Mode não protege o Brasil por padrão. Nova pendência PL24 (CEP).
> ⚠️ Este documento contém **a decisão de maior consequência jurídica do projeto**.
> Leia a §1 antes de implementar qualquer login.

---

## 1. 🔴 A tensão: "login com Google" × "nenhum dado sensível"

O pedido foi: *"login com o Google (e somente), não quero manter nenhum dado sensível do
usuário"*. **A intenção está certa e o instinto é bom** — não gerenciar senha é a decisão
correta. Mas há um problema que o login com Google **não** resolve, e que precisa ficar
explícito:

> **O risco não está nas credenciais. Está no que você associa à identidade.**

```mermaid
flowchart LR
    A["Login Google<br/>✅ não guarda senha"] --> B["Identidade<br/>persistente"]
    B --> C["+ lista de seguidos"]
    C --> D["🔴 base de<br/>CONVICÇÃO POLÍTICA"]
    style D fill:#8b1a1a,color:#fff
```

**LGPD, art. 5º, II** classifica *"convicção religiosa, opinião política"* como **dado
pessoal sensível** — categoria com exigências mais rígidas que dado comum.

Uma tabela `usuario_segue(usuario, parlamentar)` **é exatamente isso**: um registro de
preferência política por pessoa identificada.

⚠️ **E o contexto agrava:** as eleições gerais são em **outubro de 2026**. Uma base de
"quem segue qual político", existindo durante o período eleitoral, é passivo real — não
hipótese acadêmica.

---

## 2. As três formas de resolver

### Opção 1 — Sem login, tudo no navegador  ⚠️ não escolhida

```
Lista de seguidos → localStorage
Feed              → montado no cliente
Servidor          → nunca sabe quem segue quem
```

| | |
|---|---|
| ✅ | **Zero dado pessoal.** Não há o que vazar, não há o que declarar |
| ✅ | Nada a implementar — sem OAuth, sem sessão, sem tabela de usuário |
| ✅ | Já é o desenho registrado em [03-requisitos §2.7.2](../03-requisitos.md) |
| ⛔ | Perde a lista ao trocar de navegador ou limpar dados |
| ⛔ | Sem notificação por e-mail |

### Opção 2 — Google login com identidade opaca  ✅ ESCOLHIDA

```
Guarda APENAS o `sub` do Google (id opaco, ex.: 117482...)
NÃO guarda: e-mail, nome, foto
Tabela: usuario(sub_hash) · segue(sub_hash, pessoa_id)
```

| | |
|---|---|
| ✅ | Sincroniza entre dispositivos |
| ✅ | Sem PII direta armazenada |
| ⚠️ | **Continua sendo dado pessoal** — pseudonimizado ≠ anonimizado (LGPD art. 12) |
| ⚠️ | Exige: consentimento específico, política de privacidade, exclusão sob demanda |

### Opção 3 — Google login completo (e-mail, nome)

| | |
|---|---|
| ✅ | Permite notificação por e-mail |
| 🔴 | **Base de convicção política vinculada a pessoa identificada** |
| 🔴 | Maior exposição possível, no pior momento possível |
| Veredito | ⛔ **Não recomendado** |

---

## 3. ✅ DECISÃO — Opção 2 (2026-08-25)

> **Login apenas com Google, identidade opaca. Nenhuma estrutura de senha do nosso lado.**
> Decisão do autor, com a justificativa registrada: *"justamente para ter mais segurança"*.
> Resolve a **RQ9** como **opção D** em [03-requisitos §2.7.2](../03-requisitos.md).

**A justificativa está correta, e vale registrá-la assim no TCC.** Não guardar senha não é
economia de trabalho — é remoção de uma classe inteira de vulnerabilidade:

| O que deixa de existir no projeto | |
|---|---|
| Tabela de senha, hash, salt, política de complexidade | ⛔ Não existe |
| Fluxo "esqueci minha senha" (e o e-mail que ele exige) | ⛔ Não existe |
| *Rate limit*, bloqueio por tentativa, *credential stuffing* | ⛔ **Problema do Google** |
| Vazamento de senha em caso de invasão do banco | ⛔ **Não há o que vazar** |
| 2FA, anti-phishing, detecção de conta comprometida | ✅ **Herdados de graça** |

⭐ **É o argumento certo pelo motivo certo.** A superfície de ataque de autenticação passa
a ser zero, porque a autenticação não acontece aqui.

⚠️ **O que a decisão não resolve — e continua valendo:** o risco da §1 nunca esteve na
senha, e sim na tabela `segue(sub_hash, pessoa_id)`, que é uma base de convicção política.
Por isso a §3.1 deixa de ser sugestão e vira **requisito**: persistir **só**
`SHA256(sub + pepper)`, nunca e-mail, nome ou foto. **São dois riscos diferentes; o login
com Google elimina um deles por completo e não toca no outro.**

### 3.1 🔴 O desenho obrigatório

```mermaid
sequenceDiagram
    participant U as Navegador
    participant G as Google
    participant A as API C#

    U->>G: Sign in with Google
    G-->>U: id_token (JWT)
    U->>A: GET /api/seguidos  (Authorization: Bearer id_token)
    A->>A: valida assinatura do Google
    A->>A: extrai `sub`, calcula sub_hash = SHA256(sub + pepper)
    A-->>U: lista de seguidos
    Note over A: NUNCA persiste e-mail, nome ou foto
```

| Regra | Motivo |
|---|---|
| Validar o `id_token` **no servidor** | Nunca confiar no cliente |
| Persistir só `SHA256(sub + pepper)` | Nem o `sub` cru fica no banco |
| ⛔ Não persistir e-mail, nome, foto | Não são necessários para nada |
| Endpoint de exclusão total | LGPD art. 18 — direito à eliminação |
| Retenção com prazo | Ex.: apagar após 12 meses sem acesso |

⚠️ **`pepper` fora do banco** (variável de ambiente). Se o banco vazar, o hash sozinho não
liga a ninguém.

---

## 3.2 O que é preciso, concretamente, para o login com Google

Não é biblioteca nem código difícil — é **cadastro no Google Cloud**. O trabalho está em
preencher formulário, não em programar.

### 3.2.1 Custo e pré-requisitos

| | |
|---|---|
| Custo | **R$ 0.** O Google Identity é gratuito, sem cota relevante |
| Precisa de cartão? | ⛔ Não. Login não é serviço faturável do Google Cloud |
| 🔴 **Precisa de domínio** | Sim, para produção. `localhost` funciona no desenvolvimento — mas o *Authorized origin* de produção exige domínio real → **depende da PL3** |
| 🔴 **Precisa de política de privacidade publicada** | Sim. É **campo obrigatório** da tela de consentimento → **transforma a PL7 em bloqueante** |

### 3.2.2 Os seis passos

| # | Onde | O que fazer |
|---|---|---|
| 1 | [console.cloud.google.com](https://console.cloud.google.com) | Criar um projeto (nome livre, ex.: `poligraph`) |
| 2 | *APIs & Services → OAuth consent screen* | Tipo **External**. Nome do app, e-mail de suporte, **URL da política de privacidade**, domínio autorizado |
| 3 | Mesma tela → *Scopes* | ⭐ Marcar **apenas** `openid`, `email`, `profile` |
| 4 | *Credentials → Create → OAuth client ID* | Tipo **Web application**. Preencher *Authorized JavaScript origins* (`https://seudominio.com` e `http://localhost:5173`) |
| 5 | — | Copiar o **Client ID**. É público, pode ir no código do front |
| 6 | *Publishing status* | Sair de **Testing** e clicar em **Publish** |

⚠️ **O passo 6 é o que trava projeto de TCC.** Em *Testing*, só entram **e-mails cadastrados
manualmente como testadores, no máximo 100**. Se você abrir o site ao público e esquecer
disso, todo visitante vê erro de acesso negado — e nada no site indica o motivo.

⭐ **A boa notícia do passo 3:** com **apenas** `openid`, `email` e `profile`, o app **não
precisa de verificação do Google**. Publicar é um clique. Se você marcar qualquer escopo
sensível (Gmail, Drive, contatos), cai numa revisão que leva **semanas** e pede vídeo de
demonstração. **Não marque nada além dos três.**

### 3.2.3 O código — as duas metades

**Front (React)** — a biblioteca Google Identity Services devolve um JWT:

```html
<script src="https://accounts.google.com/gsi/client" async></script>
<div id="g_id_onload"
     data-client_id="SEU_CLIENT_ID.apps.googleusercontent.com"
     data-callback="onGoogleSignIn"></div>
<div class="g_id_signin" data-type="standard"></div>
```

```javascript
function onGoogleSignIn(response) {
  // response.credential é o id_token (JWT). Mande para a sua API.
  fetch('/api/auth/google', {
    method: 'POST',
    headers: { Authorization: `Bearer ${response.credential}` }
  });
}
```

**Back (C#)** — `dotnet add package Google.Apis.Auth`:

```csharp
var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
    new GoogleJsonWebSignature.ValidationSettings {
        Audience = [builder.Configuration["Google:ClientId"]]
    });

var subHash = Convert.ToHexString(SHA256.HashData(
    Encoding.UTF8.GetBytes(payload.Subject + pepper)));
// ⛔ payload.Email e payload.Name existem aqui — NÃO persistir (§3.1)
```

| Segredo | Vai onde |
|---|---|
| **Client ID** | ✅ Público — pode ficar no bundle do React |
| **Client Secret** | ⛔ **Não é usado neste fluxo.** Só existe no fluxo com *redirect* no servidor |
| **`pepper`** | 🔴 Variável de ambiente **no painel do Coolify**, nunca no repositório |

### 3.2.4 🔴 Sem senha ≠ sem sessão — a decisão que sobra

Tirar a senha do projeto **não tira a pergunta "como o servidor sabe que ainda é você na
segunda requisição?"**. O `id_token` do Google **expira em ~1 hora**.

| | **A — Validar o `id_token` a cada chamada** ⭐ | **B — Trocar por um JWT nosso** |
|---|---|---|
| Estado no servidor | ✅ **Nenhum** | 🟡 Somos emissor de token |
| Duração | ~1 h; o GIS renova em silêncio | O que definirmos |
| Se o usuário revoga no Google | ✅ **Acesso cai sozinho** | ⛔ Nosso token continua válido até expirar |
| Complexidade | ✅ Uma chamada de validação | 🟡 Emissão, expiração, *refresh*, revogação |

> ⭐ **Recomendação: A.** É a única coerente com *"nada do nosso lado"* — não há sessão,
> não há cookie de autenticação, não há tabela de token. Cada requisição chega com o
> crachá do Google e a API confere na hora.

⚠️ **A validação é obrigatoriamente no servidor.** Um `id_token` vindo do navegador é
texto que o usuário controla; só a checagem de assinatura contra as chaves públicas do
Google o torna confiável. ⛔ **Nunca** decidir identidade por algo que o front afirmou.

### 3.2.5 Esforço real

| | |
|---|---|
| Cadastro no Google Cloud | ~30 min |
| Botão no front | ~1 h |
| Validação na API + tabela | ~2 h |
| Política de privacidade (PL7) | 🔴 **Meio dia** — é texto jurídico, não código |
| **Total** | **~1 dia**, dominado pelo item que não é técnico |

### 3.2.6 ⚠️ O ponto que a decisão não cobre

A opção 2 está decidida (§3). Fica registrado, para o texto do TCC e para a banca, o que
ela NÃO resolve — porque a PL6 aumentou esse lado:

> A partir de agora o site **grava a sessão inteira**, incluindo as respostas do
> questionário. Somar login a isso significa **ligar cada gravação de opinião política a
> uma conta Google identificável**.

| Sem login (hoje) | Com login |
|---|---|
| Gravação anônima, com consentimento | Gravação **vinculada a uma identidade persistente** |
| Nenhuma base de convicção política | `usuario_segue` **é** base de convicção política (§1) |
| PL7 opcional | 🔴 PL7 obrigatória, e mais pesada |

⚠️ **E o calendário agrava:** eleições gerais em **outubro de 2026**.

> 🔑 **Isso não contradiz a decisão — delimita.** O login com Google zerou o risco de
> credencial. O risco que resta é o da §1, e ele se trata com a §3.1 (só `sub_hash`), com
> a RNF-12b (consentimento específico) e com o endpoint de exclusão (LGPD art. 18).
> **Três medidas concretas, todas já especificadas.**

## 4. Métricas de uso — a ferramenta é o Microsoft Clarity

Você mencionou "alguma do Google". São duas coisas diferentes, e a que você descreveu
(**mapa de calor**) não é do Google:

| Precisa de | Ferramenta | Custo |
|---|---|---|
| Tempo de uso, sessões, funil, origem | **Google Analytics 4** | Grátis |
| **Mapa de calor + gravação de sessão** | ⭐ **Microsoft Clarity** | **Grátis, ilimitado** |

### 4.1 Por que Clarity

O Clarity é gratuito com **sessões ilimitadas** — sem cota diária, sem cota mensal,
sem amostragem — enquanto concorrentes como Hotjar cobrariam ~US$ 80/mês no mesmo volume.
Inclui mapa de calor, gravação de sessão e detecção de *rage click* e *dead click*.

**Para o TCC isso é mais útil do que parece.** As métricas viram evidência:

| Métrica do Clarity | O que responde no TCC |
|---|---|
| Taxa de abandono do questionário | O N de perguntas (RQ3) está grande demais? |
| Mapa de calor da tela de resultado | O usuário olha os "mais distantes" ou ignora? ⚠️ Só com o consentimento da §4.5.2 |
| *Rage click* no grafo | O grafo está utilizável ou frustrante? |
| Tempo até responder | A ementa reescrita ficou compreensível? |

⭐ **Isso transforma opinião em dado na seção de avaliação.** Em vez de *"acreditamos que a
interface é clara"*, você escreve *"a taxa de conclusão do questionário foi de X%, com
abandono concentrado na pergunta N"*.

### 4.2 Custo — R$ 0, sem asterisco no preço

| | |
|---|---|
| Preço | **Gratuito, sem tier pago** — não existe versão paga para migrar |
| Limite de tráfego | **Nenhum**. Sessões ilimitadas |
| Cartão de crédito | Não pede |
| O que a Microsoft ganha | Dado agregado de comportamento na web; o produto é isca de ecossistema |

**Retenção** (medida na documentação oficial, 2026-08-25):

| Dado | Retenção |
|---|---|
| **Gravação de sessão** (playback) | **30 dias** |
| Dado de clique / heatmap | 9 meses |
| Sessões marcadas como favoritas | 9 meses |

⚠️ **A retenção de 30 dias é uma armadilha de cronograma, não de privacidade.** Se você
rodar a avaliação de usabilidade em outubro e for escrever o capítulo em janeiro, **as
gravações não existem mais**. Exporte ou anote as conclusões na mesma semana.

### 4.3 🔴 Precisa de consentimento — e o padrão NÃO protege o Brasil

O Clarity tem **Consent Mode**: com ele ligado, nenhum cookie (`_clck`, `_clsk`) é gravado
antes do usuário aceitar.

> 🔴 **Mas ele vem ligado por padrão apenas para EEA, Reino Unido e Suíça.**
> Desde 31/10/2025 a Microsoft **exige** sinal de consentimento nessas regiões. O Brasil
> não está na lista. **No Brasil, o comportamento padrão é gravar cookie sem perguntar.**

✅ **Ação concreta:** *Settings → Setup →* **desligar** "set cookies by default". Depois
passar o sinal via [Consent API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode)
no `onClick` do seu banner. Verificação no console:

```javascript
clarity('metadata', (d, upgrade, consent) => console.log('consentStatus:', consent), false, true, true);
// esperado antes do aceite: { analytics_storage: "DENIED", ad_storage: "DENIED" }
```

⚠️ **Não é opcional aqui.** A LGPD trata **convicção política** como dado pessoal sensível
(art. 5º, II) e exige, para tratá-la, **consentimento específico e destacado** (art. 11, I).
*Legítimo interesse não serve para dado sensível.* Some a isso a transferência
internacional (servidores da Microsoft fora do Brasil, art. 33).

### 4.4 🔴 A mitigação que eu tinha escrito não funciona

Duas correções ao que estava neste documento até 2026-08-25:

| O que eu escrevi | Por que está errado |
|---|---|
| *"Mascarar as respostas selecionadas"* | ⛔ O mascaramento esconde **conteúdo** — texto, campos, dropdowns. **Não esconde o clique.** Numa tela de layout conhecido, saber que o clique caiu no 4º botão **é** saber a resposta |
| *"Considerar usar só o mapa de calor, desligando a gravação"* | ⛔ **É a pior das duas.** O mapa de calor **é exatamente a posição do clique agregada**. Desligar a gravação e manter o heatmap remove a evidência e **mantém o dado sensível** |

> 🔑 **Nenhum modo de máscara resolve.** Mesmo em *Strict*, onde todo o conteúdo é ocultado,
> a coordenada do clique continua sendo coletada — é a razão de existir do produto.

**Restam então duas saídas honestas, e só duas:**

| | |
|---|---|
| **A** — não instrumentar | Deixar questionário e resultado fora do script; medir só a navegação |
| **B** — instrumentar tudo, mas **com consentimento que diga a verdade** | ✅ **Foi a escolhida** — ver §4.5 |

> 🔑 **O que muda entre A e B não é a técnica, é quem decide.** Na A, você protege o
> usuário sem perguntar. Na B, você conta exatamente o que vai gravar e ele escolhe. A B só
> é legítima se o texto do consentimento for específico — daí a §4.5.2 ser obrigatória, e
> não uma boa prática.

### 4.5 ✅ DECISÃO — PL6 resolvida (2026-08-25)

> **Clarity em produção aberta, gravando tudo — inclusive questionário e resultado —
> com consentimento prévio obrigatório.**
>
> Decisão do autor. O material serve para a demonstração à banca, e o volume esperado de
> usuários é baixo. Registrado que a alternativa mais conservadora (§4.4) foi apresentada
> e não escolhida.

Isso é defensável **desde que o consentimento seja realmente prévio, específico e
informado**. Como o dado é sensível (LGPD art. 11), não há caminho do meio: ou está tudo
abaixo implementado, ou o script não sobe.

#### 4.5.1 🔴 Obrigatório — não é recomendação

| # | Exigência | Por quê |
|---|---|---|
| 1 | 🔴 **Consent Mode LIGADO** — *Settings → Setup →* desligar "set cookies by default" | O padrão de fábrica **não cobre o Brasil** (§4.3) |
| 2 | 🔴 **Script só carrega DEPOIS do aceite** | Não basta o banner aparecer: o `clarity.js` não pode ser injetado antes |
| 3 | 🔴 **Recusar tem que ser tão fácil quanto aceitar** | Dois botões do mesmo peso. ⛔ Sem "aceitar" destacado e "saiba mais" escondido |
| 4 | 🔴 **Recusar não pode bloquear o site** | LGPD art. 9º §3 — consentimento para finalidade não essencial **não pode ser condição de uso** |
| 5 | 🔴 **Revogar tem que existir** | Um link no rodapé que reabre a escolha e chama a Consent API com `DENIED` |
| 6 | Verificar no console antes de publicar | `consentStatus` deve vir `DENIED` antes do aceite (§4.3) |

#### 4.5.2 🔴 O texto do consentimento precisa dizer estas cinco coisas

Genérico não serve. Um banner de "usamos cookies para melhorar sua experiência" **não
autoriza** o que vai ser gravado aqui.

| Deve constar | Redação-guia |
|---|---|
| **O que é gravado** | *"gravamos sua navegação, incluindo cliques e as respostas que você marcar no questionário"* |
| **Que isso revela opinião política** | *"essas respostas indicam sua posição política"* — 🔴 é o que torna o consentimento *específico* (art. 11) |
| ⭐ **Que será exibido na defesa** | *"as gravações podem ser exibidas na apresentação e na defesa deste trabalho acadêmico"* |
| **Quem recebe** | *"a ferramenta é a Microsoft Clarity; os dados ficam em servidores fora do Brasil"* (art. 33) |
| **Por quanto tempo** | *"gravações por 30 dias; dados de clique por 9 meses"* |

⚠️ **A terceira linha é a que quase todo mundo esquece** — e é a que legitima a sua
finalidade. Exibir a gravação de um terceiro para a banca é **divulgação a outras pessoas**.
Se o texto não disser isso, o consentimento obtido não cobre o uso pretendido.

#### 4.5.3 ⏳ Os 30 dias vão te pegar

> **A gravação que você quer mostrar na banca terá expirado no dia da banca.**

| Ação | Quando |
|---|---|
| 🔴 Marcar as sessões escolhidas como **favoritas** | Sobe a retenção de 30 dias → **9 meses** |
| 🔴 **Gravar a tela** reproduzindo a sessão (OBS, Xbox Game Bar) | O vídeo é seu, não expira, e funciona offline na defesa |
| Exportar os números agregados | O painel do Clarity não é fonte permanente |

⭐ **Grave o vídeo na mesma semana da coleta.** Depender do painel ao vivo na defesa junta
dois riscos numa coisa só: expiração e Wi-Fi da universidade.

#### 4.5.4 Uma escolha que ainda é sua

Para a demonstração, **a sessão de um estranho e a sua própria sessão valem o mesmo**
como evidência de usabilidade — mas custam coisas diferentes. Se der na mesma, prefira
mostrar à banca a gravação de **um voluntário que você avisou pessoalmente**, e use as
sessões do público aberto de forma **agregada** (heatmap, taxa de abandono). O
consentimento cobre as duas; a segunda só é mais confortável de defender se perguntarem.

⚠️ **Pergunte ao orientador sobre o CEP.** Pesquisa com seres humanos costuma exigir
aprovação de Comitê de Ética (Res. CNS 510/2016, via Plataforma Brasil). A resolução
dispensa alguns casos — como pesquisa de opinião com participantes não identificados —
mas **quem decide se o seu caso se enquadra não é você**. É pergunta de 5 minutos que pode
custar meses se ficar para o fim.

---

## 5. Resumo das decisões

| Tema | Decisão |
|---|---|
| Login no MVP | ⭐ **Nenhum** — `localStorage` |
| Se precisar de login | Google, guardando só `SHA256(sub + pepper)` |
| E-mail / nome / foto | ⛔ Nunca persistir |
| Mapa de calor | **Microsoft Clarity** — 🔴 máscara não basta; o que protege é o consentimento (§4.5) |
| Analytics de uso | **GA4**, sem PII |
| Gravação de sessão | ✅ **Em produção, completa** — com consentimento bloqueante (§4.5) |

---

## 6. Pendências

| # | Pendência | Prioridade |
|---|---|---|
| ~~PL6~~ | ✅ **Produção aberta, gravando tudo, com consentimento prévio obrigatório** (§4.5) | — |
| **PL7** | Política de privacidade — 🔴 vira BLOQUEANTE se houver login: é campo obrigatório da tela de consentimento do Google (§3.2.1) | 🔴 Alta *(se houver login)* |
| ~~PL8~~ | ✅ **Todas as telas** — a proteção passou a ser o consentimento, não a máscara | — |
| **PL24** | Confirmar com o orientador se o TCC precisa de aprovação em CEP (Plataforma Brasil) | 🔴 Alta |
| ~~PL9~~ | ✅ **Necessário e bloqueante** — decorre da PL6 (§4.5.1) | — |
| **PL25** | Escrever o texto do banner cobrindo as 5 exigências da §4.5.2 | 🔴 Alta |

---

## Fontes

- [Microsoft Clarity — Free Heatmaps & Session Recordings](https://clarity.microsoft.com/)
- [Microsoft Clarity Pricing: Is It Really Free in 2026?](https://clarity-insights.com/blog/microsoft-clarity-pricing.html)
- [9 Best AI Heatmap Tools 2026](https://omidsaffari.com/blog/ai-heatmap-tools-2026-clarity-wins-free-vs-contentsquare)
