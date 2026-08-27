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
| 🔄 **PL11** | 🔄 **Avançou** — **21 perguntas curadas estão no ar**, polaridade conferida uma a uma. ⛔ Falta AMPLIAR o pool para **40–60**: o desempate dirigido escolhe a próxima pergunta do pool, e com 21 ele acaba antes de desempatar | 🔴 **Alta** | 🔴 **Dias** |
| 🟡 **RQ3** | 🔄 **Agora com medição** — a curva de discriminação mostra 12 perguntas + desempate dirigido sob demanda, em vez de um N fixo. Falta o autor confirmar o desenho | 🟡 Média | 🟢 Decisão |
| ~~PL12~~ | ✅ **Teste do jantar** — entra se dá para discutir num jantar sem explicar a proposta | — | — |
| **CT7** | 🔴 Piso de respostas para o `422` — sugerido **60% do N** (plano/07 §4.4) | 🔴 Alta | 🟢 Decisão |
| **PL10** | Questionário adaptativo entra como experimento comparativo? | 🟡 Média | — |
| **PL18** | Usar LLM para rascunhar a reescrita das ementas? | 🟡 Média | — |
| **A2** | Regex de `categoria`, validadas contra amostra rotulada à mão | 🟡 Média | 🟡 Horas |
| **A3** | Deduplicação de PEC em dois turnos | 🟡 Média | — |
| **A4** | Quantas das 100 proposições sobrevivem ao corte de unanimidade | 🟡 Média | — |
| **PL34** | 🔵 **Adiada por decisão do autor:** gravar as respostas individuais do questionário, SEM vínculo com a conta, para analisar quais perguntas dividem e quais ninguém entende (§ abaixo) | 🔵 Futuro | — |
| ~~API4~~ | ✅ **Resolvida** — cosseno no grafo, concordância simples na tela (plano/07 §4.5) | — | — |
| 🟡 **PL44** | 🔄 **Avançou** — a ingestão deduz a legislatura pela data e as **consultas já filtram** (PL35 ✅). ⛔ Falta a parte de **produto**: o que a tela mostra na virada, e o que acontece com quem respondeu o questionário na 57ª. ⏳ **A 57ª termina em janeiro de 2027** | 🟡 Média | 🟢 Decisão |
| 🟡 **PL45** | **🆕 9 autores de emenda ambíguos aguardam decisão humana** — a porta de entrada já existe (`emendas --resolver`), mas quem decide é uma pessoa. Lista completa abaixo | 🟡 Média | 🟢 Minutos |
| 🟡 **PL47** | **🆕 92 deputados sem nenhuma emenda vinculada** — emenda individual é **impositiva desde 2015**, então mandato inteiro sem nenhuma é suspeito. Detalhe abaixo | 🟡 Média | 🟡 Horas |
| 🔵 **PL46** | **🆕 83 autores de emenda são senadores** — resolvem-se sozinhos quando a [PL42](#) trouxer o Senado, porque o código do autor é de **mandato** e vale para as duas casas ([achado #24](achados/024-codigo-da-emenda-identifica-o-mandato.md)) | 🔵 Futuro | — |
| ~~PL35~~ | ✅ **Resolvida (2026-08-27)** — `Legislaturas` DERIVA a legislatura do dado, nunca de configuração. `TestesLegislatura` semeia **duas** legislaturas e prova que a segunda ⛔ não vaza; as três mutações matam os três filtros. § abaixo mantido como registro | — | — |
| ~~PL36~~ | ✅ **Resolvida (2026-08-26)** — nomes corrigidos e **verificado rodando o container contra o banco real**: monta a matriz e grava `execucoes`. Estava faltando também traduzir a connection string do Aspire (§ abaixo) | — | — |
| ~~PL37~~ | ✅ **Resolvida (2026-08-27)** — `test_contrato_schema.py` cobre agora **nomes de tabela, nomes de coluna e os literais combinados** entre os dois lados (`FUNDO ESPECIAL`, `ck_autor_metodo`). ⭐ O próprio parser tem teste que morre sob mutação — sem ele, uma exceção mal posta o deixaria cego e verde | — | — |
| ~~PL39~~ | ✅ **Resolvida (2026-08-26)** — legislatura 57 inteira ingerida: 470.786 votos, 5.268 arestas | — | — |
| 🟡 **PL43** | **`eixo_x`/`eixo_y` divergem do plano** — o rascunho previa 1ª componente do SVD (eixo interpretável, linhagem W-NOMINATE); o implementado é layout de molas, que ⛔ não tem eixo com significado. Guardar as duas coisas ou ficar só com molas? Ver [plano/07 §3.6](plano/07-grafo-e-afinidade.md) | 🟡 Média | 🟢 Decisão |
| 🔴 **PL42** | **O Senado não é ingerido** — nenhuma linha de código o alcança. ⚠️ A RF-07 é 🟢 Desejável, mas a **RNF-28 proíbe o seletor de casa** e o desenho da §3.4.1 exige perguntas das duas casas embaralhadas e duas listas no resultado. Sem Senado, esse desenho não existe | 🔴 **Alta** | 🔴 Dias |
| ~~PL41~~ | ✅ **Resolvida (2026-08-26)** — o seed foi **aposentado** por decisão do autor: com o ETL funcional, só o schema precisa ser inicializado. O semeador virou `Poligraph.Tests/Fixtures/DadosDeTeste.cs` | — | — |
| 🟡 **PL40** | **`proposicoes` nunca é ingerida** — o CSV de votações traz só o `id` da proposição, sem sigla/número/ano/ementa. Hoje o `proposicao_id` é anulado. 🔴 Bloqueia a **RF-30** (exibir a ementa original ao lado da pergunta) | 🟡 Média | 🟡 Horas |
| ~~PL38~~ | ✅ **Resolvida (2026-08-26)** — `arestas_grafo` e `nos_metrica` gravadas; Louvain + layout de molas com semente fixa; 30 comunidades em 655 nós. ⚠️ `governismo` e `disciplina` seguem nulos: dependem de `votacoesOrientacoes`, ainda não ingerido | — | — |

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

**Encaminhamento:** a hipótese mais provável para o grosso dos 92 é que o `nomeAutor` do
Portal usa o **nome parlamentar** com variação que a igualdade exata ⛔ não alcança.
Confirmar exige comparar os 159 pendentes com os 92 faltantes **um a um, à mão** — é
trabalho humano, como a PL11, e ⛔ não escala por regra.

---

### 🟡 PL45 — os 9 autores de emenda ambíguos

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
| **CT3** | Escrever o OpenAPI da C13 e validar contra o front |
| **PL16** | Como o ETL sinaliza `novas_votacoes` |
| **PL31** | Definir o conteúdo do seed de desenvolvimento — quantos parlamentares, votações e perguntas |
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
