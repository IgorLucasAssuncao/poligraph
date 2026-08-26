# Como obter as chaves — Google e Clarity

> **Status:** v1.0 — 2026-08-26 · consoles conferidos nesta data
> Nenhuma das duas custa dinheiro. Nenhuma pede cartão.

---

## 1. Google — `VITE_GOOGLE_CLIENT_ID` e `Google:ClientId`

**Endereço direto:** [console.cloud.google.com/auth/clients](https://console.cloud.google.com/auth/clients)

⚠️ A Google moveu isto para uma seção nova chamada **Google Auth Platform**. Quem procurar
por *"APIs & Services → OAuth consent screen"* não acha mais.

| # | Onde | O que fazer |
|---|---|---|
| 1 | Console | Criar projeto — nome livre, ex.: `poligraph` |
| 2 | Auth Platform → **Branding** | Nome do app, e-mail de suporte, domínios autorizados, 🔴 **URL da política de privacidade** |
| 3 | Auth Platform → **Audience** | Tipo **External** |
| 4 | Auth Platform → **Data Access** | ⭐ Marcar **só** `openid`, `email`, `profile` |
| 5 | Auth Platform → **Clients** → **Create client** | Tipo **Web application** + origens (§1.1) |
| 6 | — | 📋 Copiar o **Client ID** — `1234…-abc.apps.googleusercontent.com` |
| 7 | Audience → **Publish app** | 🔴 Só quando for abrir ao público |

### 1.1 🔴 As origens — onde quase todo mundo erra

Aceita **só esquema + host (+ porta)**. Sem caminho, sem barra no fim:

```
✅ http://localhost
✅ http://localhost:5173        ← precisa das DUAS linhas
✅ https://poligraph.com.br     (quando houver domínio)
⛔ http://localhost:5173/       ← barra no fim: rejeitado
⛔ https://poligraph.com.br/login
```

### 1.2 O que dá para fazer HOJE

| Agora | Depois |
|---|---|
| Projeto, escopos, `localhost` nas origens, **Client ID em mãos** | Domínio (PL3) e política publicada (PL7) → só então **Publish** |

⭐ **Domínio e política bloqueiam a PUBLICAÇÃO, não o desenvolvimento.**

⚠️ **O passo 7 trava projeto de TCC:** em *Testing* só entram **100 e-mails cadastrados à
mão**. Abrir ao público sem publicar faz **todo visitante ver acesso negado**, sem nada na
tela explicando.

⭐ **Com apenas os três escopos, o app dispensa verificação do Google** — publicar é um
clique. Qualquer escopo sensível cai em revisão de semanas com pedido de vídeo.

---

## 2. Clarity — `VITE_CLARITY_ID`

**Endereço:** [clarity.microsoft.com](https://clarity.microsoft.com)

| # | Onde | O que fazer |
|---|---|---|
| 1 | Entrar | Conta Microsoft, **Google** ou Facebook — não precisa criar conta nova |
| 2 | **Add new project** | Nome, URL do site, categoria |
| 3 | **Settings → Setup** | *Get tracking code* — o ID de 10 caracteres está no script |
| 4 | 🔴 **Settings → Setup → Advanced → Cookies** | **DESLIGAR** — ver §2.1 |

O ID aparece dentro do script, em `clarity.ms/tag/XXXXXXXXXX`:

```html
<script>(function(c,l,a,r,i,t,y){ … })(window,document,"clarity","script","abcdefghij");</script>
                                                                            ↑ é este
```

⚠️ **Não cole esse script no `index.html`.** O `BannerConsentimento.tsx` já o injeta —
mas **só depois do aceite**. Colar no HTML faria o cookie ser gravado antes de qualquer
consentimento.

### 2.1 🔴 O passo 4 não é opcional

> **O Consent Mode obrigatório do Clarity vale para EEA, Reino Unido e Suíça. O Brasil
> não está na lista.** No padrão de fábrica, ele grava cookie **sem perguntar**.

Desligar o *toggle* de **Cookies** faz o Clarity esperar o sinal de consentimento — que é
o que o banner envia. Verificação no console do navegador:

```javascript
clarity('metadata', (d, upgrade, consent) => console.log(consent), false, true, true);
// esperado ANTES do aceite: { analytics_storage: "DENIED", ad_storage: "DENIED" }
```

### 2.2 🔴 Restrição de idade nos termos — leia antes de decidir

A documentação da Microsoft afirma:

> *"Clarity shouldn't be used on any websites/apps targeting users under the age of 18
> globally."*

⚠️ **Isto merece atenção neste projeto especificamente.** No Brasil o voto é facultativo
a partir dos **16 anos** — um site sobre afinidade política **atrai adolescentes por
natureza**, e o TCC pode ser divulgado em escola.

| Leitura | |
|---|---|
| A restrição é sobre **público-alvo**, não sobre visitante eventual | O site não é *dirigido* a menores |
| Mas o risco existe e é seu | Vale conversar com o orientador junto da **PL24** (Comitê de Ética) |
| ⭐ Alternativa conservadora | Usar o Clarity **só na avaliação com voluntários maiores de 18**, e não em produção aberta |

🔑 **Isto reabre parcialmente a PL6.** A decisão foi por produção aberta gravando tudo —
ela continua válida, mas agora com este fato à vista, que não estava quando foi tomada.

---

## 3. Onde colocar cada uma

### Front — `src/web/.env.local`

```bash
cp src/web/.env.example src/web/.env.local
```

```
VITE_GOOGLE_CLIENT_ID=1234567890-abc.apps.googleusercontent.com
VITE_CLARITY_ID=abcdefghij
```

⚠️ **O Vite congela isto no BUILD.** Mudou o valor? Rode `npm run build` de novo. Em
produção, é *build variable* do Coolify — env var comum não funciona.

### API — `src/Poligraph.Api/appsettings.Development.json`

```json
{ "Google": { "ClientId": "1234567890-abc.apps.googleusercontent.com" } }
```

🔴 **O MESMO Client ID nos dois lugares.** A API confere o `aud` do token contra o valor
dela — divergindo, **todo login é rejeitado com 401** e nada na tela explica.

⛔ **Não existe `ClientSecret`.** Este fluxo não usa.
⛔ **O Client ID não é segredo** — vai no bundle do front, é público por natureza.

---

## 4. Conferir que funcionou

| | Sinal de sucesso |
|---|---|
| Google | O botão "Entrar com Google" aparece no lugar do aviso amarelo |
| Clarity | O `console` mostra `DENIED` antes do aceite e `GRANTED` depois |
| Integração | Depois de entrar, `GET /api/auth/eu` responde 200 |
