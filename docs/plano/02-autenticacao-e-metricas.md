# Autenticação, privacidade e métricas de uso

> **Status:** v1.11 — 2026-08-25
> **v1.11:** §3.5.6 — por que o `email` não pode ser hash (é destino, não comparação) e
> ⭐ a regra nova: descadastrar ZERA a coluna, devolvendo a pessoa ao pseudonimato.
> **v1.10:** §3.5 — inventário consolidado do que fica no banco após um login. Dos 12
> campos recebidos, 11 são descartados. ⭐ A pseudonimização vale POR USUÁRIO e cai no
> momento do opt-in de e-mail.
> **v1.9:** §3.4.0 — autenticação × autorização delegada: não existe `refresh_token`
> neste fluxo, e o cookie de sessão é que faz o papel dele. Guardá-lo violaria a RNF-12d.
> **v1.8:** §3.4.0 — o payload literal do `id_token`, os três blocos do JWT e as TRÊS
> conferências obrigatórias. 🔴 A do `aud` é a que costuma faltar e a que mais importa.
> **v1.7:** §3.2.4 reescrita — "e o token, não vai ser armazenado?". São TRÊS desenhos,
> não dois. ⭐ Recomendação muda para B1 (cookie assinado `HttpOnly`, sem tabela), porque
> a opção A expunha o `id_token` ao XSS. Truque do `sessao_versao` para revogação global.
> **v1.6:** §3.4 — o que o id_token entrega e a regra "receber ≠ guardar". ⭐ Nome e foto
> nunca são persistidos; só o `email` precisa, e só porque o job de digest roda sem o
> usuário presente. `email_verified` do Google DERRUBA o double opt-in.
> **v1.5:** 🔄 §3 — a opção 2 não comporta e-mail; decisão revista para a **opção 3**
> (Google + e-mail armazenado). Nova §3.3: o que a notificação por e-mail traz junto
> (SPF/DKIM/DMARC, serviço de envio, `token_email`, assunto que vaza).
> **v1.4:** ✅ DECIDIDO — login só com Google, identidade opaca (§3). Nova §3.2.4: sem
> senha não significa sem sessão.
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

### Opção 2 — Google login com identidade opaca  🔄 superada pela §3

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

### Opção 3 — Google login + e-mail armazenado  ✅ ESCOLHIDA (§3)

| | |
|---|---|
| ✅ | **Permite notificação por e-mail** — o motivo da escolha |
| ✅ | Continua **sem senha nossa** — a autenticação segue no Google |
| 🔴 | **Base de convicção política vinculada a pessoa identificada** |
| 🔴 | Maior exposição possível, e em ano eleitoral (R7) |
| Mitigações | §3.3 — assunto neutro, opt-in separado, descadastro em um clique |

---

## 3. ✅ DECISÃO — Opção 3: Google + e-mail armazenado (2026-08-25)

> **Ponto do autor:** *"como o usuário vai receber os e-mails de notícias do político dele
> se não tiver uma conta com e-mail válido?"*

**Está correto, e derrubou a opção 2 no mesmo dia em que ela foi decidida.** A opção 2
guarda apenas `sub_hash` — **não há para onde enviar**. Notificação por e-mail não é um
incremento dela: é a **opção 3**.

| | Opção 2 (§3) | ✅ **Opção 3 — decidida** |
|---|---|---|
| Autenticação | Google | **Google, igual** |
| Senha nossa | ⛔ Nenhuma | ⛔ **Nenhuma — isso não muda** |
| Guarda | `sub_hash` | `sub_hash` **+ e-mail** |
| Notificação por e-mail | ⛔ Impossível | ✅ **Possível** |

⭐ **O que se preserva integralmente da decisão anterior:** a **RNF-12d** continua valendo —
nenhuma estrutura de senha no projeto. Guardar e-mail para *enviar* é coisa diferente de
guardar e-mail para *autenticar*. O Google segue sendo o único responsável por provar quem
é a pessoa.

⚠️ **O que muda de verdade:** a base deixa de ser pseudonimizada. `usuario(email)` +
`segue(usuario, parlamentar)` é **preferência política vinculada a pessoa identificada** —
exatamente o cenário da §1. Decisão do autor, registrada, e mitigada pela §3.3.

### 3.0.1 ⭐ E há um ganho que compensa, no argumento do TCC

O **RF-43 (feed agregado) é condicional** — pode não existir. Se não existir, o e-mail
passa a ser **a única entrega de "Recomendação de Notícias"**, que é *metade do título do
trabalho*. Isso muda o cálculo: o e-mail deixa de ser conveniência e vira **o canal que
sustenta um dos quatro elementos do título**.


### 3.0.2 O que se preserva — e por que a justificativa original continua correta

A escolha nasceu de outra frase do autor: *"login com Google justamente para ter mais
segurança, sem estrutura de senhas do nosso lado"*. **Isso não mudou com a entrada do
e-mail** — e vale registrar assim no TCC, porque não guardar senha não é economia de
trabalho, é remoção de uma classe inteira de vulnerabilidade:

| O que deixa de existir no projeto | |
|---|---|
| Tabela de senha, hash, salt, política de complexidade | ⛔ Não existe |
| Fluxo "esqueci minha senha" (e o e-mail que ele exige) | ⛔ Não existe |
| *Rate limit*, bloqueio por tentativa, *credential stuffing* | ⛔ **Problema do Google** |
| Vazamento de senha em caso de invasão do banco | ⛔ **Não há o que vazar** |
| 2FA, anti-phishing, detecção de conta comprometida | ✅ **Herdados de graça** |

⭐ **É o argumento certo pelo motivo certo.** A superfície de ataque de autenticação passa
a ser zero, porque a autenticação não acontece aqui.

⚠️ **O que a decisão não resolve — e agora pesa mais:** o risco da §1 nunca esteve na
senha, e sim na tabela `segue`, que é base de convicção política. Com o e-mail dentro, ela
deixa de ser pseudonimizada. **São dois riscos diferentes: o Google elimina o de
credencial por completo e não toca no outro** — este se trata na §3.1 e na §3.3.

### 3.1 🔴 O desenho obrigatório

```mermaid
sequenceDiagram
    participant U as Navegador
    participant G as Google
    participant A as API C#

    U->>G: Sign in with Google
    G-->>U: id_token (JWT, ~1 h)
    U->>A: POST /api/auth/google  (id_token, uma vez só)
    A->>A: valida assinatura contra as chaves do Google
    A->>A: extrai `sub`, calcula sub_hash = SHA256(sub + pepper)
    A->>A: grava `email` SOMENTE se houve opt-in (§3.3.5)
    A->>A: 🗑️ DESCARTA o id_token
    A-->>U: Set-Cookie: sid=<jwt nosso>; HttpOnly; Secure
    U->>A: GET /api/seguidos  (cookie vai sozinho)
    A->>A: confere assinatura do sid + sessao_versao
    A-->>U: lista de seguidos
    Note over A: NUNCA persiste id_token, nome nem foto
```

| Regra | Motivo |
|---|---|
| Validar o `id_token` **no servidor**, uma vez | Nunca confiar no cliente |
| ⛔ **Nunca armazenar o `id_token`** | Validado e descartado — §3.2.4 |
| 🔴 Passar `Audience` na validação | Sem isso, token de outro app é aceito — §3.4.0 |
| Sessão em cookie `HttpOnly` assinado | Script não lê; **sem tabela de sessão** |
| Chave da conta é `SHA256(sub + pepper)` | O `sub` cru não fica no banco |
| ⭐ **`email` é coluna anulável** | 🔑 Quem não pediu notificação **não tem e-mail gravado** |
| ⛔ Nunca persistir nome nem foto | Não são necessários para nada |
| Endpoint de exclusão total | LGPD art. 18 — direito à eliminação |
| Retenção com prazo | Ex.: apagar após 12 meses sem acesso |

⚠️ **`pepper` fora do banco** (variável de ambiente). Se o banco vazar, o hash sozinho não
liga a ninguém.

> ⭐ **O detalhe que mais reduz exposição, e custa uma linha de schema:** deixar `email`
> anulável e preenchê-lo **só** no opt-in. Quem apenas entra para sincronizar a lista
> continua pseudonimizado, exatamente como na opção 2. **A base identificada passa a conter
> apenas quem pediu para receber e-mail** — que é o mínimo indispensável.

```sql
CREATE TABLE usuario (
    id        BIGSERIAL PRIMARY KEY,
    sub_hash  TEXT NOT NULL UNIQUE,          -- SHA256(sub + pepper)
    email     TEXT,                          -- ⭐ NULL enquanto não houver opt-in
    email_ok  BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (email IS NOT NULL OR email_ok = FALSE)
);
```

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

🔴 **Antes de tudo, o que NUNCA é armazenado:** o `id_token` do Google. Nem no banco, nem
em `localStorage`. Ele é **validado e descartado** — é um crachá que se confere na portaria
e se devolve.

A pergunta *"e o token, não vai ser armazenado?"* tem **três respostas possíveis**, não
duas. Eu tinha colapsado as duas últimas:

| | **A — Validar o `id_token` toda vez** | **B1 — Cookie assinado nosso** ⭐ | **B2 — Tabela `sessao`** |
|---|---|---|---|
| Guarda token no banco? | ⛔ Não | ⛔ **Não** | ✅ Sim |
| Estado no servidor | ✅ Nenhum | ✅ **Nenhum** | 🟡 Uma linha por sessão viva |
| Duração da sessão | ⚠️ **~1 h** | ✅ O que definirmos | ✅ O que definirmos |
| Onde o token vive no cliente | 🔴 Memória JS → **XSS lê** | ✅ **Cookie `HttpOnly` — JS não lê** | ✅ Idem |
| "Sair de todos os aparelhos" | n/a | 🟡 Ver o truque abaixo | ✅ Nativo |
| Se revogar o app no Google | ✅ Cai na hora | ⚠️ Cai no fim da sessão | ⚠️ Idem |
| Complexidade | ✅ Mínima | 🟡 Assinar e conferir cookie | 🔴 Tabela + limpeza + índice |

> ⭐ **Recomendação: B1 — cookie de sessão assinado, sem tabela.**
> **Sessão própria não implica guardar token.** Um JWT assinado com um segredo do servidor
> se verifica pela assinatura: se ele é válido, ele é válido — não há o que consultar.

**Por que não a A**, que era minha recomendação anterior: além da sessão morrer de hora em
hora, ela obriga o `id_token` a ficar acessível ao JavaScript para ir no header
`Authorization`. **Um cookie `HttpOnly` não pode ser lido por script** — e num site que
guarda preferência política, essa diferença importa mais do que a economia de código.

```
Set-Cookie: sid=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/
```

⚠️ **Cookie traz CSRF junto.** `SameSite=Lax` cobre o caso comum; para `POST`, `DELETE` e
afins, some um token anti-CSRF ou exija um header customizado.

#### ⭐ O truque que dá revogação global sem tabela nenhuma

O único ganho real da B2 é *"sair de todos os aparelhos"*. **Dá para ter isso com uma
coluna `SMALLINT`:**

```sql
ALTER TABLE usuario ADD COLUMN sessao_versao SMALLINT NOT NULL DEFAULT 0;
```

| | |
|---|---|
| O JWT carrega | `{ sub_hash, sv: 3 }` |
| A API confere | `sv` do token **é igual** ao `sessao_versao` do usuário? |
| "Sair de todos" | `UPDATE usuario SET sessao_versao = sessao_versao + 1` |

> 🔑 **Uma linha de `UPDATE` invalida todos os JWTs daquela pessoa, em todos os
> dispositivos, instantaneamente** — sem tabela de sessão, sem varredura, sem limpeza de
> registros expirados. E como o `usuario` já é consultado na requisição, não custa um
> acesso a mais.

#### Resumindo o que existe e o que não existe

| Token | Armazenado? |
|---|---|
| `id_token` do Google | ⛔ **Nunca** — validado e descartado |
| Sessão (`sid`) | ⛔ **Não** — assinado, verificado por assinatura |
| ⭐ `token_email` (descadastro) | ✅ **Sim** — é o único, e está no schema |

⚠️ **A validação é obrigatoriamente no servidor.** Um `id_token` vindo do navegador é
texto que o usuário controla; só a checagem de assinatura contra as chaves públicas do
Google o torna confiável. ⛔ **Nunca** decidir identidade por algo que o front afirmou.

→ **PL29:** confirmar B1 e definir a duração da sessão (sugerido: 7 dias).

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

## 3.3 🔴 O que a notificação por e-mail traz junto

Aqui está a parte que costuma surpreender: **enviar e-mail não é problema de código.** O
código é uma chamada HTTP. O trabalho está em outro lugar.

### 3.3.1 ⛔ Não envie do VPS

| Por quê | |
|---|---|
| **Porta 25 bloqueada** | Quase todo provedor de VPS bloqueia saída na 25 por padrão |
| **Reputação de IP zero** | IP novo, sem histórico → Gmail trata como spam |
| Sem infra de entrega | Sem *bounce handling*, sem *feedback loop*, sem retentativa |

**Use um serviço de envio:**

| Serviço | Gratuito | Nota |
|---|---|---|
| ⭐ **Resend** | 3.000/mês · 100/dia | API simples, DNS guiado. Suficiente com folga |
| **Brevo** | 300/dia | Mais generoso no diário |
| Amazon SES | ~US$ 0,10/mil | Barato, mas exige **sair do sandbox** por pedido aprovado |

⭐ **Com o volume esperado deste TCC, o tier gratuito basta** — e sobra.

### 3.3.2 🔴 SPF, DKIM e DMARC — sem isso, o e-mail não chega

Desde **fevereiro de 2024**, Gmail e Yahoo exigem de quem envia em volume:

| Exigência | Onde se configura |
|---|---|
| **SPF** | Registro TXT no DNS (Cloudflare) |
| **DKIM** | Registro TXT/CNAME que o serviço de envio fornece |
| **DMARC** | Registro TXT `_dmarc` |
| 🔴 **Descadastro em um clique** | Cabeçalho `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) |

⚠️ **Isso amarra na PL3.** Não dá para configurar SPF/DKIM/DMARC sem domínio próprio —
e-mail é a segunda coisa (depois do login com Google) que torna o domínio bloqueante.

### 3.3.3 ✅ Você tem razão sobre a tabela de tokens — mas não a que imagina

Duas tabelas de token diferentes, e **só uma é necessária**:

| Tabela | Precisa? | Por quê |
|---|---|---|
| `sessao(token, usuario)` — sessão de login | ⛔ **Não** | §3.2.4: cookie assinado (B1). Sessão própria **não** implica guardar token |
| ~~`token_email` com propósito `CONFIRMACAO`~~ | ⛔ **Não** | ⭐ **Cai pela §3.4:** o Google já entrega `email_verified: true`. Double opt-in confirmaria o que já está provado |
| ⭐ `token_email` com propósito `DESCADASTRO` | ✅ **Sim, obrigatória** | O link de descadastro **precisa funcionar sem login**, direto do e-mail |

> 🔑 **O motivo é este:** a pessoa clica em "descadastrar" no cliente de e-mail, às vezes
> em outro dispositivo, muitas vezes sem estar logada. Exigir login para sair de uma lista
> é justamente o que o RFC 8058 proíbe. Por isso o token precisa existir — **e ser opaco,
> longo e não adivinhável.**

```sql
CREATE TABLE token_email (
    token      TEXT PRIMARY KEY,          -- 32 bytes aleatórios, base64url
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    proposito  TEXT NOT NULL CHECK (proposito IN ('DESCADASTRO')),  -- CONFIRMACAO nao e necessaria
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em  TIMESTAMPTZ,               -- NULL no descadastro: nunca expira
    usado_em   TIMESTAMPTZ
);
```

⚠️ **O token de descadastro não expira, de propósito.** Um e-mail antigo com link morto
transforma "quero sair" em "vou marcar como spam" — e aí a reputação do domínio cai.

### 3.3.4 🔴 O assunto do e-mail vaza o que o banco protege

> **"Notícias sobre o Deputado Fulano" na caixa de entrada é convicção política
> atravessando o Gmail, o Outlook e o celular na tela de bloqueio.**

De nada adianta `sub_hash` no banco se o assunto do e-mail diz a mesma coisa em texto puro.

| ⛔ Evitar | ✅ Preferir |
|---|---|
| *"Novidades sobre o Deputado Fulano"* | *"Suas atualizações do Poligraph"* |
| Nome do parlamentar no *preview* | Nomes só **dentro** do corpo |

### 3.3.5 🔴 Consentimento para e-mail é separado do consentimento de login

Entrar com o Google **não autoriza** receber e-mail. São finalidades distintas (LGPD
art. 8º §4 — o consentimento é para finalidades determinadas).

| # | Exigência |
|---|---|
| 1 | *Checkbox* de opt-in **desmarcado por padrão** |
| 2 | Texto explícito: *"quero receber por e-mail notícias dos parlamentares que eu seguir"* |
| 3 | Link de descadastro em **todos** os e-mails |
| 4 | Descadastrar **não** apaga a conta — são ações diferentes |

### 3.3.6 Esforço adicional

| Item | |
|---|---|
| Conta no serviço + SPF/DKIM/DMARC | ~4 h (a maior parte é esperar propagação de DNS) |
| Job de digest (Scheduled Task do Coolify) | ~1 dia |
| `token_email` + endpoint de descadastro | ~4 h |
| Template HTML que não quebra no Outlook | ~4 h — 🔴 mais chato do que parece |
| ⭐ ~~Fluxo de confirmação (double opt-in)~~ | ✅ **Eliminado** pela §3.4.2 — o Google já verifica o e-mail |
| **Total sobre o login** | **~2 a 3 dias** |

⚠️ **Isso não é pequeno.** Some ao ~1 dia do login e à PL7, e a frente de "conta de
usuário" passa de meio dia imaginado para **quase uma semana**. Vale saber disso antes de
começar, para decidir onde ela entra no cronograma — não para desistir dela.

---

## 3.4 ⭐ O que o Google entrega — e a distinção que economiza trabalho

> **Ponto do autor:** *"com o login do Google temos todos os dados necessários do usuário"*.

**Correto — e é verdade justamente porque este projeto precisa de muito pouco.**

### 3.4.0 O que chega, literalmente

O que o navegador entrega em `response.credential` é **uma string**: um JWT, três blocos
base64url separados por ponto, com cerca de 1 KB.

```
eyJhbGciOiJSUzI1NiIsImtpZCI6IjZmN2Y...  .  eyJpc3MiOiJodHRwczovL2FjY2 ...  .  NfV3sZ8Q7k...
      cabeçalho (algoritmo, kid)                    conteúdo                    assinatura
```

**Decodificando o bloco do meio** — é isto que recebemos, e nada além:

```json
{
  "iss": "https://accounts.google.com",
  "aud": "1234567890-abc.apps.googleusercontent.com",
  "sub": "117482910375829104857",
  "email": "fulano@gmail.com",
  "email_verified": true,
  "name": "Fulano de Tal",
  "given_name": "Fulano",
  "family_name": "de Tal",
  "picture": "https://lh3.googleusercontent.com/a/ACg8oc...=s96-c",
  "locale": "pt-BR",
  "iat": 1756100000,
  "exp": 1756103600
}
```

⚠️ **Nada disso é secreto ou confiável por si só.** Base64 não é criptografia — qualquer
pessoa decodifica em [jwt.io](https://jwt.io). **O que dá valor ao conteúdo é a
assinatura**, e conferi-la é obrigação do servidor.

#### 🔴 As três conferências — e a que todo mundo esquece

| # | Conferir | Se falhar |
|---|---|---|
| 1 | **Assinatura** contra as chaves públicas do Google | Token forjado |
| 2 | 🔴 **`aud` == o SEU Client ID** | ⛔ **Um token legítimo, emitido para OUTRO app, entra no seu como se fosse seu** |
| 3 | `iss` é `accounts.google.com` e `exp` não passou | Token de outro emissor, ou vencido |

> 🔑 **A checagem #2 é a que costuma faltar.** Sem ela, qualquer site que use Sign in with
> Google pode pegar o token dos próprios usuários e usá-lo na sua API. O
> `Google.Apis.Auth` só faz essa conferência **se você passar o `Audience`** — não é
> automático:

```csharp
var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
    new GoogleJsonWebSignature.ValidationSettings {
        Audience = [clientId]      // 🔴 sem esta linha, a #2 não acontece
    });
```

#### ⛔ O que NÃO vem junto

| | |
|---|---|
| **`refresh_token`** | ⛔ Não existe neste fluxo. Só no *authorization code* com troca no servidor |
| Senha, telefone, nascimento, CPF | ⛔ Nunca |
| Contatos, agenda, Drive | ⛔ Exigiriam escopos sensíveis (§3.2.2) |

⭐ **A ausência de `refresh_token` é exatamente por que a §3.2.4 importa:** não há como
renovar o `id_token` no servidor. Ou a sessão é do Google e dura 1 hora, ou é nossa — e foi
por isso que a **B1** foi escolhida.

#### 🔑 Por que não há `refresh_token` — e por que isso é bom

A pergunta *"não precisamos armazenar o refresh token?"* tem uma resposta curta —
**não dá para armazenar o que nunca chega** — mas a razão de fundo vale mais que a resposta:

> **São dois problemas diferentes, e só temos o primeiro.**

| | **Autenticação** — quem é | **Autorização delegada** — agir por ela |
|---|---|---|
| Pergunta | *"Quem está entrando?"* | *"Posso ler o Gmail dela enquanto ela dorme?"* |
| Token | ⭐ **`id_token`** | `access_token` + `refresh_token` |
| Fluxo | Botão do GIS | *Authorization code* + `client_secret` no servidor |
| **Precisamos?** | ✅ **Só disto** | ⛔ **Nunca** |

**O `refresh_token` serve para manter acesso às APIs do Google quando o usuário não está
presente.** Este projeto não chama nenhuma API do Google — só precisa saber **uma vez, no
login**, quem é a pessoa. Depois disso o Google sai da história.

⭐ **E o papel que o `refresh_token` teria — manter a pessoa logada sem perguntar de novo —
é exatamente o que o nosso cookie de sessão faz** (§3.2.4). Ele *é* o nosso mecanismo de
renovação, e não é armazenado.

⚠️ **Guardar `refresh_token` seria o pior dos mundos aqui.** É credencial de vida longa,
sem expiração natural — a coisa mais parecida com senha que existe depois da senha. Exigiria
tabela, rotação, revogação e o `client_secret` no servidor. **Seria justamente a "estrutura
de credenciais" que a RNF-12d proíbe** — reintroduzida pela porta dos fundos.

> 🔑 **O fluxo escolhido não é uma versão simplificada do fluxo completo. É o fluxo certo
> para o problema certo** — e o argumento cabe no TCC como decisão de projeto, não como
> limitação.

### 3.4.0.1 Resumo dos campos

| Claim | Conteúdo | Guardamos? |
|---|---|---|
| `sub` | ID estável e único da conta | ✅ **Só o hash** |
| `email` | Endereço | ⚠️ **Só com opt-in** (§3.1) |
| `email_verified` | O Google já validou o endereço | ⭐ Ver abaixo |
| `name`, `given_name` | Nome | ⛔ **Nunca** |
| `picture` | URL do avatar | ⛔ **Nunca** |
| `iss`, `aud`, `exp` | Emissor, destinatário, expiração | Validação |

### 3.4.1 🔑 Receber ≠ guardar

Esta é a distinção que faz a diferença, e ela é boa notícia:

> **Nome e foto chegam a cada login, de graça. Dá para exibir "Olá, Igor" com avatar
> sem persistir uma única linha** — lê do token, renderiza, descarta.

**Então por que o `email` precisa ser guardado?** Por um motivo só, e vale ter clareza dele:

| | |
|---|---|
| ⭐ **O job de digest roda quando o usuário NÃO está** | De madrugada, sem navegador aberto, sem token nenhum disponível |
| Consequência | O endereço tem que estar no banco **naquele momento** |

⭐ **Isso é um teste útil para qualquer campo:** *"preciso disso quando a pessoa não está
presente?"* Se não, **não guarde** — leia do token. Pelo teste, só o `email` passa.

### 3.4.2 ⭐ E isso derruba uma exigência que eu tinha escrito

O Google entrega **`email_verified: true`**. O endereço já está provado.

| | |
|---|---|
| ⛔ **Cai o double opt-in** | Não faz sentido enviar e-mail de confirmação para provar o que o Google já provou |
| ⛔ Cai o propósito `CONFIRMACAO` | A `token_email` fica **só com `DESCADASTRO`** (§3.3.3) |
| ✅ Economia | ~meio dia de fluxo, template e tela de "confira sua caixa de entrada" |

⚠️ **Mas verifique a claim.** `email_verified` pode vir `false` em contas fora do padrão.
Se vier falso, **não envie** — é o único caso em que a confirmação voltaria a ser necessária.

### 3.4.3 🔴 Duas armadilhas do que o Google entrega

| Armadilha | |
|---|---|
| 🔴 **O `email` muda** | O Google permite trocar o endereço principal. **Nunca use e-mail como chave.** A chave é `sub_hash`; o `email` é um atributo que se atualiza a cada login |
| **A URL de `picture` apodrece** | Expira e passa a dar 404. É mais um motivo para não persistir — se um dia exibir avatar, leia do token |

### 3.4.4 O que o Google **não** dá

Telefone, data de nascimento, CPF, endereço — **nada disso vem** com `openid email
profile`. Exigiria escopos adicionais e derrubaria a dispensa de verificação (§3.2.2).

⭐ **E não faz falta:** este projeto precisa de **uma coluna** — o e-mail — e mesmo essa só
para quem pediu notificação.

---

## 3.5 ⭐ Inventário — o que fica no banco depois de um login

A resposta curta: **uma linha, com um valor que importa.**

### 3.5.1 Primeiro login, sem opt-in de e-mail

```
usuario
  id            = 1
  sub_hash      = 9f2a4c...c41        ← 64 caracteres hex. É só isto.
  email         = NULL
  primeiro_nome = NULL
  criado_em     = 2026-08-25 14:02
  visto_em      = 2026-08-25 14:02
  sessao_versao = 0
```

**E mais nada.** Nenhuma outra tabela recebe registro.

### 3.5.2 O que foi recebido e descartado no mesmo instante

| Recebido no `id_token` | Destino |
|---|---|
| `name`, `family_name` | 🗑️ Descartado |
| `picture` | 🗑️ Descartado |
| `locale`, `iat`, `exp`, `iss`, `aud` | 🗑️ Usado na validação, descartado |
| `email` (sem opt-in) | 🗑️ **Descartado** |
| `sub` | ⭐ Vira `SHA256(sub + pepper)` — **o cru não fica** |
| O próprio `id_token` | 🗑️ Descartado |

⭐ **Dos 12 campos que chegam, 11 são descartados** e o 12º só entra transformado.

### 3.5.3 O que aparece depois, conforme a pessoa age

| Ação dela | O que passa a existir |
|---|---|
| Voltar ao site | `visto_em` atualizado. Nada novo |
| **Seguir** um parlamentar | Uma linha em `segue` 🔴 *(é o dado sensível)* |
| **Opt-in** de e-mail | `usuario.email` preenchido + uma linha em `consentimento` |
| Pedir descadastro | Uma linha em `token_email` (gerada no envio) |
| Sair | ⛔ **Nada** — o cookie é apagado no navegador |
| Excluir a conta | ⛔ **Nada** — um `DELETE` leva tudo (§2.2.2 do esqueleto) |

### 3.5.4 O que nunca existe, em nenhum cenário

⛔ Senha · ⛔ `refresh_token` · ⛔ `id_token` · ⛔ token de sessão · ⛔ nome completo ·
⛔ foto · ⛔ CPF · ⛔ telefone · ⛔ endereço · ⛔ IP · ⛔ respostas do questionário

### 3.5.5 ⚠️ E a leitura honesta disso

| Quem | Situação na base |
|---|---|
| Entra e não segue ninguém | ✅ Uma linha praticamente vazia. **Nada a proteger** |
| Entra e segue parlamentares | ⚠️ **Pseudonimizado** — `sub_hash` não diz quem é, mas a lista existe |
| Faz opt-in de e-mail | 🔴 **Identificado.** O e-mail liga a lista a uma pessoa real |

> 🔑 **O `sub_hash` sozinho não identifica ninguém** — sem o `pepper` (que vive fora do
> banco) e sem conhecer o `sub` de origem, ele é opaco. **Mas isso deixa de valer no
> momento em que o `email` é preenchido.**
>
> ⭐ **Por isso a coluna é anulável.** Não é elegância de schema: é a diferença entre uma
> base pseudonimizada e uma base identificada, e ela se aplica **por usuário**. Quem não
> pediu e-mail continua do lado seguro da linha.

### 3.5.6 🔴 O e-mail é a exceção — e não dá para tratá-lo como o `sub`

A pergunta natural é: *"então por que não guardar o e-mail em hash também?"*

> **Porque não dá para enviar mensagem para um hash.**

| | `sub` | `email` |
|---|---|---|
| Para que serve | Só **comparar** — "é o mesmo usuário?" | **Endereçar** — é um destino |
| Hash serve? | ✅ Sim. Compara-se hash com hash | ⛔ **Não.** É preciso o valor original |
| Como fica no banco | `SHA256(sub + pepper)` | 🔴 **Em texto legível** |

⚠️ **Esta é a única PII em claro no projeto inteiro.** Todo o resto ou é público (dado
parlamentar), ou é hash (`sub`, `cpf` dos políticos), ou não existe.

#### O que de fato protege, já que hash está fora

| Medida | O que cobre | O que NÃO cobre |
|---|---|---|
| ⭐ **Só existir com opt-in** | A maioria dos usuários nem tem a coluna preenchida | Quem optou |
| ⭐ **Descadastrar zera a coluna** | Ver abaixo — devolve a pessoa ao pseudonimato | — |
| 🔴 **Backup criptografado** | Backup vazado, disco descartado | Invasão da aplicação em execução |
| Retenção (12 meses sem acesso) | Base velha acumulando | O período ativo |

⚠️ **Criptografia de coluna (pgcrypto) não resolve o que parece resolver.** A API precisa
da chave para enviar o digest — então quem comprometer a aplicação lê o e-mail de qualquer
jeito. Protege backup roubado, **não** aplicação invadida. Vale a pena, mas sabendo o
alcance.

#### ⭐ Descadastrar deve zerar o `email` — e isso não é óbvio

A RF-52 diz que descadastrar **não** apaga a conta. Correto — a lista de seguidos
sobrevive. **Mas o e-mail deve sair:**

```sql
UPDATE usuario SET email = NULL WHERE id = :id;
UPDATE consentimento SET revogado_em = now()
 WHERE usuario_id = :id AND finalidade = 'EMAIL_NOTICIAS' AND revogado_em IS NULL;
```

> 🔑 **O motivo é o próprio teste da §3.4.1:** guardávamos o e-mail porque o digest precisa
> dele quando a pessoa não está. Se ela pediu para não receber, **a razão de guardar
> deixou de existir** — e o dado deve ir embora com ela.

⭐ **O efeito é bonito: descadastrar devolve a pessoa ao estado pseudonimizado.** Ela
continua com a conta e a lista, e sai da fatia identificada da base. E se voltar a optar,
o e-mail chega de novo no próximo `id_token` — **nada se perde ao apagar.**

⚠️ **Consequência para a PL20 (destino do backup):** o backup do Postgres passa a conter
e-mails em claro. **Ele herda a sensibilidade da base** — criptografia no destino deixa de
ser boa prática e vira parte da decisão.

---

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
| Login no MVP (revisto) | ✅ **Google + e-mail**, opção 3 (§3) — `email` anulável, só no opt-in |
| Notificação por e-mail | ✅ **Sim** — exige serviço de envio, SPF/DKIM/DMARC e `token_email` (§3.3) |

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
| **PL26** | Escolher o serviço de envio de e-mail (Resend, Brevo, SES) e configurar SPF/DKIM/DMARC | 🔴 Alta |
| **PL27** | Definir a cadência do digest — diário, semanal, ou por volume de notícia | 🟡 Média |
| **PL29** | Confirmar o desenho B1 de sessão e a duração do cookie (sugerido: 7 dias) | 🟡 Média |

---

## Fontes

- [Microsoft Clarity — Free Heatmaps & Session Recordings](https://clarity.microsoft.com/)
- [Microsoft Clarity Pricing: Is It Really Free in 2026?](https://clarity-insights.com/blog/microsoft-clarity-pricing.html)
- [9 Best AI Heatmap Tools 2026](https://omidsaffari.com/blog/ai-heatmap-tools-2026-clarity-wins-free-vs-contentsquare)
