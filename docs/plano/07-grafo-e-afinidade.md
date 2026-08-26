# Grafo e afinidade — o que fica no nó, na aresta, e como o cálculo funciona

> **Status:** v1.0 — 2026-08-26
> Consolida o que estava espalhado entre [`00-discovery §5–7`](../00-discovery.md),
> [`04-contratos`](../04-contratos.md) e [`plano/04-esqueleto`](04-esqueleto.md).
> **É o núcleo técnico do TCC** — o que a banca vai perguntar.

---

## 1. 🔴 A distinção que organiza tudo

São **dois cálculos diferentes**, e confundi-los é o erro conceitual mais provável aqui:

| | **Grafo** | **Afinidade** |
|---|---|---|
| Compara | Parlamentar × parlamentar | ⭐ **Cidadão × parlamentar** |
| Base | ~1.100 votações | **22 perguntas** |
| Quando roda | No ETL, 1×/dia | **Ao vivo**, a cada questionário |
| Onde vive | Tabelas `similaridade`, `aresta_grafo`, `no_metrica` | Nada persistido (RNF-12) |
| Responde | *"Quem vota parecido com quem?"* | *"Com quem EU pareço?"* |

> ⚠️ **O cidadão nunca vira nó do grafo.** Ele é comparado contra cada parlamentar, mas
> não entra na estrutura — se entrasse, cada visita mudaria o grafo, e o dado dele
> passaria a ser persistido.

---

## 2. O que fica em cada NÓ

Um nó = um parlamentar. Os dados moram em **duas tabelas com ciclos de vida diferentes**.

### 2.1 `pessoa` — identidade, muda raramente

| Campo | |
|---|---|
| `id` | ID sintético próprio (RF-11) |
| `nome_civil`, `nome_exibicao` | |
| `data_nascimento`, `sexo` | |
| `cpf_hash` | ⛔ Nunca o CPF em claro |

### 2.2 `no_metrica` — o que o ETL calcula, muda a cada execução

```sql
CREATE TABLE no_metrica (
    execucao_id BIGINT REFERENCES execucao(id) ON DELETE CASCADE,
    pessoa_id   BIGINT REFERENCES pessoa(id),
    comunidade  SMALLINT,   -- grupo detectado por Louvain
    eixo_x      REAL,       -- 1ª componente do SVD — o "eixo ideológico"
    eixo_y      REAL,       -- 2ª componente
    governismo  REAL,       -- % de votos alinhados com a orientação do governo
    disciplina  REAL,       -- % de votos alinhados com a orientação do partido
    n_votacoes  INT NOT NULL,
    PRIMARY KEY (execucao_id, pessoa_id)
);
```

| Campo | O que significa | ⚠️ |
|---|---|---|
| `comunidade` | Grupo detectado **pelo voto**, não pelo partido | ⭐ Comparar com o partido é o objetivo específico #3 |
| `eixo_x` | Posição na 1ª componente principal | Ordena o espectro sem rótulo político |
| `eixo_y` | 2ª componente | Costuma capturar governo × oposição |
| `governismo` | | 🔴 **NULL no Senado** — não há orientação de bancada |
| `disciplina` | | 🔴 **NULL no Senado** — idem |
| `n_votacoes` | Quantas votações a pessoa participou | Nó com poucas votações é frágil |

⭐ **Por que `execucao_id` na chave:** cada rodada do ETL gera um retrato completo. Isso
dá **reprodutibilidade** — a figura do TCC aponta para uma execução específica, e ela não
muda quando o ETL rodar de novo.

### 2.3 O que a página do parlamentar mostra (mas não guarda aqui)

| Vem de | O quê |
|---|---|
| `voto` + `votacao` | Histórico de votos |
| `similaridade` | Os mais parecidos e os mais distantes |
| `pessoa_fonte_id` + TSE | Patrimônio, votação recebida |
| `noticia_pessoa` | Notícias recentes |

---

## 3. O que fica em cada ARESTA

```sql
CREATE TABLE aresta_grafo (
    execucao_id BIGINT REFERENCES execucao(id) ON DELETE CASCADE,
    pessoa_a    BIGINT REFERENCES pessoa(id),
    pessoa_b    BIGINT REFERENCES pessoa(id),
    tipo        TEXT NOT NULL CHECK (tipo IN
                  ('SIMILARIDADE_VOTO','COMISSAO_COMUM','COAUTORIA')),
    peso        REAL NOT NULL,
    PRIMARY KEY (execucao_id, pessoa_a, pessoa_b, tipo),
    CHECK (pessoa_a < pessoa_b)          -- I3: não-direcionada, uma vez só
);
```

### 3.1 Os três tipos, e qual é o principal

| Tipo | Peso | Situação |
|---|---|---|
| ⭐ **`SIMILARIDADE_VOTO`** | Similaridade `0..1` | **O grafo principal.** É o que o título chama de modelagem em grafos |
| `COMISSAO_COMUM` | Nº de comissões compartilhadas, normalizado | 🟡 Opcional — mede convivência, não concordância |
| `COAUTORIA` | Nº de proposições coassinadas | 🟡 Opcional |

⚠️ **Não misture os três num peso só.** São relações de naturezas diferentes; somá-las
produz um número sem interpretação. São **camadas** do mesmo grafo.

### 3.2 🔴 O peso principal — como a similaridade é calculada

Para cada par (A, B) da **mesma casa**:

```
1. Encontrar as votações em que AMBOS votaram          → conjunto comum C
2. Se |C| < 20, descartar o par                         → RN-02
3. Para cada votação em C, comparar os votos
4. peso = Σ (concordância × peso_da_votação) / Σ peso_da_votação
```

#### 3.2.1 O peso de cada votação — dois fatores

**a) Categoria** — nem toda votação diz o mesmo sobre uma pessoa:

| Categoria | Peso | Por quê |
|---|---|---|
| `SUBSTANTIVA` | **1,0** | Mérito da matéria — o sinal mais forte |
| `DESTAQUE` | **0,7** | Mérito, mas de um trecho |
| `AUTORIDADE` | **0,3** | Voto em pessoa, não em política |
| `PROCEDIMENTAL` | **0,0** | ⛔ Fora da matriz — mede obstrução, não posição |

**b) Recência** — a posição muda devagar, mas muda:

```
peso_tempo = r ^ (anos_decorridos)        com r = 0,86
```

⭐ **O `r = 0,86` não é arbitrário.** Vem da correlação medida de posição entre anos
dentro da legislatura ([`00-discovery §7.4.1`](../00-discovery.md)).

#### 3.2.2 Duas métricas, e por que ambas

| Métrica | Fórmula | Boa para |
|---|---|---|
| **Concordância simples** | `acordos / comparações` | ⭐ Explicável: *"votaram igual em 82% das vezes"* |
| **Cosseno** | `(A·B) / (‖A‖‖B‖)` | Trata abstenção com nuance; padrão na literatura |

⭐ **Ambas são calculadas e guardadas** (RF-18) — a coluna `metrica` distingue. Comparar as
duas **é resultado do TCC**, não indecisão.

### 3.3 ⭐ Por que kNN e não limiar global

A tentação é: *"cria aresta se similaridade > 0,8"*. **Foi medido e não funciona.**

| | |
|---|---|
| Similaridade média entre dois deputados quaisquer | **0,663** — não 0,5 |
| Densidade com limiar 0,90 | **11,6%** — ainda um borrão |

> 🔑 **Deputados concordam muito.** A maior parte das votações é consensual, então o
> limiar global ou liga quase todo mundo, ou ninguém.

✅ **Solução: kNN com k = 10.** Cada nó liga aos seus 10 mais parecidos.

| Ganho | |
|---|---|
| Densidade previsível | 644 nós × 10 ≈ **6.440 arestas**, não 207 mil |
| Grafo legível | O layout *force-directed* separa grupos |
| ⭐ Robusto a escala | Um deputado "concordante com todos" não vira hub artificial |

### 3.4 🔴 Os dois invariantes que o banco garante

| | Regra | Onde |
|---|---|---|
| **I1** | ⛔ **Nunca aresta entre casas.** Deputado e senador não votam as mesmas matérias (achado #7) | `CHECK` + trigger |
| **I3** | Aresta não-direcionada, gravada uma vez | `CHECK (pessoa_a < pessoa_b)` |

⚠️ **São dois grafos independentes**, um por casa. Isso é achado do projeto, não limitação.

---

## 4. ⭐ Como o questionário decide o político mais alinhado

Aqui está o cálculo que o cidadão vê. **É deliberadamente simples** — e a simplicidade é
argumento, não preguiça.

### 4.1 As três peças

| Peça | Domínio | Origem |
|---|---|---|
| `r_q` — resposta do cidadão à pergunta *q* | `+1` concordo · `−1` discordo · `0` não sei | Tela |
| `v_pq` — voto do parlamentar *p* na votação de *q* | `+1` sim · `−1` não · `0` abstenção · `NULL` ausente | `voto` |
| `pol_q` — polaridade da pergunta | `+1` ou `−1` | `pergunta` — 🔴 **hoje sempre +1** |

### 4.2 O cálculo, em quatro passos

```
1. POSIÇÃO EFETIVA do parlamentar na afirmação:
       s_pq = v_pq × pol_q

2. COMPARÁVEL? a pergunta entra na conta se:
       r_q ≠ 0        (o cidadão opinou)
   E   v_pq ≠ NULL    (o parlamentar votou)
   E   s_pq ≠ 0       (não foi abstenção)

3. ACORDO na pergunta q:
       acordo = (s_pq == r_q)

4. AFINIDADE:
       afinidade(p) = acordos(p) / comparáveis(p)
```

### 4.3 Um exemplo completo

Cidadão responde 5 perguntas; todas com `pol = +1`:

| Pergunta | Cidadão `r` | Deputado A `v` | `s` | Comparável? | Acordo? |
|---|---|---|---|---|---|
| 1 · anistia 8/1 | −1 discordo | +1 sim | +1 | ✅ | ⛔ |
| 4 · 80% da pena | +1 concordo | +1 sim | +1 | ✅ | ✅ |
| 8 · licenciamento | −1 discordo | −1 não | −1 | ✅ | ✅ |
| 13 · derrubar IOF | 0 não sei | +1 sim | +1 | ⛔ *(não opinou)* | — |
| 16 · ensino médio | +1 concordo | NULL ausente | — | ⛔ *(não votou)* | — |

```
comparáveis = 3 · acordos = 2 · afinidade = 2/3 = 0,667
```

⭐ **O que a tela mostra (RF-29):** *"Você concordou com o Deputado A em **2 de 3**
perguntas comparáveis."*

> 🔑 **Nunca um percentual solto.** "67%" esconde que a base foram 3 perguntas. "2 de 3"
> mostra a fragilidade do próprio número — e é honestidade metodológica que a banca cobra.

### 4.4 🔴 Quatro armadilhas que o desenho já trata

| # | Armadilha | Tratamento |
|---|---|---|
| 1 | **Denominador variável** | Cada parlamentar tem um nº de comparáveis diferente. ⭐ Por isso "X de Y", e não ranking por percentual cru |
| 2 | **Poucos comparáveis inflam** | Quem votou em 2 perguntas e concordou nas 2 dá 100%. 🔴 **Piso: `comparáveis ≥ 60% do N`** — abaixo disso, fora do ranking |
| 3 | **Empates em massa** | Com 22 perguntas há muitos empates. ⭐ Mostrar **todos os empatados**, não escolher um |
| 4 | **Respostas insuficientes** | Se o cidadão responder "não sei" demais, o resultado não significa nada → **HTTP 422** (CT7) |

### 4.5 ⭐ Por que concordância simples e não cosseno, aqui

| | Grafo | Questionário |
|---|---|---|
| Base | ~1.100 votações | 22 perguntas |
| Precisa ser explicável ao cidadão? | ⛔ Não | ✅ **Sim** |
| Métrica | Ambas (RF-18) | ⭐ **Concordância simples** |

> **"Você concordou em 17 de 20"** é auditável por qualquer pessoa. **"Cosseno 0,84"** não
> significa nada para o usuário — e não dá para conferir.

⚠️ **API4 fica resolvida assim:** cosseno **no grafo**, concordância simples **na tela**.

### 4.6 Onde o cidadão aparece no grafo — se aparecer

Ele **não é nó**. Mas dá para projetá-lo no mesmo eixo, para efeito visual:

```
eixo_x(cidadão) = Σ (r_q × carga_q) / Σ |carga_q|
```

onde `carga_q` é o peso da votação de *q* na 1ª componente do SVD.

⚠️ **É visualização, não medida.** Projetar 22 respostas no eixo derivado de 1.100
votações **não tem a mesma precisão** — e isso precisa estar escrito na legenda da figura.

---

## 5. Como isso vira código

| Etapa | Onde | Quando |
|---|---|---|
| Matriz, similaridade, comunidades, eixos | 🐍 **Python** | ETL diário |
| Grava `similaridade`, `aresta_grafo`, `no_metrica` | 🐍 Python | Idem |
| Lê e serve o grafo | ⚙️ C# | Sob demanda |
| ⭐ **Calcula a afinidade do cidadão** | ⚙️ **C#**, em memória | A cada `POST /api/afinidade` |

> ⚠️ **A afinidade é a única conta que o C# faz** — e faz porque depende da resposta do
> usuário, que não existe no ETL. Todo o resto é leitura.

### 5.1 O contrato do endpoint

```
POST /api/afinidade
{ "respostas": [ { "perguntaId": "q1", "valor": -1 }, ... ] }

200 → { "casa": "CAMARA",
        "totalPerguntasRespondidas": 18,
        "maisProximos": [ { "pessoaId": 204528, "nome": "...", "partido": "...",
                            "acordos": 15, "comparaveis": 17 } ],
        "maisDistantes": [ ... ] }          // RF-28

422 → respostas insuficientes (CT7)
```

⛔ **A resposta não contém percentual.** Contém `acordos` e `comparaveis` — o front monta
a frase. Assim a regra do RF-29 não pode ser burlada por engano na tela.

---

## 6. Pendências

| # | Pendência |
|---|---|
| ~~API4~~ | ✅ **Resolvida** (§4.5): cosseno no grafo, concordância simples na tela |
| **CT7** | 🔴 Definir o piso de respostas para o `422` — sugestão: **60% do N** |
| **RQ2** | Métrica de comparação comunidade × partido (ARI? modularidade?) |
| **PL5** | Biblioteca do grafo no front (D3? Cytoscape? sigma.js?) |
| **API7** | Medir o tempo real do job de similaridade |
| **RQ3** | N final de perguntas |
