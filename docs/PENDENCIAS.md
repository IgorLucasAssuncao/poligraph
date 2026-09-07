# Pendências — visão consolidada

> **Atualizado:** 2026-08-26 · **62 resolvidas · 54 abertas**
> As pendências vivem espalhadas por 11 documentos. Esta é a visão única, agrupada
> **pelo que destrava cada uma** — que é o que importa na hora de decidir o que fazer.
> 🔴 **O questionário ganhou seção própria** — estava subestimado num bloco de *"trabalho
> manual"*, fora dos bloqueios.

---

## ✅ Decidido na rodada de infraestrutura e privacidade (2026-08-25)

| # | Decisão |
|---|---|
| **PL2** | ✅ **Hostinger VPS KVM 2** — 2 vCPU · 8 GB · 100 GB · São Paulo |
| **PL4** | ✅ Repositório privado |
| **PL6** | ✅ **Clarity em produção, gravando tudo**, com consentimento prévio bloqueante |
| **PL8** | ✅ Todas as telas recebem o script — a proteção é o consentimento, não a máscara |
| **PL9** | ✅ Banner de consentimento **necessário e bloqueante** |
| **RQ9** | ✅ **Login Google + perfil completo em claro** — 🔄 minimização revogada em 2026-08-25 |
| **PL28** | ✅ Resolvida por consequência — nome e sobrenome estão no banco |
| **PL13** | ✅ **EF Core migrations** — não script SQL à mão (2026-08-26) |

> 🔑 **As duas decisões desta rodada empurram na mesma direção:** o projeto passou a
> guardar mais coisa (sessão gravada, lista de seguidos no servidor) e a compensar isso
> com **consentimento explícito**, em vez de com ausência de dado. Isso é defensável, mas
> transfere o peso para textos que ainda não existem — as **PL7** e **PL25** abaixo.

---

## 🔴 Bloqueiam a construção — decida antes de codar

| # | Pergunta | Onde |
|---|---|---|
| **PL25** | 🔴 Escrever o **texto do banner de consentimento** cobrindo as 5 exigências | [plano/02 §4.5.2](plano/02-autenticacao-e-metricas.md) |
| **PL26** | 🔴 Serviço de envio de e-mail (Resend, Brevo, SES) + **SPF, DKIM e DMARC** no domínio | [plano/02 §3.3.2](plano/02-autenticacao-e-metricas.md) |
| **PL27** | 🟡 Cadência do digest — diário, semanal, ou por volume | [plano/02 §3.3](plano/02-autenticacao-e-metricas.md) |
| **PL29** | 🟡 Duração do cookie de sessão (sugerido: 7 dias) | [plano/02 §3.2.4](plano/02-autenticacao-e-metricas.md) |
| **PL30** | 🔴 Persistir as chaves do Data Protection — senão todo redeploy desloga todo mundo | [plano/02 §3.6.4](plano/02-autenticacao-e-metricas.md) |
| **PL7** | 🔴 **Política de privacidade** — virou bloqueante: é campo obrigatório da tela do Google | [plano/02 §3.2.1](plano/02-autenticacao-e-metricas.md) |
| **PL24** | 🔴 Confirmar com o orientador se o TCC precisa de **Comitê de Ética** | [plano/02 §4.5](plano/02-autenticacao-e-metricas.md) |
| **PL33** | 🔴 **Novo:** os termos do Clarity dizem que ele não deve ser usado em sites dirigidos a menores de 18. No Brasil vota-se aos 16 — decidir junto com a PL24 | [plano/08 §2.2](plano/08-obter-as-chaves.md) |
| **PL23** | 🔴 CI como **portão** do deploy, ou os dois em paralelo? | [plano/01 §2.1.2](plano/01-arquitetura.md) |
| **PL3** | 🔴 **Subiu para bloqueante** — o login com Google exige domínio, e o e-mail exige SPF/DKIM/DMARC nele | [plano/01](plano/01-arquitetura.md) |
| 🔴 **PL11** | **Curar as 15–25 perguntas** — ⚠️ **o maior bloqueio de todos**, detalhado abaixo | [plano/03](plano/03-questionario.md) |
| 🔴 **RQ3** | **N final de perguntas** — a PL11 não começa sem esta definida | [03-requisitos](03-requisitos.md) |

⚠️ **PL7 e PL25 são texto jurídico, não código** — e agora estão no caminho crítico do
login e do Clarity. São o tipo de tarefa que não dá para fazer na véspera.

---

## 🔴 O QUESTIONÁRIO — a frente mais bloqueante do projeto

> ⚠️ **Corrigido em 2026-08-26.** Estas pendências existiam, mas ficavam num bloco chamado
> *"trabalho manual"*, fora da seção de bloqueios — o que **subestimava** a única frente
> que trava o passo 8 inteiro. A RQ3 ainda aparecia como 🟡 aqui, embora seja 🔴 no
> documento de origem.

| # | Pendência | Prioridade | Esforço |
|---|---|---|---|
| 🟢 **PL11** | ✅ **Resolvida (2026-08-29)** — **50 perguntas no poço**, 41 da Câmara e 9 do Senado. ⛔ O critério ⛔ não foi divisão: 106 das 703 duplas entre as candidatas dividem a Câmara IGUAL, e a seleção gulosa mediu cobertura de pares. Detalhe abaixo | 🟢 Baixa | — |
| 🟢 **RQ3** | ✅ **Resolvida (2026-08-29)** — **24 perguntas**, sendo 8 de abertura da Câmara, as 9 do Senado e 7 de desempate dirigido. Medido: 15 adaptativas valem 25 fixas | 🟢 Baixa | — |
| 🟢 **PL10** | ✅ **Virou o desenho, ⛔ não experimento** — o desempate dirigido está no ar. Medido: empate mediano 6 (dirigido) contra 14 (fixo) e 16 (sorteado) | 🟢 Baixa | — |
| ~~PL12~~ | ✅ **Teste do jantar** — entra se dá para discutir num jantar sem explicar a proposta | — | — |
| 🟢 **CT7** | ✅ **Resolvida (2026-08-29)** — 60%, mas do que é **OFERECIDO** (24), ⛔ não do poço (50). Sobre o poço daria 30 respostas num questionário de 24, e o resultado seria impossível de obter | 🟢 Baixa | — |
| **PL18** | Usar LLM para rascunhar a reescrita das ementas? | 🟡 Média | — |
| **A2** | Regex de `categoria`, validadas contra amostra rotulada à mão | 🟡 Média | 🟡 Horas |
| **A3** | Deduplicação de PEC em dois turnos | 🟡 Média | — |
| **A4** | Quantas das 100 proposições sobrevivem ao corte de unanimidade | 🟡 Média | — |
| **PL34** | 🔵 **Adiada por decisão do autor:** gravar as respostas individuais do questionário, SEM vínculo com a conta, para analisar quais perguntas dividem e quais ninguém entende (§ abaixo) | 🔵 Futuro | — |
| ~~API4~~ | ✅ **Resolvida** — cosseno no grafo, concordância simples na tela (plano/07 §4.5) | — | — |
| 🟡 **PL44** | 🔄 **Avançou** — a ingestão deduz a legislatura pela data e as **consultas já filtram** (PL35 ✅). ⛔ Falta a parte de **produto**: o que a tela mostra na virada, e o que acontece com quem respondeu o questionário na 57ª. ⏳ **A 57ª termina em janeiro de 2027** | 🟡 Média | 🟢 Decisão |
| ✅ ~~PL45~~ | **Resolvida (2026-09-06)** — ⭐ sobrou **0**. O desempate da [PL47](#-pl47-a-causa-raiz-nao-era-reconciliacao) resolveu todos: quando só um homônimo tem voto na base, é ele. ⛔ Ninguém a decidir | 🟢 Baixa | — |
| 🟢 **PL50** | ✅ **Resolvida (2026-08-29)** — 359 matérias do Senado ingeridas, **421 de 421 votações vinculadas (100%)**. A colisão de id foi resolvida com chave composta `(casa, id)`, ⛔ não com deslocamento aritmético. Detalhe abaixo | 🟢 Baixa | — |
| ✅ ~~PL51~~ | **Resolvida (2026-09-06)** — o autor desligou o Smart App Control. `dotnet test` e `dotnet ef` voltaram a rodar **nativos**. ⚠️ ⛔ Irreversível: no Windows 11 o SAC só religa reinstalando o sistema | 🟢 Baixa | — |
| 🟢 **PL47** | ✅ **Resolvida até o limite da fonte (2026-08-29)** — as duas regras entraram: **106 → 81** deputados sem emenda, autores pendentes **169 → 101**, e **93,6%** das emendas com dono. ⛔ Os 81 restantes ⛔ não têm emenda no Portal — sondado por nome. Detalhe abaixo | 🟢 Baixa | — |
| ✅ ~~PL46~~ | **Resolvida (2026-09-06)** — resolveu-se sozinha, como previsto: a PL42 trouxe o Senado e ⭐ **0** dos 101 autores pendentes casa com senador. O código do autor é de **mandato** ([achado #24](achados/024-codigo-da-emenda-identifica-o-mandato.md)) | 🟢 Baixa | — |
| ~~PL35~~ | ✅ **Resolvida (2026-08-27)** — `Legislaturas` DERIVA a legislatura do dado, nunca de configuração. `TestesLegislatura` semeia **duas** legislaturas e prova que a segunda ⛔ não vaza; as três mutações matam os três filtros. § abaixo mantido como registro | — | — |
| ~~PL36~~ | ✅ **Resolvida (2026-08-26)** — nomes corrigidos e **verificado rodando o container contra o banco real**: monta a matriz e grava `execucoes`. Estava faltando também traduzir a connection string do Aspire (§ abaixo) | — | — |
| ~~PL37~~ | ✅ **Resolvida (2026-08-27)** — `test_contrato_schema.py` cobre agora **nomes de tabela, nomes de coluna e os literais combinados** entre os dois lados (`FUNDO ESPECIAL`, `ck_autor_metodo`). ⭐ O próprio parser tem teste que morre sob mutação — sem ele, uma exceção mal posta o deixaria cego e verde | — | — |
| ~~PL39~~ | ✅ **Resolvida (2026-08-26)** — legislatura 57 inteira ingerida: 470.786 votos, 5.268 arestas | — | — |
| ✅ ~~PL43~~ | **Resolvida (2026-08-28)** — detalhe abaixo. O índice ficou desatualizado por uma semana, que é o defeito que esta linha corrige | 🟢 Baixa | — |
| 🟢 **PL42** | ✅ **Resolvida (2026-08-27)** — ingestão, curadoria e produto. 7 perguntas do Senado ativas, questionário misto de 28, resultado com **uma lista por casa**, grafo próprio de cada uma. ⛔ Resta a ficha do parlamentar, que ainda não distingue casa. Detalhe abaixo | 🟢 Baixa | 🟡 Horas |
| ~~PL41~~ | ✅ **Resolvida (2026-08-26)** — o seed foi **aposentado** por decisão do autor: com o ETL funcional, só o schema precisa ser inicializado. O semeador virou `Poligraph.Tests/Fixtures/DadosDeTeste.cs` | — | — |
| ✅ ~~PL40~~ | **Resolvida (2026-08-28)** — detalhe abaixo. ⭐ **1.042** proposições no banco (683 Câmara + 359 Senado), e a ementa chegou à ficha e à curadoria | 🟢 Baixa | — |
| ~~PL38~~ | ✅ **Resolvida (2026-08-26)** — `arestas_grafo` e `nos_metrica` gravadas; Louvain + layout de molas com semente fixa; 30 comunidades em 655 nós. ⚠️ `governismo` e `disciplina` seguem nulos: dependem de `votacoesOrientacoes`, ainda não ingerido | — | — |

### ✅ PL50 (resolvida em 2026-08-29) — a ementa do Senado entrou

**Medido em 2026-08-29.**

⚠️ **⛔ NÃO é limitação da fonte** — ao contrário dos achados
[#17](achados/017-senado-maioria-secreta.md), [#24](achados/024-codigo-da-emenda-identifica-o-mandato.md)
e [#28](achados/028-o-senado-nao-publica-orientacao-de-bancada.md), onde o Senado
publica **menos** que a Câmara. Aqui ele publica **mais**: `/materia/{codigo}` devolve
`EmentaMateria` **e** `IndexacaoMateria`, o vocabulário controlado que diz o assunto — a
Câmara ⛔ não tem equivalente no CSV.

⭐ A lacuna é **nossa**: `proposicoes.py` tem `CASA = "CAMARA"` e lê só o CSV da Câmara.
⛔ Ninguém escreveu o caminho do Senado.

📐 A mesma votação, nos dois lugares:

> **No banco** — `SF-7101`, ementa `NULL`:
> *"Votação nominal do Substitutivo da Câmara dos Deputados ao Projeto de Lei
> Complementar nº 124, de 2022, na forma do texto consolidado apresentado pelo parecer."*
>
> **Na fonte** — matéria 171682, `PLP 124/2022`:
> *"Altera o Código Tributário Nacional, a fim de estabelecer normas gerais sobre solução
> de controvérsias, consensualidade e processo administrativo em matéria tributária e
> aduaneira."*

| | |
|---|---:|
| Votações do Senado na 57ª | 421 |
| 🔴 **Com proposição vinculada** | **0** |
| Matérias distintas nas votações | 359 |
| Chamadas a `/materia/{codigo}` para trazer tudo | 359 |

⭐ **A fonte existe e já está no código.** `senado.baixar_indexacao` foi escrita para
isto e está **órfã** desde então — ⛔ nenhum módulo a chama. O endpoint devolve `ementa`
e `IndexacaoMateria`, que é o vocabulário controlado e diz o assunto.

#### 🔴 O que trava: os dois ids vivem no mesmo namespace

`proposicoes.id` é o id da proposição **na Câmara**. O Senado tem `codigoMateria`, que é
outra numeração — e as faixas **se sobrepõem**:

| | Faixa |
|---|---|
| Proposições da Câmara (683) | 106.701 a **2.638.483** |
| 🔴 Códigos do Senado (359) | **121.883** a 175.446 |

📐 **Colisões hoje: 0.** ⚠️ Mas **3 proposições da Câmara já estão dentro da faixa do
Senado** — colisão é questão de tempo, ⛔ não hipótese. E uma colisão ⛔ não daria erro:
vincularia a votação do Senado à **ementa de um projeto da Câmara**, e a ficha exibiria
um assunto plausível e errado.

#### ✅ A saída escolhida: chave composta `(casa, id)`

⭐ **⛔ Não foi preciso coluna nova em `votacoes`** — a chave estrangeira usa a `casa` que
a votação **já tem**, e que já carrega o valor certo:

```sql
ALTER TABLE proposicoes ADD casa text NOT NULL DEFAULT 'CAMARA';
ALTER TABLE proposicoes ALTER COLUMN casa DROP DEFAULT;
ALTER TABLE proposicoes ADD CONSTRAINT ak_proposicoes_casa_id PRIMARY KEY (casa, id);
ALTER TABLE votacoes ADD CONSTRAINT fk_votacoes_proposicoes_casa_proposicao_id
    FOREIGN KEY (casa, proposicao_id) REFERENCES proposicoes (casa, id);
```

⛔ **Descartadas:** deslocar o id do Senado (`+ 1e9`) seria namespace por aritmética,
implícito na leitura; tabela separada duplicaria a mesma entidade por causa da numeração.

🔴 **O `DROP DEFAULT` ⛔ não é detalhe.** O `'CAMARA'` existe só para preencher as 683
linhas antigas — todas da Câmara, porque só ela era ingerida. Mantê-lo faria um `INSERT`
sem `casa` cair silenciosamente na Câmara, e uma matéria do Senado gravada assim viraria
proposição da casa errada **sem erro nenhum**.

⚠️ **O scaffold do EF gerou `defaultValue: ""`**, o que teria feito a migration falhar:
com `casa = ''` o `AddForeignKey` ⛔ não acharia linha para os 1.587 vínculos existentes
— e num banco com dado real ela falharia **depois** de já ter derrubado a chave antiga.

#### 🔴 A chave estrangeira ⛔ não basta

⚠️ A FK garante que o **vínculo** seja da mesma casa. Um `SELECT` que ligue as tabelas
apenas por `id` lê a linha errada **assim mesmo**. Dois lugares tinham esse ponto cego e
foram fechados junto:

| Onde | O que faria |
|---|---|
| `curadoria.py` | Mostraria a ementa de um projeto da Câmara ao lado de uma votação do Senado |
| `persistencia.desconectar_proposicoes_ausentes` | Uma proposição da Câmara faria a do Senado **parecer existente**, o vínculo sobreviveria à limpeza e a FK derrubaria a ingestão do ano |

#### 📐 O resultado

| | Câmara | Senado |
|---|---:|---:|
| Proposições | 683 | **359** |
| Votações vinculadas | 1.587 de 1.594 (99,6%) | ⭐ **421 de 421 (100%)** |


---

### ✅ PL48 (resolvida em 2026-08-29) — 12 migrations viraram uma

Eram **12** arquivos, ⛔ não os 8 que esta pendência registrava — o número cresceu
durante o desenvolvimento, que é exatamente o argumento para consolidar.

| | |
|---|---:|
| Arquivos de migration | 12 → ⭐ **1** |
| Linhas | 1.193 → 40 KB numa `Inicial` |
| 🔴 Deploy já feito? | ⛔ **Não** — a PL3 (domínio) ainda bloqueia |

⭐ **A janela estava aberta**, e ⛔ não estaria depois do primeiro deploy.

#### 📐 Como foi conferido, e ⛔ não presumido

⚠️ **Consolidar migration é reescrever o schema.** A verificação foi comparar o banco
real contra um banco limpo criado só pela migration nova:

```sql
-- 397 definições de cada lado: colunas (tipo, nulidade, default),
-- constraints (PK, FK, CHECK, UNIQUE) e índices
SELECT 'COL ' || table_name || '.' || column_name || ' ' || data_type ...
UNION ALL SELECT 'CON ' || conrelid::regclass || ' ' || pg_get_constraintdef(oid) ...
UNION ALL SELECT 'IDX ' || tablename || ' ' || indexdef ...
```

| | |
|---|---:|
| Schema atual (12 migrations) | **397** definições |
| Schema consolidado (1) | **397** definições |
| 🔴 **Diferenças** | ⭐ **0** |

⭐ E os **133 testes .NET** passam: eles criam Postgres novo e aplicam a migration, o que
torna a validação de ponta a ponta, ⛔ não só um diff.

#### ⚠️ O que se perde, e por que ⛔ não importa

Os comentários dentro das migrations antigas — como a armadilha do `DROP DEFAULT` em
`ProposicaoPorCasa` — somem. ⭐ Mas eles ⛔ não eram a fonte da verdade: o conteúdo vive
nos achados e aqui, e o histórico literal segue no git.

#### ⭐ E destravou a PL49

⚠️ Consolidar deixou a mudança seguinte **barata**: mover **um** arquivo, ⛔ não doze com
doze `Designer` junto. ✅ A [PL49](#-pl49-resolvida-em-2026-09-06--a-migration-foi-para-quem-a-aplica)
foi resolvida logo depois.

#### ⚠️ Foi preciso container para gerar

🔴 A **PL51** bloqueou: `dotnet ef migrations add` ⛔ não roda nesta máquina, porque o
Smart App Control barra o binário recém-compilado. O contorno do rebuild limpo ⛔ **não
funcionou** desta vez — a geração saiu no container, pela mesma receita dos testes.

⭐ Isso reclassifica a PL51: ela ⛔ não atrapalha só teste, ela **bloqueia trabalho de
schema**.



---

### ✅ CT4 (resolvida em 2026-09-06) — estágio de qualidade no CI

🔴 **Achado antes de escrever qualquer coisa: o `ci.yml` estava QUEBRADO.**

```
Your startup project 'Poligraph.Api' doesn't reference Microsoft.EntityFrameworkCore.Design.
```

O job `migration` chamava `dotnet ef … -p src/Poligraph.Api`. ⚠️ A
[PL49](#-pl49-resolvida-em-2026-09-06--a-migration-foi-para-quem-a-aplica) tirou o pacote
`Design` da API no mesmo dia e ⛔ não atualizou o CI. Corrigido para
`-p src/Poligraph.Migrations` — script de **600 linhas, 24 tabelas**, conferido.

#### 🔴 E o gatilho apontava para um branch órfão

Medido em **2026-09-06**, com `git ls-tree` em cada branch remota:

| Branch remota | Commits | Arquivos | Tem `.github/` |
|---|---:|---:|---|
| **`main`** ← *padrão do GitHub* | **1** | **2** | ⛔ **não** |
| `master` | 173 | 249 | ✅ |
| `senado-enums-e-nova-interface` | 211 | 269 | ✅ |

⚠️ **`main` ⛔ não é ancestral de `master`** — são históricos separados. É o padrão de
repositório criado no GitHub com README, com o histórico local empurrado depois.

🔴 O `ci.yml` disparava em `push: branches: [main]`. **O gatilho de push ⛔ nunca
disparou, nenhuma vez.** O que rodava era só o `pull_request`, que ⛔ não tem filtro.

⭐ Corrigido para `[master]`, e entrou `workflow_dispatch`.

> ⚠️ **Falta uma ação fora do repositório:** trocar o **branch padrão** para `master` nas
> configurações do GitHub. Enquanto for `main`, o botão *"Run workflow"* ⛔ não aparece —
> o GitHub só o oferece se o arquivo com o gatilho existir no branch padrão.
>
> ⚠️ **Conferir também o Coolify**, que faz deploy por webhook no push: se ele estiver
> ouvindo `main`, está ouvindo um branch que ⛔ nunca recebe nada.

#### O que o job `qualidade` faz

| Linguagem | Cobertura | Propriedade do Sonar |
|---|---|---|
| C# | `--collect:"XPlat Code Coverage;Format=opencover"` | `sonar.cs.opencover.reportsPaths` |
| Python | `pytest --cov --cov-report=xml` | `sonar.python.coverage.reportPaths` |
| TS/React | `vitest --coverage --coverage.reporter=lcov` | `sonar.javascript.lcov.reportPaths` |

📐 Os três formatos foram gerados e conferidos localmente antes de entrar no YAML.
Cobertura medida hoje: **62,3%** no ETL, **43,6%** no front.

#### 🔴 Três coisas que ⛔ não são óbvias

| | |
|---|---|
| **O job repete build e testes** | O scanner de C# precisa **envolver** o build (`begin` → `dotnet build` → `end`): ele lê a saída do compilador, ⛔ não o código parado. Como os jobs correm em paralelo, o custo é minuto de runner, ⛔ não espera |
| **`sonar.scanner.scanAll=true`** | Sem isso o scanner de .NET olha só o que passa pelo MSBuild — ⛔ **Python e TS ficariam de fora**, que é metade do projeto |
| **`fetch-depth: 0`** | Clone raso apaga o histórico, e o quality gate decide sobre **código novo**. Sem o histórico, ⛔ não há "novo" |

⚠️ `src/Poligraph.Migrations/Migrations/**` está em `sonar.exclusions`: são **397 definições
geradas** pelo `dotnet ef`, que inundariam o relatório com dívida que ninguém escreveu.

#### 🔴 O que ainda bloqueia

**O plano gratuito do SonarQube Cloud cobre APENAS repositórios públicos**, e
`IgorLucasAssuncao/poligraph` está privado (`api.github.com` devolve 404 sem
autenticação). As saídas são: tornar o repositório **público**, pagar o plano por linhas
de código, ou auto-hospedar o **SonarQube Community Build** — que ⛔ não tem análise de PR
nem as regras de *taint analysis*.

⚠️ **Sem o segredo `SONAR_TOKEN` o job fica VERDE com todos os passos pulados.** ⛔ Verde
ali ⛔ não significa "analisado" — por isso o primeiro passo emite um
`::warning` dizendo exatamente isso.

#### ⭐ Como virar portão

Acrescentar `/d:sonar.qualitygate.wait=true` ao `begin`. Ficou **fora** de propósito: até
a primeira análise calibrar o que é dívida herdada, o primeiro PR reprovaria por código
que já estava lá.

#### Limpeza que veio junto

⭐ `UnitTest1.cs` removido — esqueleto do template `dotnet new xunit`, **sem asserção
nenhuma**, e fora dos filtros `~Unidade`/`~Integracao` do CI. Por isso a contagem caiu de
160 para **159**: ⛔ não se perdeu teste, tirou-se o que ⛔ nunca testou nada.

📐 As contagens de Python e front estavam **defasadas no README**: eram 282 e 37, e o
medido hoje é **416** e **97**.
---

### ✅ CT3 (resolvida em 2026-09-06) — o contrato existia, mas estava vazio

O `AddOpenApi()`/`MapOpenApi()` já estavam no `Program.cs`. ⚠️ **O documento que eles
geravam ⛔ não tinha esquema nenhum** — `components.schemas` vinha vazio.

🔴 **Motivo:** todo handler devolve `Task<IResult>`, e daí o ASP.NET ⛔ não infere forma
de resposta. O OpenAPI publicava a rota e **⛔ nada** sobre o que ela devolve.

| | Antes | Depois |
|---|---|---|
| Esquemas no documento | **0** | ⭐ **31** |
| Rotas publicadas | 17 (de 18 mapeadas) | ⭐ **18** |
| Testes .NET | 133 | ⭐ **160** |

#### O que entrou

| Peça | Papel |
|---|---|
| `Scalar.AspNetCore` 2.17.2 | ⭐ `/scalar` — documentação navegável, **só em Development** |
| `.Produces<T>()` em 17 rotas | 🔴 É o que faz o esquema existir, ⛔ não enfeite |
| `TestesContratoOpenApi.cs` | 27 testes: 17 rotas + 9 DTOs + o enum + o documento |

⚠️ **O `/scalar` ⛔ NÃO sobe em produção.** Ele expõe `DELETE /api/auth/conta` e
`POST /api/auth/sair-de-todos` num formulário pronto para disparar — está dentro do
`if (app.Environment.IsDevelopment())`, junto do `MapOpenApi()`.

#### 🔴 O que ele achou de cara

`/api/auth/logout` estava **mapeada** e mesmo assim ⛔ **fora do documento**. `MapPost`
tinha ligado na sobrecarga `RequestDelegate` — rota terminal, que **descarta o
`IResult`**. O `Results.NoContent()` ⛔ nunca era escrito: a resposta saía **200**.

⚠️ **Havia teste de logout, e ele passava.** O `SignOutAsync` roda antes do `return`,
então o acesso caía e o teste ficava verde. 📐 O caminho inteiro está no
[achado 032](achados/032-a-rota-que-o-contrato-dizia-nao-existir.md).

⭐ `ASP0016` virou `error` no `.editorconfig` — o aviso existia e estava se perdendo no
meio dos `CA1305`.

#### ⚠️ O que este teste ⛔ NÃO garante

Ele confere **metadado**, ⛔ não o corpo devolvido: `.Produces<T>()` pode mentir sobre o
tipo real. ⭐ Por isso ele ⛔ não anda sozinho — os outros 133 testes de integração
desserializam a resposta de verdade. **A lista de rotas e campos é escrita à mão a partir
de `src/web/src/api.ts`**: se o front passar a ler um campo novo e ninguém o acrescentar
aqui, o teste ⛔ não acusa. É o custo conhecido do formato.
---

### ✅ PL49 (resolvida em 2026-09-06) — a migration foi para quem a aplica

O artefato estava no projeto errado: `Poligraph.Api/Data/Migrations`, com a
`FabricaDesignTime` junto — e é a fábrica que faz o `dotnet ef` eleger o projeto-alvo.

⛔ **A API ⛔ nunca migra** (regra do CLAUDE.md), mas o comando pedia
`-p src/Poligraph.Api`, contradizendo a própria regra.

| | Antes | Depois |
|---|---|---|
| Migrations | `Poligraph.Api/Data/Migrations/` | ⭐ `Poligraph.Migrations/Migrations/` |
| `FabricaDesignTime` | `Poligraph.Api/Data/` | ⭐ `Poligraph.Migrations/` |
| Namespace | `Poligraph.Api.Data.Migrations` | `Poligraph.Migrations.Migrations` |
| Comando | `dotnet ef … -p src/Poligraph.Api` | ⭐ `dotnet ef … -p src/Poligraph.Migrations` |

#### 🔴 `MigrationsAssembly` ⛔ não é detalhe

⚠️ O **contexto** (`PoligraphDb`) continua em `Poligraph.Api`, e o EF procura migration no
assembly **do contexto** por padrão. Sem declarar o assembly, ⛔ ele ⛔ não acharia
nenhuma — e `MigrateAsync` ⛔ **não daria erro**: criaria um banco **vazio**.

⭐ O nome vive num lugar só, `FabricaDesignTime.Assembly`, e os três pontos o usam:

| Onde | Por quê |
|---|---|
| `FabricaDesignTime` | Senão o scaffold geraria uma `Inicial` nova por cima do schema que já existe |
| `Poligraph.Migrations/Program.cs` | É quem aplica |
| `Poligraph.Tests/BaseIntegracao.cs` | Cada teste de integração migra um Postgres novo |

⭐ **133 testes .NET passam** — e eles criam banco do zero e aplicam a migration, então
provam o caminho inteiro, ⛔ não só a compilação.

#### ⭐ Por que agora e ⛔ não antes

A [PL48](#-pl48-resolvida-em-2026-08-29--12-migrations-viraram-uma) tinha acabado de
consolidar 12 arquivos em 1. ⚠️ Mover **doze** arquivos com doze `Designer` seria a mesma
mudança com doze vezes mais superfície de erro.
---

### ✅ PL51 (resolvida em 2026-09-06) — o Smart App Control foi desligado

**Medido em 2026-08-29.**

⛔ **⛔ NÃO é defeito do código.** É política de segurança do Windows, e ⛔ nenhuma
mudança no repositório contorna.

#### O que acontece

```
Unhandled exception. System.IO.FileLoadException: Could not load file or assembly
'…\Poligraph.Migrations\bin\Debug\net10.0\Poligraph.Migrations.dll'.
Uma política de Controle de Aplicativo bloqueou este arquivo. (0x800711C7)
```

📐 Medido: **8 execuções seguidas, 8 bloqueadas.** ⛔ ⛔ Não é intermitente.

| Evidência | |
|---|---|
| Registro do Windows | `Microsoft-Windows-CodeIntegrity/Operational`, eventos **3118** (*Smart App Control Block*), 3077 e 3033 |
| Bloqueios registrados | **193**, o primeiro em **2026-08-29 01:02** |
| Estado da política | `VerifiedAndReputablePolicyState = 1` — **imposição** |

#### 🔴 O efeito prático

| O quê | Estado |
|---|---|
| `dotnet build` | ✅ Compila normalmente |
| `dotnet test` | ⛔ **Bloqueado** — a suíte roda em container (skill `testes` §6.1) |
| 🔴 `dotnet run --project src/Poligraph.AppHost` | ⛔ **⛔ NÃO sobe** |

⚠️ **O sintoma engana.** O Aspire ⛔ não diz "bloqueado": o `migracoes` sai com código
diferente de zero, o `WaitForCompletion` marca a API como `FailedToStart`, e o painel
fica de pé sem API nem front. ⭐ Parece **lentidão**, e foi lido como lentidão mais de
uma vez.

#### ⭐ O contorno: rebuild limpo

🔴 **A primeira versão desta pendência afirmou que o problema era permanente e que ⛔ não
adiantava esperar. Estava errado.** O bloqueio é por **arquivo**, ⛔ não pelo projeto:

| Tentativa | Resultado |
|---|---:|
| Mesmo `.dll`, 8 execuções | ⛔ **8 bloqueadas** — ⛔ não é intermitente |
| Depois de `rm -rf bin obj` e rebuild | ⭐ **Rodou** |
| `Poligraph.Api.dll` no mesmo momento | ⭐ Carregava normalmente |

⭐ **Um binário ficou marcado, o outro ⛔ não.** Um rebuild limpo produz um arquivo que o
SAC aceita:

```bash
rm -rf src/Poligraph.Migrations/bin src/Poligraph.Migrations/obj
dotnet build src/Poligraph.Migrations
```

⚠️ **Isto ⛔ não é garantia** — foi medido uma vez, e ⛔ não há como prever qual arquivo
o SAC vai marcar. Se voltar a acontecer, o contorno é o mesmo.

#### ✅ Como terminou

📐 Verificado em **2026-09-06**, depois de o autor desligar pela interface do Windows:

| | |
|---|---:|
| `VerifiedAndReputablePolicyState` | **0** — desligado |
| Bloqueios do SAC desde 29/08 | **0** |
| `dotnet test` **nativo** | ⭐ **133 de 133** |
| `dotnet ef migrations list` | ⭐ funciona |

⚠️ **O comando de registro ⛔ não funcionou**, nem para o autor: `Set-ItemProperty` em
`HKLM:\SYSTEM\...\CI\Policy` devolve *"Acesso ao Registro solicitado ⛔ não é
permitido"* mesmo com o caminho certo — o SAC protege a chave. ⭐ **O caminho que
funciona é a interface:** *Configurações → Privacidade e segurança → Segurança do Windows
→ Controle de aplicativos e navegador → Controle de aplicativo inteligente*.

🔴 **⛔ Não tem volta.** No Windows 11 o SAC só é religado **reinstalando o sistema**.

⭐ A receita em container da skill `testes` §6.1 **fica**: ela é o que o CI usa, e é o
plano B se a máquina mudar.

#### Se o contorno parar de funcionar

| Caminho | Custo | Objeção |
|---|---|---|
| **Desligar o Smart App Control** | Um comando, com reinício | 🔴 **Irreversível**: no Windows 11 ele só volta a ser ligado **reinstalando o sistema** |
| **Assinar os binários** | Certificado de code signing | ⚠️ Custa dinheiro |
| **Rodar tudo em container** | Reescrever o fluxo local | ⛔ Joga fora o Aspire, que é a decisão de arquitetura do projeto |

```powershell
# PowerShell COMO ADMINISTRADOR, e reiniciar depois
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy' `
                 -Name 'VerifiedAndReputablePolicyState' -Value 0
```

⚠️ **`dotnet test` local ⛔ não foi retestado** depois do contorno — a receita em
container da skill `testes` §6.1 continua sendo o caminho conhecido.

---

### 🟡 PL47 — 92 deputados sem nenhuma emenda vinculada

**Medida em 2026-08-27**, respondendo à pergunta do autor: *"conseguimos todos os
deputados, ou teve algum caso de erro que precisamos tratar?"*

| Fonte | Cobre | Falta |
|---|---:|---:|
| `cpf_hash` · foto · grafo | 643 | **0** |
| Cota (CEAP) | 642 | 1 |
| Receitas (TSE) | 642 | 1 |
| 🔴 **Emendas** | **551** | **92** |

⭐ **As duas lacunas de 1 são AUSÊNCIA REAL, ⛔ não falha nossa** — e isso foi conferido,
⛔ não suposto:

- **Cota:** um suplente com 48 votos (abr–jul/2026). Contadas as linhas dele no arquivo da
  Câmara: **zero**. ⛔ Não é o de-para que falhou; ele ⛔ não gastou cota
- **TSE:** um suplente com 6 votos que ⛔ não foi candidato a deputado federal em 2022

### 🔴 Por que os 92 incomodam

**Emenda individual é impositiva desde a EC 86/2015** — todo deputado tem direito a um
valor. Logo, deputado de mandato inteiro sem **nenhuma** emenda é sinal de que a
reconciliação falhou, ⛔ não de que ele não apresentou.

| Sem emenda, por volume de voto | |
|---|---|
| 1 a 50 votos | 15 — ⭐ suplentes, plausível |
| 51 a 200 | 46 |
| 201 a 600 | 20 |
| 🔴 **mais de 600** | **12** — ⚠️ mandato praticamente inteiro |

### O que a checagem dos 12 revelou

Comparando o nome deles contra os 159 autores pendentes, por semelhança:

| Achado | |
|---|---|
| ✅ **Um caso REAL** | `4511 DR. ALLAN GARCES` = *Allan Garcês*. ⭐ Confirmado pelo destino das emendas: **Maranhão**, e ele é deputado por MA. Resolvido com `emendas --resolver 4511=43` |
| ⛔ **Seis falsos positivos** | `LUIZ CARLOS`, `RODRIGO CUNHA`, `LASIER MARTINS`, `CIRO NOGUEIRA`, `CARLOS VIANA`, `AUGUSTA BRITO` — todos **senadores**, ⛔ não os deputados parecidos |

> 🔴 **É a evidência empírica contra o casamento aproximado.** Um único acerto para seis
> erros — e os seis erros seriam **silenciosos**, colocando emenda de senador na ficha de
> deputado. Por isso a reconciliação automática usa **igualdade exata** do nome
> normalizado e desiste no resto.

### O que foi testado e ⛔ NÃO compensou

| Regra candidata | Resolve, dos 159 |
|---|---|
| Casar também por `nome_civil` | **0** |
| Tirar prefixo de tratamento (`DR.`, `PASTOR`, `CORONEL`…) antes de casar | **1** — e cria 9 ambiguidades novas |

⚠️ **1 de 159 ⛔ não sustenta uma heurística.** A regra do projeto é que regra medida vira
código; **1 caso ⛔ não é medição, é anedota**. O caminho manual da
[PL45](#-pl45--os-9-autores-de-emenda-ambíguos) já o resolve em uma linha.

### 🔄 Análise de 2026-08-29 — a hipótese estava errada, e a causa é outra

⚠️ **A hipótese acima ⛔ não se confirmou.** ⛔ Não é "variação de grafia que a igualdade
exata ⛔ não alcança": dos 106 deputados sem emenda hoje, **0** têm o nome na lista de
autores esperando um casamento mais frouxo. Ou o nome está lá e é **ambíguo**, ou ⛔ **não
está lá de forma nenhuma**.

📐 **A conta refeita**, com o dado reingerido:

| | |
|---|---:|
| Deputados da 57ª sem nenhuma emenda | **106** (eram 92 em 27/08) |
| Autores pendentes de reconciliação | 169 |
| 🔴 Pendentes que casariam com **uma** pessoa só | **0** — o casamento automático está correto |

---

#### 🔴 Causa 1 — o homônimo histórico manufatura ambiguidade

A reconciliação compara contra as **7.993 pessoas** do banco, quase todas de legislaturas
antigas. Em **14** casos isso cria um empate que ⛔ não existe na realidade:

| Deputado da 57ª | Concorrente |
|---|---|
| **Bebeto** — Carlos Roberto Rodrigues, 1.117 votos | *BEBETO* — Adalberto Souza Galvão, **0 votos** |
| **Albuquerque** — José Francisco Lopes, 933 votos | *ALBUQUERQUE* — Manoel José de Albuquerque, **0 votos** |
| **José Guimarães** — José Nobre, 1.029 votos | *JOSÉ GUIMARÃES* — José Gomes de O. Guimarães, **0 votos** |

⭐ **Em todos os 14 o concorrente ⛔ não tem voto nenhum na base** — pessoa diferente, id
diferente na Câmara, de legislatura anterior.

🔴 **Checagem de segurança:** em **0 dos 14** o concorrente é senador em exercício. Era o
risco real — senador apresenta emenda, e roubar a dele seria erro silencioso.

📐 **Corroboração independente** — o destino da emenda contra a UF do parlamentar, o
mesmo teste que resolveu o Allan Garcês:

| | |
|---|---:|
| ✅ Destino principal bate com a UF | **50 de 56** |
| 🔴 Discorda | **2** (ambos *TEREZA CRISTINA*, senadora do MS com destino em MT) |
| — Sem UF no destino (`MÚLTIPLO`, `Nacional`) | 4 |

⚠️ **Átila Lira é ambiguidade REAL** e continua sem vínculo, corretamente: `ÁTILA DE MELO
LIRA` e `ÁTILA FREITAS LIRA` são duas pessoas, com ids distintos na Câmara.

---

#### 🔴 Causa 2 — o Portal renomeia o autor para o SUCESSOR

⭐ **A descoberta que explica a metade que faltava.** As emendas **estão no banco**; o que
está errado é o nome:

```
código 2429  ->  "TIAGO DIMAS (EX-PARLAMENTAR LAZARO BOTELHO,
                  NOS TERMOS ART. 78 LDO 2025 E DA MENSAGEM 95-CN, DE 06.11.25)"
```

Quando o parlamentar deixa o mandato, o **suplente executa** a emenda dele, e o Portal
passa a escrever o nome assim. Como `registrar_autores` faz `ON CONFLICT DO UPDATE SET
nome_autor`, **o último ano ingerido vence** — e o nome que chega ao reconciliador ⛔ não
casa com ninguém.

📐 **14 autores pendentes** trazem o padrão `(EX-PARLAMENTAR X…)`; em **12** o nome do
ex-parlamentar casa com exatamente um deputado da 57ª.

⭐ **Isto ⛔ não é heurística** — é ler um rótulo que a própria fonte escreve, citando o
art. 78 da LDO.

---

#### ✅ 📐 As duas regras entraram, e o resultado medido

| | Antes | Depois |
|---|---:|---:|
| Deputados da 57ª sem emenda | 106 | ⭐ **81** |
| Autores pendentes | 169 | ⭐ **101** |
| Autores resolvidos | 782 | **850** |
| 🔴 **Emendas com dono** | — | **23.247 de 24.825 (93,6%)** · R$ 70,8 bi |

⭐ **Corroboração na tela:** *Abilio Brunini* devolvia `ano: 0` e agora mostra 13 emendas
com destino a **Cuiabá — MT**, onde ele é prefeito desde 2024. É o caso do
`EX-PARLAMENTAR` no estado puro.

⚠️ **Sobram 8 autores ambíguos**, e ⛔ **devem** sobrar: `BILAC PINTO`, `LUIZ CARLOS`,
`PAULO RAMOS` e `RICARDO IZAR` são dois parlamentares de mesmo nome de urna, os dois com
voto. A saída é o `--resolver`.

#### ⛔ Os 81 que sobram ⛔ não são defeito nosso

Sondado direto na API do Portal, por nome:

| Deputado | No Portal |
|---|---|
| **Gisela Simona** (1.147 votos) | ⛔ **0 registros**, em ano nenhum |
| **Ronaldo Nogueira** (687 votos) | Tem de **2018**; ⛔ **0** em 2023, 2024 e 2025 |

⚠️ E a varredura ⛔ **não trunca**: em 2025 ela termina numa página parcial de 11
registros, que é o fim real do ano.

---

#### 🔴 Um defeito ATIVO, descoberto na análise

A resolução manual registrada acima — `emendas --resolver 4511=43` — **está errada
hoje**. O `43` é um `pessoa_id`, e ⛔ **ele ⛔ não sobrevive à reingestão**: `pessoas.id` é
`BIGSERIAL` e é reatribuído quando a base é recarregada.

| | |
|---|---|
| Quando foi registrado | `43` = Allan Garcês |
| 🔴 **Hoje** | `43` = **André Ferreira** · Allan Garcês é o **31** |

⛔ Reaplicar o comando documentado colocaria as emendas do Allan Garcês na ficha do
André Ferreira, **em silêncio** — a chave estrangeira aceita qualquer id que exista.

✅ **Corrigido em 2026-08-29.** O `--resolver` passou a receber o **id na Câmara**, que
vem da fonte e ⛔ nunca muda:

```bash
# ⛔ ANTES — pessoas.id, reatribuído a cada reingestão
python -m poligraph_etl emendas --resolver 4511=43

# ⭐ AGORA — o id da Câmara, o mesmo da URL do perfil oficial
python -m poligraph_etl emendas --resolver 4511=204521
```
Confirmar exige comparar os 159 pendentes com os 92 faltantes **um a um, à mão** — é
trabalho humano, como a PL11, e ⛔ não escala por regra.

---

### ✅ PL42 — o Senado, de ponta a ponta

**Ingerido em 2026-08-27.** O que está no ar:

| | Câmara | Senado |
|---|---:|---:|
| Votações | 1.594 | **421** — 239 secretas |
| Votos | 470.727 | **34.101** |
| Com posição utilizável | 462.867 (98,3%) | **11.848 (34,7%)** |
| Parlamentares | 643 | **104** |
| Arestas do grafo | 5.271 | **594** |
| Comunidades | 17 | **24** |

🔴 **São dois grafos, e continuarão sendo.** As duas casas ⛔ não votam as mesmas
matérias, então similaridade entre deputado e senador ⛔ não teria denominador
([achado #7](achados/007-casas-nao-sao-comparaveis.md)). Cada casa gera a própria
`execucao`, e `analisar --casa` recorta a matriz.

⚠️ **Aresta cruzando as casas ⛔ nunca é legítima** — nem para deputado que virou senador.
Aresta significa *"estes dois votam parecido"*; a mesma pessoa nas duas casas é **um nó
só**, não dois ligados. Depois da ponte do achado #18 ela apareceria nos **dois** grafos,
com os votos de cada casa separados.

### O que a ingestão revelou

| | |
|---|---|
| `Votou` é o valor **mais frequente** do Senado | Registra que houve voto **sem revelar qual** — é votação secreta. Tratá-lo como posição inventaria opinião para um terço da base |
| A lista `/senador/lista/atual` tem **81**, mas os votos alcançam **104** | Suplentes, licenciados e quem assumiu cargo no Executivo. Sem criá-los pelo próprio voto, 3.252 votos (10,5%) seriam descartados |
| ⭐ Sigla nova `LAP` apareceu em 2026 | *Licença paternidade* — o canário de domínio funcionou na primeira execução real |

### ✅ O produto, entregue no mesmo dia

| # | |
|---|---|
| 1 | Questionário **misto** — 21 da Câmara + 7 do Senado, sem seletor de casa |
| 2 | Resultado com **uma lista por casa**, e grafo próprio de cada uma |
| 3 | 7 perguntas do Senado curadas — a ementa ⛔ não bastou, foi preciso `IndexacaoMateria` |

### 🔴 Três defeitos que só apareceram ao juntar as casas

Todos do mesmo formato: **número plausível, tela intacta**.

| Defeito | Consequência |
|---|---|
| Piso de comparáveis sobre o **total** | Com 21+7 perguntas o piso era 17, e um senador tem no máximo 7 comparáveis. **Todo senador era filtrado**, e a lista do Senado nasceria vazia para sempre |
| Denominador do painel somando as casas | Pergunta da Câmara mostrava *"439 de 747"* — os 747 incluem 104 senadores que ⛔ nunca votaram aquela votação |
| Posição do cidadão na execução "mais recente" | Funcionava por acidente com uma casa só; com duas, dependia de qual ETL rodou por último |

⭐ E um quarto, do ETL: o Senado devolve `totalVotosSim` e `totalVotosNao` **NULL em todas
as votações**. Sem contar do array de votos, o painel — que é a assinatura visual do site —
renderizaria vazio para toda pergunta do Senado.

⚠️ `TestesAfinidadeDuasCasas` semeia as duas casas de propósito: o resto da suíte semeia
uma só, então o recorte poderia sumir num refactor e tudo continuaria verde.

### ⛔ O que ainda falta

| # | |
|---|---|
| 1 | A ficha e o "explorar" filtram a legislatura corrente, mas ⛔ não distinguem casa |
| 2 | A **ponte deputado→senador** (achado #18) segue aberta: 43 nomes aparecem nas duas casas, e o Senado ⛔ não publica CPF |
| 3 | 7 perguntas do Senado contra 21 da Câmara — o desequilíbrio favorece a Câmara no fluxo misto, e ampliar depende da PL11 |

---

### ✅ PL45 (resolvida em 2026-09-06) — sobrou zero ambíguo

**Medida em 2026-08-27**, na ingestão real das emendas de 2023–2026.

A reconciliação automática casa `codigo → pessoa` pelo nome normalizado, e **desiste
quando o nome casa com mais de uma pessoa**. ⛔ Chutar seria pior: o erro ficaria
congelado no código do autor e invisível — toda emenda daquele mandato iria para a ficha
errada, e nada na tela indicaria isso.

| Código | Nome no Portal | Candidatos em `pessoas` |
|---|---|---|
| `2815` | RICARDO IZAR | `883` Ricardo Izar · `1781` RICARDO IZAR |
| `2733` | MARCIO MACEDO | `825` Márcio Macêdo · `3377` MÁRCIO MACEDO |
| `2052` | ALVARO DIAS | `1839` ÁLVARO DIAS · `3502` ALVARO DIAS |
| `1338` | PAULO RAMOS | `862` Paulo Ramos · `4965` PAULO RAMOS |
| `2674` | LUIZ CARLOS | `7716` LUIZ CARLOS · `807` Luiz Carlos |
| `4015` | HELIO COSTA | `766` Hélio Costa · `2177` HÉLIO COSTA |
| `2215` | BILAC PINTO | `4230` BILAC PINTO · `683` Bilac Pinto |
| `4020` | JOAO ROMA | `4055` JOÃO ROMA · `782` João Roma |
| `2900` | CIRO NOGUEIRA | `2630` CIRO NOGUEIRA · `1632` CIRO NOGUEIRA |

⚠️ **⛔ Não são todos duplicata.** Alguns são **pai e filho** homônimos de gerações
diferentes — *Ciro Nogueira* e *Ricardo Izar* são os casos clássicos. É por isso que uma
regra automática do tipo *"prefira quem está na legislatura corrente"* ⛔ **não** serve: a
emenda para o exercício de 2023 foi apresentada em **2022**, quando o outro podia estar em
exercício.

**Como resolver, depois de decidir olhando o dado:**

```bash
python -m poligraph_etl emendas --resolver 2815=883 2900=1632
```

⭐ Fica gravado como `metodo = 'MANUAL'`, e execução automática posterior ⛔ **nunca**
sobrescreve. A procedência de cada vínculo é auditável — o que importa para o TCC.

---

### ✅ PL35 (resolvida) — a legislatura não era filtrada em consulta nenhuma

> ✅ **Resolvida em 2026-08-27.** O que está abaixo é o registro do problema; a
> solução está em [`Legislaturas.cs`](../src/Poligraph.Api/Data/Legislaturas.cs) e em
> [`TestesLegislatura.cs`](../src/Poligraph.Tests/Integracao/TestesLegislatura.cs).
>
> ⭐ **A decisão de desenho:** a legislatura é **derivada do dado**, ⛔ nunca configurada —
> dado repetido em `appsettings` seria mais uma coisa a esquecer de virar na posse da 58ª,
> e o erro reapareceria como número plausível. E são **duas** derivações, porque são duas
> perguntas: o denominador do painel sai das **perguntas ativas** (na virada, o pool ainda
> é da 57ª e o denominador tem de acompanhar as votações mostradas); a lista e a ficha
> usam a **corrente** = `MAX` em `votacoes`.

**Encontrada em 2026-08-26**, a partir da pergunta do autor *"será só dessa legislatura?"*.

[`plano/06 §3`](plano/06-perguntas-lote-1.md) decidiu **só a legislatura 57**, com quatro
motivos medidos — cobertura, comparabilidade (RN-02), relevância e estabilidade
(r = 0,862 dentro da legislatura; **entre** legislaturas, não se mediu).

⛔ **Mas a decisão nunca chegou ao código.** `Votacao.Legislatura` existe e é indexada,
e só `EndpointsGrafo` a usa. Nenhuma consulta de afinidade, ficha ou painel filtra por
ela. Hoje passa porque o banco tem uma legislatura só.

| Consulta | O que acontece quando entrar uma segunda legislatura |
|---|---|
| 🔴 `PerguntaPublica.TotalPossivel` | `db.Votos.Select(PessoaId).Distinct().Count()` conta deputados das duas. O painel mostraria **"480 de 900"** — sem erro, só um número plausível e errado |
| `ParlamentarNaLista.NVotacoes` | Soma as votações de todas as legislaturas |
| `CarregarVotosAsync` | Escapa por acaso: só alcança votações ligadas a perguntas ativas |

⚠️ **É o mesmo formato do bug de polaridade:** não quebra a tela, produz número
plausível. E a regra 4 do projeto diz que regra medida vira *constraint*, não comentário.

⏳ **E tem prazo.** A 57ª termina em **janeiro de 2027**; a 58ª toma posse em fevereiro.
"Só a 57ª" é escolha com data de validade, e o sistema não tem hoje nenhum conceito de
qual legislatura está ativa.

**Encaminhamento sugerido:** derivar a legislatura da `Votacao` ligada à `Pergunta`, em
vez de configurar à parte — dado derivado é mais difícil de errar do que dado repetido.
🔴 O teste tem de semear **duas** legislaturas e provar que a segunda não vaza; sem isso,
o filtro pode sumir num refactor e ninguém percebe.

⚠️ **Vale para o questionário, não para o grafo.** O grafo de similaridade *pode* usar
histórico — são perguntas diferentes, e 2001–2026 continua disponível.

---

### ✅ PL36 (resolvida) e 🔄 PL37 (parcial) — o ETL Python e o banco nunca se falaram

**Encontradas em 2026-08-26**, a partir da pergunta do autor *"o script em python já
funciona?"*.

**Não funciona.** O EF Core, com `UseSnakeCaseNamingConvention()`, nomeia a tabela a
partir do `DbSet` — que é plural. O Python foi escrito no singular:

| Python usa | Existe no banco |
|---|---|
| `votacao` | `votacoes` |
| `voto` | `votos` |
| `pessoa` | `pessoas` |
| `pessoa_fonte_id` | `pessoa_fonte_ids` |
| `similaridade` | `similaridades` |
| `execucao` | `execucoes` |

⛔ **Todas as seis.** Qualquer `python -m poligraph_etl` morre no primeiro `SELECT` com
`relation "votacao" does not exist` — verificado contra o banco em execução.

#### 🔴 Por que ninguém percebeu: os testes provavam a coisa errada (PL37)

`tests/test_persistencia.py` faz `CREATE TABLE pessoa (...)`, `CREATE TABLE votacao
(...)` — **com os nomes errados**. Os 104 testes passam porque testam o Python contra um
banco que o Python mesmo inventou.

> ⚠️ **A lição é maior que o bug.** O `CLAUDE.md` diz que **o EF é dono do schema** e o
> Python só lê. Um teste que cria o próprio schema abandona esse contrato e passa a
> medir consistência interna em vez de integração. Verde constante e zero informação.

**Encaminhamento:** renomear é o menor dos trabalhos e ⛔ **não basta** — sem mudar o
teste, a mesma deriva volta na próxima coluna que mudar de nome. O teste precisa subir o
schema **pelas migrations do EF** (Testcontainers, como no lado C#) e só então rodar o
Python contra ele. 🔴 Só assim a renomeação fica provada e protegida.

#### ⚠️ O segundo defeito, que só apareceu ao rodar

Com os nomes já corrigidos, o container ainda morria **antes de abrir conexão**:

```
psycopg.ProgrammingError: invalid connection option "Host"
```

O Aspire injeta `ConnectionStrings__poligraph` no formato do **Npgsql**
(`Host=...;Database=...;Username=...`) e o `psycopg` fala **libpq**
(`host=... dbname=... user=...`). Resolvido em `poligraph_etl/conexao.py`.

> 🔑 **Nenhum teste pegaria isso**, e vale entender por quê: os testes recebiam a
> conexão pronta do Testcontainers, que já vem em libpq. O formato do Aspire nunca
> passava por ali. ⚠️ **Foi preciso executar de verdade** — é o mesmo padrão do bug do
> `DOTNET_ENVIRONMENT`, que também só apareceu rodando.

---

### ✅ PL11 e RQ3 (resolvidas em 2026-08-29) — o poço e o tamanho do questionário

⚠️ **O poço e o questionário ⛔ não são a mesma coisa**, e confundi-los foi o que quase
fez o trabalho render ao contrário. Com 50 perguntas curadas e o endpoint devolvendo
todas, o mínimo obrigatório — `ceil(ativas × 0,60)` — subiu **sozinho de 17 para 30**.
⛔ Curar mais perguntas tinha acabado de deixar o questionário **pior**.

#### Como as 22 novas foram escolhidas

⛔ **⛔ Não pela divisão do placar.** O [`plano/06 §2`](plano/06-perguntas-lote-1.md) já
avisava, e a medição confirmou: das **703 duplas** entre as 38 candidatas com divisão
≥ 25%, **106 têm os deputados votando igual em mais de 90%** das duas. Quase toda
votação dividida divide a Câmara **no mesmo eixo**.

📐 O critério foi cobertura de **pares de deputados que o conjunto separa**, contando só
discordância real — ⛔ ausência ⛔ não separa ninguém:

| Conjunto | Pares separados |
|---|---|
| As 21 do lote 1 | 139.667 de 194.376 (**71,9%**) |
| ⭐ + as 20 do lote 2 | **84,9%** |
| + as 18 restantes | 86,1% — por isso paramos em 20 |

#### O tamanho: 24, ⛔ não 50

📐 Medido com cada deputado no papel de cidadão, 15 perguntas da Câmara:

| Estratégia | Empate mediano no topo | Sozinho no topo |
|---|---:|---:|
| As 15 melhores, **fixas** | 14 | 4,5% |
| ⭐ 8 fixas + **7 dirigidas** | **6** | 13,4% |
| 8 fixas + 7 **sorteadas** | 16 | 10,4% |

🔴 **Sortear é o mesmo que ⛔ não adaptar.** E **15 adaptativas valem 25 fixas** — a
curva fixa só chega a empate 5 com 25 perguntas.

⚠️ Escolher **uma por vez** daria empate 5 em vez de 6, ao custo de **sete idas e voltas**
ao servidor no meio do questionário. ⛔ Não vale.

#### 🔄 "O Senado está esgotado" — afirmado e DERRUBADO no mesmo dia

⚠️ **A conclusão registrada aqui estava errada, e o motivo é instrutivo.** Ela dizia:
*"das 52 substantivas abertas da 57ª, 39 dividem menos de 5% e 7 das 8 acima de 25% já
estavam curadas — ⛔ não há mais nada a curar"*.

🔴 **As 52 eram 104.** As votações de PEC estavam classificadas como `DESTAQUE`, porque
o padrão continha `emenda` solto e *"Proposta de **Emenda** à Constituição"* casa com
ele ([achado #31](achados/031-a-pec-estava-escondida-como-destaque.md)).

| | Afirmado | Medido depois |
|---|---:|---:|
| Substantivas abertas do Senado | 52 | ⭐ **104** |
| Candidatas novas com divisão ≥ 25% | 2 | ⭐ **10** |

⭐ E as novas são de peso: **reforma tributária (PEC 45)**, número de deputados federais,
crédito fiscal de subvenção.

⚠️ **A lição ⛔ não é sobre o Senado.** É que "esgotado" foi afirmado a partir de um
recorte cuja construção ⛔ não tinha sido conferida — a regra do projeto, aplicada a si
mesma: *antes de afirmar um número, meça, e diga de onde ele veio*.

---

### ✅ PL40 (resolvida em 2026-08-28) — a ementa chegou, e destrava a PL11

`proposicoes` tinha **zero linhas**, e `proposicao_id` era nulo em **1.594 de 1.594**
votações da Câmara (100%). Quem cura lia só a descrição da votação:

> *"Aprovado o Substitutivo ao Projeto de Lei Complementar nº 80, de 2026, adotado pelo
> relator da Comissão de…"*

Isso diz o **número** do projeto e ⛔ **não diz sobre o que ele é**.

⭐ **A fonte certa ⛔ não era o arquivo óbvio.** `proposicoes-{ano}.csv` tem 90 MB por ano;
`votacoesProposicoes-{ano}.csv` tem **5 MB** e já traz `proposicao_ementa` embutida —
5 MB entregam o que interessa, contra 360 MB nos quatro anos para extrair as mesmas
~1.600 linhas.

| | Antes | Depois |
|---|---:|---:|
| Proposições na base | 0 | **683** |
| Votações com proposição | 0 de 1.594 (0,0%) | **1.587 de 1.594 (99,6%)** |
| 🔴 **Substantivas com ementa** | 0 de 266 (0,0%) | **263 de 266 (98,9%)** |

⚠️ O arquivo grande tem duas colunas que este ⛔ não tem: `keywords` (indexação temática)
e `ementaDetalhada`. Se a curadoria precisar delas, aí vale pagar os 90 MB — ⛔ não antes.

**O comando `curar` passa a exibir a ementa acima da descrição**, e diz explicitamente
quando a votação ⛔ não tem proposição vinculada, para quem cura saber que vai procurar
à mão.

---

### ✅ PL43 (resolvida em 2026-08-28) — um layout, não dois

A pergunta era manter os dois layouts do desenho ou só o de molas. **Resolvida por um
terceiro que não existia quando ela foi escrita.**

Com `governismo` medido (achado #26), o eixo do SVD ganhou nome: ele correlaciona
−0,87 com o alinhamento ao Governo. Mas então dá para desenhar o alinhamento
**diretamente**, e foi o que se fez — o layout `Alinhamento` usa o governismo como
coordenada.

| | Componentes (SVD) | Alinhamento |
|---|---|---|
| Eixo horizontal | correlaciona −0,87 com governismo | **é** o governismo |
| Sinal do eixo | arbitrário, pode espelhar entre execuções | definido por nós |
| Precisa de ressalva sobre correlação | sim | ⛔ não |
| Eixo vertical | 2ª componente, 9,6% — sem leitura em português | ⛔ não mede nada, e diz isso |

⭐ **Os dois mostram a mesma divisão**, e o do SVD pede um parágrafo para dizer o que o
outro diz sozinho.

**Decisão:** `Componentes` sai da TELA e ⛔ não do dado. `componente1` e `componente2`
continuam calculados e gravados — são resultado do método e sustentam o achado #26.

Ficam dois layouts com funções distintas:

| | |
|---|---|
| **Molas** | Quem vota com quem — a estrutura, os grupos |
| **Alinhamento** | Quanto vota com o Governo — a medida |

⛔ No Senado sobra só o de molas: sem orientação de bancada publicada, o layout de
alinhamento ⛔ não teria coordenada.

---

### 🟡 PL38 — o grafo é calculado e jogado fora

`__main__._analisar` faz:

```python
arestas = similaridade.arestas_knn(pares)
log.info("  grafo kNN: %d arestas", len(arestas))
```

⛔ E acaba aí. `similaridade.py` diz no cabeçalho que produz `aresta_grafo` e
`no_metrica`, mas `persistencia.py` não tem função que escreva em nenhuma das duas —
só `gravar_similaridades`.

Consequência: `EndpointsGrafo` lê `arestas_grafo` e `nos_metrica`, encontra vazio e
devolve `Grafo(0, casa, 0, [], [])`. O caminho está certo — ⭐ grafo vazio, não erro —
mas seria vazio **para sempre**, mesmo com o ETL rodando sem falha e sem aviso no log.

⚠️ Falta também **comunidade** e **posição (x, y)**: `NoDoGrafo` tem `Comunidade`,
`EixoX` e `EixoY`, e nada os calcula. O `networkx` está na stack para isso e ainda não
foi usado.

⚠️ **E não há tela.** A RF-33 (visualizar o grafo, *force-directed*, filtro por limiar,
cor por comunidade) é 🔴 Essencial e o front não tem página nenhuma que consuma
`/api/grafo`.

---

> 🔑 **Por que esta é a frente mais crítica, e não uma lista de tarefas de conteúdo:**

| | |
|---|---|
| **Não escala** | É leitura humana de ementa por ementa. Nenhuma ferramenta substitui |
| **Não acelera no fim** | Uma hora por dia resolve; três dias seguidos na véspera, não |
| **Bloqueia o passo 8** | Sem perguntas curadas, o questionário não existe — e ele é a *"Mensuração de Afinidade"* do título |
| 🔴 **É o mais atacável na banca** | O passo mais subjetivo do método. Cada escolha precisa estar justificada **por escrito** |
| **Alimenta o capítulo de metodologia** | Adiar custa duas vezes: o trabalho e o texto |

⚠️ **A polaridade é a parte que não pode errar.** Em 14% das votações "Sim" significa
rejeitar — e um sinal invertido **não aparece na tela**, aparece como um número plausível
e errado. Ver [00-discovery §7](00-discovery.md) e o teste API3.

📐 **Detalhamento em [plano/03-questionario.md](plano/03-questionario.md).**

---

## 🟡 Instalação — decida com o terminal aberto, não agora

| # | Pendência |
|---|---|
| **PL19** | Retenção do Prometheus (ex.: 90 dias) — sem limite ele enche o disco |
| **PL20** | 🔴 Destino do backup do Postgres — **configurar no primeiro dia**. ⚠️ Com e-mails em claro na base, o backup precisa ser **criptografado** no destino |
| **PL21** | Grafana público ou só por VPN/túnel |
| **PL22** | Exposição do painel do Coolify — público com 2FA, allow-list, ou VPN |

---

## 🟡 Só se resolvem contra código

| # | Pendência |
|---|---|
| **API3** | Teste de regressão da **polaridade** — o bug mais perigoso do sistema |
| **API7** | Medir quanto tempo o job de 207k pares leva de fato |
| ✅ ~~CT3~~ | **Resolvida (2026-09-06)** — 27 testes conferem rota por rota e campo por campo contra `src/web/src/api.ts`, e o `/scalar` renderiza o mesmo documento. 🔴 **Achou um bug na primeira execução:** `/api/auth/logout` ⛔ não existia no contrato e devolvia 200 em vez de 204 ([achado 032](achados/032-a-rota-que-o-contrato-dizia-nao-existir.md)). Detalhe abaixo |
| 🟡 **PL52** | **🆕 Teste intermitente** — `TestesAfinidadeDuasCasas.Nenhuma_Lista_Mistura_Parlamentar_Da_Outra_Casa` falhou **1 vez em 3** rodadas da suíte completa (2026-09-06), em **1 ms**, e passa isolado. ⚠️ Duração de 1 ms sugere estado compartilhado entre testes, ⛔ não asserção de dado. **A mensagem ⛔ não foi capturada** — as duas rodadas seguintes passaram |
| ✅ ~~CT4~~ | **Nova, resolvida (2026-09-06)** — estágio de qualidade (SonarQube Cloud) no `ci.yml`, com cobertura das três linguagens. 🔴 **Depende de repositório público** ou de plano pago. Detalhe abaixo |
| **PL16** | Como o ETL sinaliza `novas_votacoes` |
| **PL31** | Definir o conteúdo do seed de desenvolvimento — quantos parlamentares, votações e perguntas |
| ✅ ~~PL48~~ | **Resolvida (2026-08-29)** — consolidadas. Eram **12** arquivos, ⛔ não 8: o número cresceu durante o desenvolvimento. Viraram **uma** `Inicial`, com o schema conferido definição por definição. Detalhe abaixo |
| ✅ ~~PL49~~ | **Resolvida (2026-09-06)** — as migrations e a `FabricaDesignTime` foram para `Poligraph.Migrations`. O `dotnet ef` agora toma como alvo o projeto que **aplica**, ⛔ não a API, que ⛔ nunca migra. Detalhe abaixo |
| ~~PL32~~ | 🟢 Rebaixada — só texto principal foi a decisão; o texto das emendas deixou de ser necessário |
| **C15** | Contrato do front — depende do React estar de pé |

---

## 🟡 Decisões de método — afetam o texto do TCC

| # | Pendência |
|---|---|
| ~~RQ2~~ | ✅ **Resolvida (2026-08-26)** — **as duas**: ARI 0,277 · modularidade 0,558 (comunidade) × 0,288 (partido). Ver [plano/07 §3.5.1](plano/07-grafo-e-afinidade.md) |
| **C7** | Métricas formais de comparação entre casas |
| **RQ7** | Mecanismo de recomendação e como avaliá-lo |
| **RQ6** | Critérios de aceitação dos RF essenciais |
| **ER2** | Biblioteca de *fuzzy match* e calibração do limiar |

---

## 🟢 Incrementos e refinamentos

<details>
<summary><b>Crawler</b> — N1, N3, N4, N5, N6, N7, N8, N9, N11</summary>

Feed da Agência Câmara (N1), casamento nome→parlamentar (N3), `robots.txt` (N4), limiar de
dedup (N5), cobertura da Agência Senado (N6), retenção (N7), redundância (N8), estado
vazio (N9), lista final de feeds (N11).
</details>

<details>
<summary><b>Página do parlamentar</b> — PP2 a PP6</summary>

Assimetria da página de senador (PP2), apresentação de patrimônio (PP3), links de rede
social (PP4), parlamentar com poucos votos (PP5), perfil temático por relatoria (PP6).
</details>

<details>
<summary><b>Fontes e escopo</b> — B6, B7, C5, TS5, ER5, PL5, PL14, PL15, PL17, A5</summary>

Base dos Dados como atalho (B6, TS5), política de `cpf_hash` (B7, ER5), *fuzzy match*
(C5), biblioteca do grafo (PL5), retenção de `execucao` (PL14), `casa` em `pessoa` (PL15),
*cold start* do Postgres (PL17 — **já não se aplica**, o banco é container próprio),
reescrever objetivos se escolher o Cenário A (A5 — **já não se aplica**, a D3 escolheu o C).
</details>

---

## ⏳ Fatos com prazo de validade — lista separada

Não são pendências de trabalho: são coisas que **podem mudar sozinhas** entre agora e a
entrega. Vivem em [REVISAR-ANTES-DA-CONCLUSAO.md](REVISAR-ANTES-DA-CONCLUSAO.md).

Os dois que podem **mudar a conclusão**: se a **CPMI** passar a publicar votação nominal,
a unificação dos dois grafos vira possível; se o **Senado** publicar orientação de bancada,
a comparação entre casas deixa de ser assimétrica.

⚠️ E o mais provável de todos: **quase todos os números foram medidos com 2026 parcial.**

⏳ **Novo:** a retenção do Clarity (playback **30 dias**) expira antes da escrita se a
avaliação rodar cedo demais.

---

## ✅ Resolvidas — 62

`A1` `API1` `API2` `API6` `B1` `B2` `B3` `B4` `B5` `C1` `C2` `C3` `C4` `C6` `C8` `C13`
`C14` `CT1` `CT2` `CT4` `CT5` `CT6` `D1` `D3` `D5` `ER1` `ER3` `ER4` `N2` `N10` `P1` `P2`
`P3` `P4` `P6` `PL1` `PL2` `PL4` `PL6` `PL8` `PL9` `PL13` `PL28` `PP1` `RE-01` `RQ1` `RQ4` `RQ8` `RQ9`
`SE1` `SE2` `SE3` `SE4` `SE5` `SE6` `TS1` `TS2` `TS3` `TS4` `TS6`

⚠️ **Convenção de prefixo** (evita a colisão que existia até 2026-08-23):

| Prefixo | Documento |
|---|---|
| `A` `B` `C` | Cenários A, B e C (`arq/01`, `arq/02`, `arq/03`) |
| `API` | `arq/10-api-e-afinidade` |
| `N` | `arq/20-crawler-noticias` |
| `PP` | `arq/30-pagina-do-parlamentar` |
| `PL` | `plano/*` |
| `RQ` | `03-requisitos` |
| `CT` | `04-contratos` |
| `SE` | `11-api-senado` |
| `TS` | `12-fonte-tse` |
| `ER` | `13-correlacao-entre-fontes` |
| `D` | Decisões — `00-discovery` §11 |
