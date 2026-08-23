# Requisitos — funcionais e não funcionais

> **Status:** v1.2 — 2026-08-23
> **v1.2:** §2.7.3 — feed agregado é **condicional**; se existir, é misto (seguidos +
> temas). "Seguir" segue comprometido. RF-48 classifica notícia por tema desde já.
> **v1.1:** §2.7 — seguir parlamentar e receber notícias (RF-42 a RF-46), com a tensão
> LGPD e as três formas de atender; crawler promovido ao caminho crítico (F5b).
> Deriva do [00-discovery.md](00-discovery.md). Regras de negócio marcadas com 📊 vêm de
> **medição real** nos dados, não de suposição.

---

## 1. A premissa

```mermaid
flowchart TB
    subgraph FONTES["Fontes públicas oficiais"]
        F1["Câmara dos Deputados<br/>API REST + CSV"]
        F2["Senado Federal<br/>API REST"]
        F3["TSE<br/>CSV — carga manual"]
        F4["Veículos de imprensa<br/>RSS"]
    end

    subgraph POLI["Poligraph"]
        direction TB
        P1["ETL<br/>bronze → silver → gold"]
        P2["Motor de similaridade<br/>comportamento revelado de voto"]
        P3["Grafo + comunidades"]
        P4["Questionário de afinidade"]
        P1 --> P2 --> P3
        P2 --> P4
    end

    subgraph SAIDA["Perguntas respondidas"]
        S1["Com qual político<br/>eu mais concordo?"]
        S2["Quais políticos votam<br/>parecido entre si?"]
        S3["O partido explica<br/>o voto?"]
        S4["O que dizem sobre<br/>o político X?"]
    end

    F1 --> P1
    F2 --> P1
    F3 --> P1
    F4 --> P1
    P4 --> S1
    P3 --> S2
    P3 --> S3
    P1 --> S4

    style POLI fill:#0d1117,color:#fff
```

**A premissa central, em uma frase:**

> Afinidade política medida por **comportamento revelado** — como o parlamentar
> efetivamente votou — é mais informativa que autodeclaração ideológica.

### 1.1 Atores

```mermaid
flowchart LR
    A1(["👤 Cidadão<br/>anônimo"]) --> UC1["Responder questionário"]
    A1 --> UC2["Consultar ficha<br/>de parlamentar"]
    A1 --> UC3["Explorar o grafo"]
    A2(["🔬 Pesquisador"]) --> UC3
    A2 --> UC4["Comparar parlamentares"]
    A3(["⚙️ Operador<br/>(você)"]) --> UC5["Executar cargas"]
    A3 --> UC6["Curar questionário<br/>+ atribuir polaridade"]
    S1[["🤖 Fontes oficiais"]] --> UC5
```

⚠️ **Não existe ator "usuário cadastrado"** — e isso é decisão de projeto, não omissão.
O cidadão **segue parlamentares** (RF-42) e, se o feed agregado existir, o recebe (RF-43,
condicional) — mas essa preferência
vive **no navegador dele**, não em uma conta no servidor. Ver §2.7.2 e RNF-12.

> A pergunta que orientou o desenho: *o produto precisa saber quem é a pessoa, ou só
> precisa que **o navegador dela** lembre?* Para seguir e receber feed, o segundo basta —
> e evita construir uma base de convicções políticas.

---

## 2. Requisitos funcionais

### 2.1 Ingestão

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-01** | Ingerir votações, votos e orientações da Câmara a partir dos **CSVs anuais consolidados** | 🔴 Essencial |
| **RF-02** | Ingerir incrementalmente o ano corrente pela **API REST**, sem reprocessar o histórico | 🔴 Essencial |
| **RF-03** | Ingerir o cadastro de parlamentares, incluindo **CPF** | 🔴 Essencial |
| **RF-04** | Ligar cada votação à **proposição** correspondente e obter sua ementa | 🔴 Essencial |
| **RF-05** | Ingerir a **classificação temática** oficial das proposições | 🟡 Importante |
| **RF-06** | Ingerir dados do **TSE** a partir de arquivos depositados manualmente, com manifesto e verificação de hash | 🟡 Importante |
| **RF-07** | Ingerir votações e votos do **Senado** | 🟢 Desejável |
| **RF-08** | Registrar toda carga em log auditável (fonte, período, volume, duração, erros) | 🟡 Importante |
| **RF-09** | Ser **idempotente**: reexecutar uma carga não duplica registros | 🔴 Essencial |

### 2.2 Tratamento e identidade

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-10** | Manter camada **bronze imutável**, permitindo reprocessar silver/gold sem reacessar as fontes | 🔴 Essencial |
| **RF-11** | Atribuir **ID sintético próprio** a cada pessoa e mapear os IDs externos | 🔴 Essencial |
| **RF-12** | Conciliar Câmara ↔ TSE por **CPF** (determinístico) | 🟡 Importante |
| **RF-13** | Conciliar Senado ↔ TSE por *fuzzy match*, com **fila de revisão manual** | 🟢 Desejável |
| **RF-14** | Registrar o **método e a confiança** de cada ligação (`CPF` \| `FUZZY` \| `MANUAL`) | 🟡 Importante |
| **RF-15** | Classificar cada votação em `PROCEDIMENTAL` \| `DESTAQUE` \| `SUBSTANTIVA` \| `AUTORIDADE` | 🔴 Essencial |
| **RF-16** | Preservar **partido e UF no momento do voto** | 🔴 Essencial |

### 2.3 Análise

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-17** | Calcular similaridade entre todos os pares de parlamentares da mesma casa | 🔴 Essencial |
| **RF-18** | Oferecer **ao menos duas métricas** (concordância simples e cosseno) e permitir comparação | 🟡 Importante |
| **RF-19** | Detectar **comunidades** no grafo de similaridade | 🔴 Essencial |
| **RF-20** | Comparar comunidades detectadas × filiação partidária, com métrica formal | 🟡 Importante |
| **RF-21** | Projetar parlamentares em **eixos ideológicos** via SVD/PCA | 🟡 Importante |
| **RF-22** | Calcular **disciplina partidária** e **governismo** cruzando voto individual × orientação de bancada | 🟡 Importante |
| **RF-23** | Calcular métricas comparativas **entre as duas casas** | 🟢 Desejável |

### 2.4 Questionário e afinidade

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-24** | Selecionar votações candidatas aplicando os filtros de RN-04 a RN-07 | 🔴 Essencial |
| **RF-25** | Permitir ao operador **curar** o questionário: reescrever ementas e atribuir **polaridade** | 🔴 Essencial |
| **RF-26** | Apresentar o questionário com opções **Sim / Não / Não sei** | 🔴 Essencial |
| **RF-27** | Calcular afinidade cidadão ↔ parlamentar aplicando polaridade e comparação *pairwise* | 🔴 Essencial |
| **RF-28** | Exibir **os mais próximos E os mais distantes** | 🔴 Essencial |
| **RF-29** | Exibir o resultado como **"concordaram em X de Y perguntas"**, não como percentual solto — atende RNF-19 e RNF-30 de uma vez | 🔴 Essencial |
| **RF-30** | Exibir a **ementa original** ao lado da pergunta reescrita | 🟡 Importante |
| **RF-41** | Apresentar **fluxo único** de perguntas, sem que o usuário escolha casa ou órgão; separar por casa apenas na tela de resultado | 🔴 Essencial |

### 2.5 Consulta e visualização

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-31** | Ficha do parlamentar: dados cadastrais, histórico de votos, mais similares | 🔴 Essencial |
| **RF-32** | Enriquecer a ficha com dados do TSE | 🟢 Desejável |
| **RF-33** | Visualizar o grafo com layout *force-directed*, filtro por limiar e coloração por comunidade/partido | 🔴 Essencial |
| **RF-34** | Buscar parlamentar por nome, partido e UF | 🟡 Importante |
| **RF-35** | Exibir notícias recentes na **página do parlamentar** | 🔴 **Essencial** — destino comprometido da coleta |
| **RF-36** | Expor API REST pública documentada (OpenAPI) | 🟡 Importante |

### 2.6 Notícias

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-37** | Coletar de **poucos feeds RSS fixos**, diariamente, e associar às menções de parlamentares | 🔴 **Essencial** — o título exige, mesmo sem o RF-43 |
| **RF-38** | Armazenar **apenas** URL, título, veículo, data e trecho curto | 🔴 Essencial |
| **RF-39** | Deduplicar notícias replicadas | 🟡 Importante — feed repetido é feed ruim |
| **RF-40** | Marcar grau de confiança da associação e ocultar abaixo do limiar | 🔴 **Essencial** — notícia errada na página de quem a pessoa segue é falha visível |

⚠️ **Estes requisitos subiram de prioridade.** Eram "desejáveis" quando notícia era enfeite
da ficha. Com o feed de seguidos (§2.7), o crawler passa a sustentar um requisito essencial
— e a coleta precisa ser **diária e contínua**, não sob demanda.

⚠️ **Escopo da coleta: poucos feeds fixos, sem busca por parlamentar** (decisão registrada
em [arq/20-crawler §10](arq/20-crawler-noticias.md)). Isso mantém o custo em ~5 requisições
diárias, mas **a cobertura é enviesada**: medido, uma coleta cita ~9 de 690 parlamentares,
concentrados em lideranças. **A maior parte do Congresso não terá notícia.**

| ID | Requisito derivado dessa limitação | Prioridade |
|---|---|---|
| **RF-47** | Exibir estado vazio honesto quando não há notícia do parlamentar | 🔴 Essencial |
| **RF-48** | Classificar cada notícia coletada **por tema**, além de por parlamentar | 🔴 Essencial — habilita o RF-43 sem custo extra de coleta |

### 2.7 ⭐ Seguir parlamentares e receber notícias

Requisito declarado: **o usuário pode seguir um parlamentar e receber notícias dele.**
É o que fecha o arco do título — *"Recomendação de Notícias em Redes Sociais"* — e o que
transforma o produto de consulta pontual em algo com retorno.

| ID | Requisito | Prioridade |
|---|---|---|
| **RF-42** | Permitir **seguir** e deixar de seguir um parlamentar a partir da página dele | 🔴 Essencial |
| **RF-42a** | Listar "meus parlamentares" — os seguidos, com acesso rápido à página de cada um | 🔴 Essencial |
| **RF-43** | Exibir um **feed agregado** de notícias dos seguidos | 🔶 **Condicional** — ver §2.7.3 |
| **RF-44** | Sugerir a quem seguir a partir do **resultado do questionário** (afinidade + temas) | 🟡 Importante |
| **RF-45** | Permitir seguir **tema** além de parlamentar | 🟢 Desejável |
| **RF-46** | Indicar **por que** cada notícia apareceu ("porque você segue X") | 🟡 Importante *(se RF-43)* |

### 2.7.3 🔶 O feed agregado é condicional — e se existir, é misto

**Posição do autor, 2026-08-23:** *"não sei dizer se teremos feed, mas se for, é o feed
misto."*

Isso separa duas coisas que estavam agrupadas:

| | Situação |
|---|---|
| **Seguir** (RF-42, RF-42a) | ✅ **Comprometido.** A pessoa marca parlamentares e tem sua lista |
| **Feed agregado** (RF-43) | 🔶 **Em aberto.** Pode não existir |

Sem feed, "seguir" continua fazendo sentido: é uma **lista de acompanhamento** — o usuário
abre "meus parlamentares" e vê as páginas de cada um, com as notícias dele ali. O que muda
é só não haver uma timeline unificada.

**Se o feed for construído, o desenho está decidido: misto.**

```mermaid
flowchart LR
    A["Parlamentares<br/>que você segue"] --> F["Feed"]
    B["Temas que suas respostas<br/>revelaram interesse"] --> F
    F --> G["Nunca fica vazio"]
    style F fill:#238636,color:#fff
```

O componente de tema resolve o problema medido em
[arq/20-crawler §10.1](arq/20-crawler-noticias.md): a cobertura é enviesada para
lideranças, então seguir um parlamentar de baixa projeção renderia timeline vazia. Como as
respostas do questionário já carregam **temas oficiais** (achado #10), o interesse temático
sai de graça — sem pergunta adicional.

⚠️ **Consequência para o crawler:** a coleta por **tema** (não só por parlamentar) passa a
ser necessária se o RF-43 for adiante. Como os feeds fixos são varridos inteiros de todo
jeito, isso **não adiciona requisições** — só um segundo eixo de classificação sobre o
mesmo texto coletado.

**Pendência RQ10:** decidir se o RF-43 entra. Recomendação: **decidir tarde**. Coletar e
classificar por parlamentar **e** por tema desde o início (custo marginal zero) deixa a
porta aberta; o feed é só uma tela a mais sobre dado que já existe.

⚠️ **Consequência de arquitetura:** isto **promove o crawler de F8 para o caminho
crítico** — mas por dois motivos independentes, e vale separá-los:

1. **O título exige.** *"Recomendação de Notícias"* é um dos quatro elementos. Isso vale
   **mesmo que o feed agregado (RF-43) não seja construído**.
2. **O seguir consome.** Sem notícia coletada, "meus parlamentares" vira lista sem
   conteúdo.

→ A **coleta** é inegociável; o **feed agregado** é a superfície opcional sobre ela (§2.7.3). O crawler deixa de
ser "a parte mais frágil e menos essencial" e passa a sustentar um requisito essencial.

### 2.7.1 🔴 Tensão com o RNF-12 — e ela é séria

**"Seguir" exige lembrar quem é o usuário entre sessões.** Isso colide de frente com o
RNF-12, que dizia *"não persistir respostas identificáveis: sem login, sem IP, sem cookie
de sessão"*.

E o problema é maior do que uma preferência de projeto:

> **Uma base que registra "usuário X segue os políticos A, B e C" é uma base de
> convicções políticas.** A LGPD (art. 5º, II) classifica **opinião política** como
> **dado pessoal sensível**, com exigências mais rígidas que dado comum.

Somando ao risco R7 (contexto eleitoral de outubro de 2026), guardar essa base em servidor
é a decisão de maior consequência jurídica do projeto inteiro.

### 2.7.2 Três formas de atender ao requisito

| | **A — Local no navegador** ⭐ | **B — Conta anônima** | **C — Conta com login** |
|---|---|---|---|
| Onde fica quem você segue | `localStorage` do dispositivo | Servidor, ID aleatório | Servidor, vinculado a e-mail |
| Feed ao voltar no site | ✅ Sim | ✅ Sim | ✅ Sim |
| Notificação por e-mail/push | ⛔ Não | ⛔ Não | ✅ Sim |
| Funciona em outro dispositivo | ⛔ Não | ⛔ Não | ✅ Sim |
| **Dado sensível no servidor** | ✅ **Nenhum** | 🔴 Sim (não identificado) | 🔴 Sim (identificado) |
| Exposição LGPD | ✅ Praticamente nula | 🟡 Média | 🔴 Alta |
| Esforço | 🟢 Baixo | 🟡 Médio | 🔴 Alto |

**Recomendação: opção A.**

O feed é montado **no cliente**: a lista de seguidos fica no navegador, a API serve
notícias públicas por parlamentar, e o front filtra. O servidor **nunca sabe** quem segue
quem — ele só responde "quais as notícias recentes do parlamentar 204528", que é
informação pública.

Isso atende RF-42, RF-43, RF-44 e RF-46 **por inteiro**. O que se perde é só notificação
ativa (e-mail/push) e sincronização entre dispositivos.

⚠️ **Se notificação por e-mail for inegociável**, então é opção C, e o projeto precisa de:
consentimento específico e destacado para dado sensível, política de privacidade,
mecanismo de exclusão, e — dado o R7 — provavelmente adiar a publicação para depois de
outubro de 2026.

**Pendência RQ9:** decidir entre A, B e C. Enquanto não decidido, **implementar A** — é o
único caminho que não cria passivo e não fecha portas.

---

## 3. Requisitos não funcionais

### 3.1 Desempenho

| ID | Requisito | Meta | Justificativa |
|---|---|---|---|
| **RNF-01** | Cálculo de afinidade do cidadão | **< 200 ms** (p95) | 📊 20 respostas × 552 = 11 mil comparações |
| **RNF-02** | Carga completa de um ano da Câmara | < 10 min | 📊 167 mil linhas via `COPY` |
| **RNF-03** | Job de similaridade (207 mil pares) | < 15 min | 📊 ~228 M comparações |
| **RNF-04** | Resposta de consulta (ficha, busca) | < 500 ms (p95) | — |
| **RNF-05** | Carga do Senado (ano inteiro) | < 1 min | 📊 uma chamada de 2,4 MB |

### 3.2 Confiabilidade e manutenibilidade

| ID | Requisito |
|---|---|
| **RNF-06** | Falha em uma fonte **não** impede o processamento das demais |
| **RNF-07** | Toda carga é reexecutável sem efeito colateral (idempotência — RF-09) |
| **RNF-08** | Camada bronze permite reprocessar tudo **sem rede** |
| **RNF-09** | Erros de conciliação vão para **fila de exceção**, nunca são descartados em silêncio |
| **RNF-10** | Cobertura de testes automatizados nas regras de negócio, com **caso obrigatório para a polaridade** (RN-08) |
| **RNF-11** | Detecção de depreciação: registrar em log o bloco `Metadados.Descontinuacao` do Senado |

### 3.3 Privacidade, ética e conformidade legal

| ID | Requisito | Origem |
|---|---|---|
| **RNF-12** | **Não persistir no servidor** nem respostas do questionário nem lista de seguidos. Estado do usuário fica **no dispositivo** (`localStorage`) — ver §2.7.2 | R7 / LGPD |
| **RNF-12a** | A API **nunca recebe** a lista de quem o usuário segue. O feed é filtrado no cliente sobre endpoints públicos por parlamentar | §2.7.2 |
| **RNF-12b** | Se a opção B ou C for adotada (RQ9), tratar a lista de seguidos como **dado pessoal sensível** (LGPD art. 5º, II — opinião política): consentimento específico, política de privacidade e exclusão sob demanda | LGPD |
| **RNF-13** | **Não republicar CPF**. Uso interno como chave; persistir apenas hash | LGPD |
| **RNF-14** | Exibir *disclaimer* em toda tela de resultado: ferramenta acadêmica, **não** recomendação de voto | R7 |
| **RNF-15** | Não exibir dado de candidatos **não eleitos** | 12-fonte-tse §5 |
| **RNF-16** | Nenhum juízo de valor sobre parlamentares na interface | Discovery §3 |
| **RNF-17** | Acesso restrito durante o **período eleitoral de 2026**, ou publicação apenas posterior | R7 |
| **RNF-18** | Crawler respeita `robots.txt`, usa User-Agent identificável e nunca contorna paywall | 20-crawler §5 |

⚠️ **RNF-17 é o requisito mais fácil de esquecer e o de maior consequência.** As eleições
gerais são em **outubro de 2026**; hoje é agosto de 2026. Uma ferramenta pública do tipo
"descubra seu político" durante o período eleitoral pode ser enquadrada como propaganda
eleitoral ou pesquisa de intenção de voto.

### 3.4 ⭐ Zero alfabetização institucional exigida

> **Princípio de projeto:** o cidadão **não precisa saber como o Congresso funciona** para
> usar o produto. Toda a complexidade institucional documentada em
> [01-camara](01-camara-dos-deputados.md) e [02-senado](02-senado-federal.md) é
> **encanamento interno** — alimenta o modelo, nunca a interface.

| ID | Requisito |
|---|---|
| **RNF-27** | O usuário **nunca escolhe** uma comissão, um órgão, um tipo de proposição ou um regime de tramitação |
| **RNF-28** | O usuário **nunca escolhe entre Câmara e Senado** — ver §3.4.1 |
| **RNF-29** | Nenhum jargão institucional aparece na interface do cidadão: *votação nominal*, *destaque*, *requerimento*, *proposição*, *substitutivo*, *conclusivo*, *polaridade*, *obstrução* |
| **RNF-30** | Resultados são expressos em termos das **perguntas que o usuário respondeu**, não em termos de votações — ver §3.4.2 |
| **RNF-31** | Termos institucionais só aparecem como **contexto descritivo** na ficha do parlamentar ("membro da Comissão de Saúde"), nunca como controle que exija decisão |

#### 3.4.1 Consequência: o seletor de casa está proibido

Isso **corrige uma decisão anterior**. O rascunho do
[Cenário C](arq/03-cenario-c-tres-bases.md) previa "UI com seletor de casa" e "dois
questionários". Pelo RNF-28, isso é inaceitável: escolher entre Câmara e Senado exige
justamente o conhecimento que o usuário não tem.

**Desenho correto:** o usuário responde **um fluxo único** de perguntas. Como as duas
casas votam matérias diferentes (achado #7), o questionário simplesmente **contém
perguntas das duas**, embaralhadas. O usuário não sabe nem precisa saber de qual casa veio
cada pergunta.

⚠️ **O número de perguntas ainda NÃO está definido** — é a pendência **RQ3**. O discovery
sugere a faixa de **15–25** como ponto de partida, mas o número final depende de uma
medição que ainda não foi feita: quantas das ~100 proposições substantivas anuais
sobrevivem ao corte de unanimidade (RN-05) e à cobertura temática (RN-06). Qualquer
número concreto citado neste documento é **ilustrativo**.

O resultado apresenta **duas listas** ("Deputados mais próximos de você" / "Senadores mais
próximos de você"), o que é autoexplicativo e não exige escolha prévia.

```mermaid
flowchart LR
    A["Fluxo único<br/>N perguntas (RQ3)"] --> B{"internamente:<br/>separa por casa"}
    B --> C["Deputados<br/>mais próximos"]
    B --> D["Senadores<br/>mais próximos"]
    C --> E["Uma tela de resultado"]
    D --> E
    style A fill:#238636,color:#fff
```

#### 3.4.2 Como expressar afinidade sem jargão — e sem perder honestidade

O RNF-19 exige mostrar o **n** de votações comparadas. Isso parece conflitar com a
linguagem simples, mas a solução resolve os dois:

| ❌ Jargão | ✅ Plano **e** transparente |
|---|---|
| "83% de afinidade em 18 votações nominais" | "Vocês concordaram em **15 das 18 perguntas** que você respondeu" |
| "Similaridade 0,72 (n=25)" | "Concordaram em 18 de 25" |

Expressar o resultado em **perguntas respondidas** é simultaneamente mais compreensível e
**mais honesto** que um percentual — o denominador fica explícito por construção, em vez
de escondido numa nota de rodapé.

### 3.5 Transparência metodológica

| ID | Requisito |
|---|---|
| **RNF-19** | Toda afinidade exibida vem acompanhada do **n** de votações comparadas |
| **RNF-20** | A **ementa original** fica sempre acessível ao lado da pergunta reescrita |
| **RNF-21** | O método de cálculo é documentado e acessível ao usuário final |
| **RNF-22** | Arquivos de carga manual são versionados com **hash SHA-256** e data de obtenção |

### 3.6 Portabilidade e operação

| ID | Requisito |
|---|---|
| **RNF-23** | Executável em máquina única de desenvolvimento — 📊 as duas matrizes ocupam **menos de 1 MB** |
| **RNF-24** | Banco em PostgreSQL, sem extensões proprietárias |
| **RNF-25** | Ambiente reproduzível por script, exceto a carga manual do TSE (RNF-22) |
| **RNF-26** | Interface responsiva; o grafo deve degradar de forma graciosa em tela pequena |

---

## 4. Regras de negócio

> 📊 = derivada de medição real nos dados.

| ID | Regra | Origem |
|---|---|---|
| **RN-01** | Similaridade é calculada **apenas** sobre votações em que ambos votaram. **Ausência nunca é imputada como zero** | Discovery §7.1 |
| **RN-02** | 📊 Pares com **menos de 20 votações em comum** são descartados — exclui 14 de 552 deputados (2,5%) | Medido |
| **RN-03** | 📊 `Abstenção`, `Obstrução`, `Artigo 17` e vazio viram `null` — somam **0,7%** dos registros | Medido |
| **RN-04** | 📊 O questionário usa **apenas** votações `SUBSTANTIVA` — 58,4% das nominais são procedimentais | Medido |
| **RN-05** | Votações com mais de **85% de um lado** são descartadas do questionário | Discovery §7.2 |
| **RN-06** | O questionário deve cobrir **múltiplos temas**, usando a classificação oficial | 📊 96% de cobertura |
| **RN-07** | Toda pergunta do questionário tem ementa **reescrita em linguagem simples** pelo operador | Discovery §7.2 |
| **RN-08** | ⚠️ Toda votação do questionário tem **`polaridade` (+1/−1)** atribuída manualmente, mapeando "Sim" para "a favor da medida" | 📊 14% têm sinal invertido |
| **RN-09** | 📊 Requerimentos **permanecem** na matriz de similaridade — são o sinal mais limpo de governo × oposição | Achado #11 |
| **RN-10** | Parlamentares de casas diferentes **nunca** entram na mesma matriz | 📊 Achado #7 |
| **RN-11** | Partido e UF são gravados **no momento do voto** | 📊 14 trocas em 2025 |
| **RN-12** | A matriz é sempre filtrada por **legislatura** | Discovery |
| **RN-13** | PEC votada em dois turnos deve ser deduplicada ou ter o efeito reportado | 01-camara §9.4 |
| **RN-14** | Sabatinas de autoridade (`AUTORIDADE`) ficam fora do questionário e dentro da similaridade | 02-senado §3.1 |

---

## 5. Restrições

| ID | Restrição | Natureza |
|---|---|---|
| **RE-01** | 📊 O TSE bloqueia acesso automatizado (HTTP 403) → carga manual obrigatória | Externa, sem contorno |
| **RE-02** | 📊 Apenas **3,8%** das votações da Câmara são nominais | Institucional |
| **RE-03** | 📊 As duas casas não compartilham votações | Institucional |
| **RE-04** | 📊 O Senado não expõe CPF | Externa |
| **RE-05** | 📊 `/plenario/lista/votacao` do Senado está depreciado | Externa |
| **RE-06** | Curadoria do questionário é **manual e não escala** | De projeto |
| **RE-07** | Stack principal em .NET (definida pelo repositório) | De projeto |
| **RE-08** | Prazo de TCC | De projeto |

---

## 6. Rastreabilidade

```mermaid
flowchart LR
    F1["F1<br/>Ingestão Câmara"] --> F2["F2<br/>Modelo + matriz"]
    F2 --> F3["F3<br/>Similaridade + grafo"]
    F3 --> F4["F4<br/>Questionário + API"]
    F4 --> F5["F5<br/>Web app"]
    F5 --> F5b["F5b 🔴<br/>Crawler + seguir + feed"]
    F3 --> F6["F6<br/>Senado"]
    F2 --> F7["F7<br/>TSE"]
    F6 --> F9["F9<br/>Ponte dep→sen"]
    F7 --> F9

    style F5b fill:#8b1a1a,color:#fff
```

| Fase | Requisitos | Entrega defensável? |
|---|---|---|
| **F1** | RF-01→04, RF-08→10, RF-15, RF-16 | Não |
| **F2** | RF-05, RF-11, RF-14 | Não |
| **F3** | RF-17→22 | Parcial |
| **F4** | RF-24→30, RF-36 | ✅ **Sim — corte mínimo do TCC** |
| **F5** | RF-31, RF-33, RF-34 | ✅ Produto completo |
| **F5b** | RF-37→40, RF-42→46 | 🔴 **Essencial** — sustenta "Recomendação de Notícias" do título |
| **F6** | RF-07, RF-13, RF-23 | Incremento |
| **F7** | RF-06, RF-12, RF-32 | Incremento |
| **F9** | Ponte deputado→senador (achado #18) | Trabalho futuro |

**F5b é a linha de corte real.** F4 já dá um resultado defensável, mas só em **F5b** os
quatro elementos do título estão entregues — ETL, grafo, afinidade **e recomendação de
notícias**. F6, F7 e F9 são incrementos.

---

## 7. Pendências

| # | Pendência | Bloqueia |
|---|---|---|
| **RQ1** | Definir o **limiar de similaridade** para renderização do grafo | RF-33 |
| **RQ2** | Definir a métrica formal de comparação comunidade × partido (ARI? modularidade?) | RF-20 |
| **RQ3** | Definir o **N final** de perguntas do questionário | RF-24 |
| **RQ4** | Confirmar se existe orientação de bancada no Senado | RF-22 no Senado |
| **RQ5** | Decidir a forma de **RNF-17** (acesso restrito): autenticação simples, ambiente local, ou adiar publicação | RNF-17 |
| **RQ6** | Definir critérios de aceitação mensuráveis para os RF essenciais | Validação |
| **RQ7** | Definir o **mecanismo de recomendação** — por parlamentar afim, por tema, ou híbrido — e como avaliá-lo | Sem métrica, "recomendação" vira "listagem filtrada" |
| ~~RQ8~~ | ✅ **RESOLVIDA — 2026-08-23.** *"em Redes Sociais"* = **o grafo**, confirmado pelo autor. Não envolve plataformas (X, Instagram) | — |
| **RQ9** | Escolher entre **A / B / C** para onde vive a lista de seguidos (§2.7.2). Enquanto isso, implementar **A** | LGPD e R7 |
| **RQ10** | Decidir se o **feed agregado** (RF-43) entra. Recomendação: decidir tarde — classificar por tema desde já mantém a porta aberta a custo zero | §2.7.3 |
