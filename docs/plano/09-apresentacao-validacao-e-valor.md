# 09 — Apresentação, validação e valor

> **Escrito em 2026-10-02**, a pedido do autor: *"procure modelos, heurísticas para
> facilitar a apresentação dos gráficos e dados, que podem ser complexos; preciso de
> alguma forma de validar esses dados também"* e *"avalie os filtros e o valor que as
> pessoas podem extrair da ferramenta"*.
>
> ⚠️ É **plano**, ⛔ achado: as medições citadas foram feitas no banco local
> (Aspire, dado real, 2026-10-02), e o que é proposta está marcado como proposta.

---

## 1. Os modelos — o que cada um resolve

Nenhum é para copiar. Cada um responde a uma pergunta diferente, e juntos cobrem do dado
à tela.

| Modelo | A pergunta que responde | Onde entra aqui |
|---|---|---|
| **Modelo aninhado de Munzner** (2009) | *O erro está em qual camada?* Problema do domínio → abstração de dados e tarefas → codificação visual e interação → algoritmo. Cada camada tem a **sua** ameaça à validade, e o erro de cima contamina as de baixo | A espinha deste documento: a validação (§5) segue as quatro camadas |
| **Mantra de Shneiderman** (1996) — *visão geral primeiro, zoom e filtro, detalhe sob demanda* — e as 7 tarefas: *overview, zoom, filter, details-on-demand, relate, history, extract* | *A tela deixa fazer o caminho todo?* | A avaliação de filtros (§3): as tarefas *relate* e *history* são as que mais faltam |
| **Percepção gráfica de Cleveland e McGill** (1984) | *Que codificação a pessoa lê com precisão?* Posição numa escala comum é lida melhor que comprimento, que é melhor que ângulo, área e cor | Números do dinheiro e da afinidade: barra e ponto, ⛔ pizza nem bolha |
| **Ghoniem, Fekete e Castagliola** (2004/2005) | *Nó-ligação ou matriz?* Para grafos grandes ou densos, a matriz é lida melhor na maioria das tarefas; a exceção é achar caminho, onde o nó-ligação ganha | O grafo de 643 nós e 5 mil arestas (§2) |
| **Guia de visualização do Analysis Function** (governo britânico, 2022) | *Como um órgão público publica gráfico?* Título que diz a mensagem, rótulo direto em vez de legenda, eixo de barra começando em zero, no máximo 4 séries, tabela ou texto como alternativa, dado para baixar | Checklist de cada gráfico (§2) |
| **Incerteza — Hullman e colegas** | *Como mostrar que o número é frágil?* Amostra pequena precisa aparecer na tela; mostrar só o ponto convida a ler precisão que não existe | A afinidade com 24 respostas, e a 55ª do Senado com 103 votações |
| **Dimensões de qualidade de dado da DAMA** | *O dado está certo?* Completude, unicidade, pontualidade, validade, exatidão e consistência | As regras de conferência (§5.2) |
| **Filtros e facetas — NN/g e afins** | *A pessoa sabe o que está filtrando?* Filtros aplicados visíveis e removíveis um a um; contagem por opção; o geral antes do específico | A lista de parlamentares (§3) |

---

## 2. O que eles dizem das nossas telas

| Heurística | Onde já cumpre | Onde falha | Proposta |
|---|---|---|---|
| Visão geral primeiro | O início abre com o tamanho da base e o grafo | — | — |
| Detalhe sob demanda | Ficha, "concordaram em X de Y" com as perguntas | — | — |
| **Relacionar** (*relate*) | "Quem vota parecido" na ficha | ⛔ Dá para comparar **dois** parlamentares lado a lado | Comparação de dois: votos em comum, onde divergiram |
| **Histórico** (*history*) | Mandatos na ficha; seletor de período | ⛔ "O que mudou desde a última vez" — era o papel das notícias | As notificações do §4 |
| **Extrair** (*extract*) | CSV na ficha, nas emendas, nas entidades e no governo | Lista de parlamentares e resultado ⛔ exportam | CSV na lista |
| Título diz a mensagem | Painéis do dinheiro ("Para onde foi o dinheiro…") | O grafo se chama "Como a Câmara se agrupa" e ⛔ diz o achado ("31 grupos; o maior é…") | Subtítulo gerado do dado |
| Alternativa ao gráfico | O grafo tem "ver como lista" (`ListaDoGrafo`) | O mapa de emendas tem tabela; ✅ | — |
| Rótulo direto, ⛔ legenda | Barras do dinheiro | A cor das comunidades do grafo depende de legenda | Nomear o grupo pelo partido dominante no próprio desenho |
| Incerteza à vista | "Sua posição vale sobre N perguntas"; régua do mediano | A afinidade de alguém com **poucas** votações em comum aparece igual à de quem tem muitas | Marcar base pequena (ex.: < 10 comparáveis) e ordenar por ela |
| Nó-ligação × matriz | Nó-ligação, com busca, foco e isolamento — a tarefa principal é *achar quem*, que é de caminho e vizinhança | Para *quantos grupos e de quem*, a matriz ordenada por comunidade leria melhor (Ghoniem) | Uma vista de matriz partido × comunidade (contagem), ⛔ substituir o grafo |
| Precisão da codificação | Valores em barras e números | — | Manter: ⛔ pizza, ⛔ área |

---

## 3. Os filtros, tela a tela

📐 Inventário do código em 2026-10-02.

| Tela | Filtros hoje | O que falta |
|---|---|---|
| **Lista de parlamentares** | Nome, casa, partido, estado, período (na faixa do topo) | **Filtros aplicados visíveis e um "limpar"**. A ordenação por "mais votações" existe na API e ⛔ na tela. Contagem por opção |
| **Grafo** | Casa, período, busca de nome, limiar das ligações, layout, fotos, eixos, isolar um nó | **Destacar meu estado / um partido** sem esconder o resto — é a tarefa *relate* sobre o desenho |
| **Ficha → votos** | ✅ **Busca** (2026-10-02): na ementa, na descrição e na matéria ("PEC 45/2019"), sem diferença de caixa nem de acento; a contagem diz quantos achou e o CSV baixa os encontrados | Filtrar por posição (sim, não, ausente) |
| **Resultado do questionário** | Nenhum | 🔴 **Só os do meu estado.** "Quem me representa vota como eu?" é a pergunta de quem chega, e hoje a resposta mistura os 643 |
| Emendas por cidade | Período, estado, cidade | — bom |
| Entidades | Busca, grupo | — bom |
| Governo | Período | — |

⭐ As duas lacunas 🔴 eram as de maior valor: o filtro por estado no resultado e a busca
nos votos da ficha. ✅ A busca entrou em 2026-10-02; o filtro por estado continua aberto
(U15).

---

## 4. O valor — o que a pessoa leva

Pela pergunta com que ela chega:

| Pergunta | Hoje | Lacuna |
|---|---|---|
| Quem vota como eu? | ✅ Questionário e resultado, por casa, com "X de Y" | Do **meu estado** (§3) |
| Como fulano votou em X? | ✅ Busca nos votos da ficha (2026-10-02) | Filtro por posição |
| Fulano segue o partido? O governo? | ✅ Disciplina e governismo (Câmara) | Senado ⛔ publica orientação |
| Ele aparece para votar? | ✅ Presença em plenário | — |
| Como gasta o dinheiro? | ✅ Cota, emendas, campanha | **Comparar com a casa** (mediana dos pares) |
| Quem anda com quem? | ✅ Grafo, grupos | Leitura difícil para leigo; nomear os grupos |
| O que mudou? | ⛔ — as notícias saíram em 2026-10-02 | "O que mudou" — decidido, §4.1 |
| Fulano × beltrano | ⛔ | Comparação de dois |

### 4.1 "O que mudou" — os avisos que substituem as notícias

> ✅ **Decidido pelo autor em 2026-10-02** (Pendência 63): os **cinco avisos** abaixo, numa seção
> **"O que mudou" dentro do site**, ⛔ por e-mail. Pré-requisito: a carga agendada
> (Pendência 64). Esta seção é a especificação: a implementação sai dela.
>
> FEITO em 2026-10-02: `ServicoNovidades` na API e `OQueMudou` no front. Duas escolhas que a
> especificação deixava abertas: o mês da cota e a competência da emenda são os últimos
> fechados **entre os dados de quem a pessoa segue** (a cota chega em datas diferentes por
> casa); e o A1 só mostra ausência no Senado, porque na Câmara quem faltou não tem linha.

As notícias saíram por falta de tempo para fazê-las bem. Os avisos saem do **dado que já
ingerimos**: sem coletor novo, sem associar nome a texto, sem limiar de confiança. Todo
aviso é um **fato registrado pela casa**, com a fonte ao lado, como o resto do site.

#### Os cinco avisos

| # | Aviso | Regra | Tabelas e campo de data | Janela | Casas |
|---|---|---|---|---|---|
| A1 | **Votou nesta semana** — "votou em 12 votações de plenário; ausente em 3" | Votos da pessoa em votações de plenário com `data` na janela. "Ausente" é a presença `AUSENTE` ou `AUSENTE_JUSTIFICADO`; no Senado, a justificativa vai junto | `votos`, `votacoes.data` | Semana corrida | Câmara e Senado |
| A2 | **Votou contra o próprio partido** — "votou Não; o PT orientou Sim", com o nome da votação | Voto Sim ou Não oposto à orientação Sim ou Não da bancada do partido **no voto** — a mesma regra da disciplina (federação conta como o partido, bloco ⛔; achado #36). Liberado e obstrução ⛔ contam | `votos`, `orientacoes` | Semana | **Só Câmara**: o Senado ⛔ publica orientação |
| A3 | **Trocou de partido** — "votou pelo PL; antes, pelo PP" | `partido_no_voto` do voto mais recente diferente do anterior | `votos.partido_no_voto` | Desde a última carga | Câmara e Senado |
| A4 | **Gastou na cota** — "R$ 38 mil em setembro; o maior gasto, R$ 12 mil com divulgação" | Soma do mês e a maior categoria | `despesas` (`ano`, `mes`) | Mês fechado | Câmara e Senado |
| A5 | **Emenda paga** — "R$ 1,2 mi pagos em setembro, para Lindoeste (PR)" | Soma das parcelas pagas no mês, com o destino | `emendas_favorecidos` (`competencia`) e `emendas` | Mês | Deputados e senadores com emenda |

⚠️ **A janela é a do dado, ⛔ a do relógio.** A cota chega com semanas de atraso, e a
emenda é publicada por competência mensal. "Gastou em setembro" é o que a casa publicou
sobre setembro até a última carga. A tela diz a data da carga.

#### O que ⛔ entra

| Aviso | Por quê |
|---|---|
| "Votou diferente de você" | **Impossível por desenho**: as respostas do questionário ⛔ são gravadas. Gravar seria guardar opinião política (LGPD art. 5º, II) |
| Ranking ("o que mais gastou", "o mais ausente") | Juízo de valor (RNF-16) e comparação sem base comum |
| Adjetivos ("traiu", "faltou") | RNF-16: o registro, ⛔ a leitura dele |

#### A tela

- Seção **"O que mudou"** no início, só para quem segue alguém, ⛔ substitui a lista de
  quem a pessoa segue: vem antes dela.
- Um item por fato, do mais recente; o nome da pessoa leva à ficha, e o fato leva à aba
  dele (votos, cota, emendas).
- Cada item com a **fonte** e o **dia da carga**: "Câmara dos Deputados · atualizado em
  02/10".
- Vazio honesto: "Nada novo desde a última atualização, em 02/10." ⛔ "Sem novidades
  hoje": a base ⛔ é de hoje.
- Sem conta, a seção ⛔ aparece: seguir exige conta (Pendência 65).

#### API

- `GET /api/seguidos/novidades?desde=` — exige conta, como o resto de `/api/seguidos`.
  `desde` padrão: 7 dias para A1–A3, o último mês fechado para A4–A5.
- 🔴 Lê a tabela `segue`, que é dado sensível: ⛔ log com nome de seguido, ⛔ cache
  compartilhado entre usuários. O cache de leitura do site é por chave, e a chave aqui
  seria a lista de alguém.

#### ⚠️ Pré-requisito — a carga agendada (Pendência 64)

A ETL roda à mão (botões no painel do Aspire). "O que mudou" sem carga agendada é o que
mudou desde a última vez que alguém apertou o botão, e a tela afirmaria uma atualidade que
⛔ tem.

| Carga | Frequência | Comando |
|---|---|---|
| Votações e votos da Câmara e do Senado, ano corrente | Semanal | `ingerir`, `senado` |
| Orientações (vêm com a Câmara) | Semanal | `ingerir` |
| Cota | Mensal | `cota` |
| Emendas e favorecidos | Mensal | `emendas` |
| Conferência | Depois de cada carga | `conferir` — falha se houver ERRO |
| Análise (grafo) | Mensal | `analisar` |

No VPS, o agendamento é do Coolify (tarefa agendada no contêiner da ETL), ⛔ do Aspire,
que é só desenvolvimento.

---

## 5. Validar os dados

### 5.1 As camadas — de Munzner para cá

| Camada | Ameaça | Como validar | Situação |
|---|---|---|---|
| Dado (entrada) | O número está errado | §5.2 e §5.3 | 🟡 parcial |
| Abstração (o método) | A medida ⛔ mede o que diz | `validar` da ETL: comunidade × partido, discriminação do questionário | ✅ existe |
| Codificação (a tela) | A pessoa lê errado | Teste com usuários (§5.4) | ⛔ |
| Algoritmo | O cálculo tem defeito | Testes automatizados — polaridade (API3), 300 .NET, 562 Python, 235 front | ✅ |

### 5.2 Regras de conferência — o que dá para automatizar

Quatro tipos, do mais barato ao mais caro:

1. **Restrição no banco** (`CHECK`, `UNIQUE`, `FK`): o erro ⛔ entra. ✅ Já é a regra 4 do
   projeto.
2. **Canário na ingestão**: volume por ano abaixo do medido derruba a carga. ✅ Câmara e
   Senado.
3. **Plausibilidade depois da carga** — ⭐ **a que falta**, e a que teria pego os 203
   senadores da 55ª ([#37](../achados/037-a-votacao-de-1998-datada-de-2015.md)) no dia da
   carga, e ⛔ por acaso.
4. **Reconciliação com fonte independente** — §5.3.

📐 **As regras de plausibilidade, medidas no banco em 2026-10-02:**

| Regra (dimensão DAMA) | Medido | Leitura |
|---|---|---|
| Quem votou numa legislatura ≤ cadeiras × folga para suplentes (validade) | Senado 100–111 depois da correção; **era 203** na 55ª | ✅ a regra que faltava |
| Votantes numa votação ≤ cadeiras (validade) | Câmara: máximo 510 de 513. Senado: **1 votação com 82**, na 56ª | 🔴 investigar |
| Data da votação dentro da legislatura (consistência) | 0 fora | ✅ |
| Placar gravado = votos contados, Câmara (consistência) | **13 divergências em 6.048** votações com voto | 🟡 investigar as 13 |
| Votação sem nenhum voto (completude) | Câmara 51ª: **1.541 de 1.548**. Nas outras: 129 a 546 por legislatura | ✅ Pendência 68: o painel conta só as com voto nominal e diz quantas ficaram de fora |
| Partido vazio ou "Sem registro" no voto (completude) | ~0% depois da correção | ✅ |
| Código do Senado na numeração da data (validade) | 38 fora de época, já descartadas | ✅ virou regra da ingestão |

✅ **Feito em 2026-10-02 (Pendência 66):** `python -m poligraph_etl conferir` — e o botão
`etl-conferir` no Aspire. Só lê; roda as regras para toda casa e legislatura e **falha**
quando uma regra de ERRO quebra. Regras e limites em `poligraph_etl/conferencia.py`, com
os casos reais nos testes.

📐 **A primeira rodada, no banco de 2026-10-02: 0 erros, 29 avisos.**

| Aviso | Quantos | O que é |
|---|---:|---|
| `placar-divergente` | 13 | 11 são votação só com presença (abaixo); 2 diferem por um voto (52ª e 53ª) |
| `sem-posicao-nenhuma` | 11 | Câmara: eleição de autoridade e indicação ("Eleito o Sr. …"), com o voto de cada um ⛔ publicado. **Secreta de fato**, e a base a marca como aberta (Pendência 69) |
| `votacoes-sem-voto` | 3 | Câmara 51ª (1.541 de 1.548), 52ª (309 de 600) e 54ª (455 de 905) |
| `votantes-na-votacao` · `senadores-por-uf` | 1 · 1 | SF-5999 (2019-08-14): Tocantins com 4 — titular e suplente no dia da troca. É da fonte |

Num segundo momento, o resultado pode ir para a página "Como calculamos": o site dizer o
que conferiu, e quando, é a mesma regra de mostrar a conta junto do número.

### 5.3 Reconciliação — conferir contra o que o órgão publica

| Conferência | Contra o quê | Custo |
|---|---|---|
| **Amostra manual**: 20 votações sorteadas por legislatura e casa | O placar e a lista no site oficial da Câmara e do Senado | Algumas horas por legislatura. Vira achado com a lista sorteada e o resultado |
| Quem votou × quem foi eleito | Resultado do TSE por eleição | Médio: o TSE já é fonte do projeto |
| Senadores em exercício × quem votou na corrente | `/senador/lista/atual` | Baixo |
| Gasto de cota somado × total publicado pela casa | Painéis de transparência das casas | Médio |

### 5.4 Validar a apresentação — com gente

⚠️ A avaliação de usabilidade feita até aqui é **heurística**, por especialista. Ela acha
problema de forma; ⛔ mede se a pessoa entende.

**Proposta mínima:** 5 pessoas, sem treino, 6 tarefas, pensando em voz alta:

1. Descobrir quem do seu estado vota mais parecido com você.
2. Dizer como um deputado escolhido votou numa votação dada.
3. Dizer se esse deputado costuma seguir o partido.
4. Achar quanto ele gastou na cota no último ano, e com o quê.
5. No grafo, dizer em que grupo ele está e quem mais está lá.
6. Ver a mesma lista em 2019–2023.

Medir acerto, tempo e onde a pessoa travou. O Clarity, que já tem consentimento, grava a
sessão. As tarefas 1 e 2 ⛔ são possíveis hoje: elas testam exatamente as lacunas 🔴 do §3.

---

## 6. Ordem sugerida

| # | O quê | Por quê |
|---|---|---|
| ✅ 1 | `conferir` na ETL (§5.2) | Feito em 2026-10-02 |
| 2 | Filtro por estado no resultado (§3) | Maior valor por esforço; dado já na tela |
| ✅ 3 | Busca nos votos da ficha (§3) | Feito em 2026-10-02 |
| 4 | Amostra manual (§5.3) | Dá ao TCC a frase "conferido contra a fonte oficial" |
| 5 | Carga agendada (Pendência 64), depois "O que mudou" (§4.1, decidido) | Substitui as notícias |
| 6 | Teste com 5 pessoas (§5.4) | Valida as quatro acima |
| 7 | Comparação de dois parlamentares; matriz partido × grupo | Desejável |

---

## Fontes

- Munzner, T. *A Nested Model for Visualization Design and Validation*. IEEE TVCG, 2009 — [PDF](https://www.cs.ubc.ca/labs/imager/tr/2009/NestedModel/NestedModel.pdf)
- Shneiderman, B. *The Eyes Have It: A Task by Data Type Taxonomy for Information Visualizations*. IEEE Visual Languages, 1996 — [PDF](https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf)
- Cleveland, W.; McGill, R. *Graphical Perception*. JASA, 1984 — [resumo](https://en.wikipedia.org/wiki/Graphical_perception)
- Ghoniem, M.; Fekete, J.-D.; Castagliola, P. *On the Readability of Graphs Using Node-Link and Matrix-Based Representations*. Information Visualization, 2005 — [periódico](https://journals.sagepub.com/doi/10.1057/palgrave.ivs.9500092); reavaliação em [Okoe et al., 2018](https://arxiv.org/pdf/1709.00293)
- Analysis Function (governo britânico). *Data visualisation: charts*, 2022 — [guia](https://analysisfunction.civilservice.gov.uk/policy-store/data-visualisation-charts/) e [checklist](https://analysisfunction.civilservice.gov.uk/policy-store/charts-a-checklist/)
- Padilla, L.; Kay, M.; Hullman, J. *Uncertainty Visualization*, 2020 — [PDF](https://friendly.github.io/6135/papers/Uncertainty_Visualization_Padilla_Kay_Hullman_2020.pdf)
- DAMA UK. *The Six Primary Dimensions for Data Quality Assessment* — [PDF](https://www.sbctc.edu/resources/documents/colleges-staff/commissions-councils/dgc/data-quality-deminsions.pdf)
- Filtros e facetas — [Faceted search](https://en.wikipedia.org/wiki/Faceted_search); [boas práticas em sites de conteúdo](https://www.designbysoapbox.com/best-practices-for-filtering-in-content-heavy-websites/)
- Referência de domínio: [Voteview](https://github.com/voteview/WebVoteView), votações nominais do Congresso americano
