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
    comunidade  SMALLINT,   -- grupo detectado por Louvain (§3.5)
    eixo_x      REAL,       -- layout de molas — posição no DESENHO (§3.6)
    eixo_y      REAL,       -- idem
    governismo  REAL,       -- % de votos alinhados com a orientação do governo
    disciplina  REAL,       -- % de votos alinhados com a orientação do partido
    n_votacoes  INT NOT NULL,
    PRIMARY KEY (execucao_id, pessoa_id)
);
```

| Campo | O que significa | ⚠️ |
|---|---|---|
| `comunidade` | Grupo detectado **pelo voto**, não pelo partido | ⭐ Comparar com o partido é o objetivo específico #3 |
| `eixo_x` | Coordenada horizontal no desenho | 🔴 **Descritiva, ⛔ não é medida** — ver §3.6 |
| `eixo_y` | Coordenada vertical no desenho | 🔴 Idem. **Nenhum dos dois eixos tem interpretação** |
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

### 3.2 🔴 O peso principal — a matemática da similaridade

> **Medido na legislatura 57 completa em 2026-08-26:** 643 deputados, 1.127 votações de
> plenário, 470.786 votos. Os números desta seção saem desse banco, ⛔ não de estimativa.

Para cada par (A, B) da **mesma casa**:

```
1. Conjunto comum C = votações em que AMBOS se posicionaram
2. |C| < 20  →  descarta o par                       (RN-02, §3.2.3)
3. peso de cada votação v ∈ C: w(v) = categoria(v) × 0,86^anos(v)
4. similaridade = fórmula da métrica, ponderada por w
```

#### 3.2.1 As duas fórmulas, escritas por extenso

🔴 **Ambas são calculadas e guardadas** (RF-18); a coluna `metrica` distingue. Comparar
as duas **é resultado do TCC**, não indecisão.

**Concordância simples** — vai para a TELA:

```
                  Σ  w(v) · [ voto_A(v) == voto_B(v) ]
                 v∈C
concordância =  ───────────────────────────────────────
                          Σ  w(v)
                         v∈C
```

Lê-se direto: *"votaram igual em 82% das votações que ambos participaram"*. É o número
que a RF-29 exige acompanhado da base.

**Cosseno** — vai para o GRAFO:

```
             ⟨ a , b ⟩                    onde  a = (voto_A(v) · w(v))
cos(a,b) =  ───────────                         b = (voto_B(v) · w(v))    v∈C
             ‖a‖ · ‖b‖

                cos(a,b) + 1
cosseno_01  =  ──────────────
                     2
```

⚠️ **O reescalonamento não é cosmético.** O cosseno cru vive em [−1, 1] e o banco exige
[0, 1] (`ck_sim_valor`). Sem a transformação, todo par em oposição seria rejeitado pelo
`CHECK` — e o grafo perderia justamente a informação de quem vota ao contrário.

⚠️ **Voto é −1, 0 ou +1** (RN-03). A abstenção (0) anula o termo no produto interno, o
que é o comportamento correto: ela não é meio-termo entre Sim e Não.

#### 3.2.2 O peso de cada votação — dois fatores

**a) Categoria** — nem toda votação diz o mesmo sobre uma pessoa:

| Categoria | Peso | Por quê |
|---|---|---|
| `SUBSTANTIVA` | **1,0** | Mérito da matéria — o sinal mais forte |
| `DESTAQUE` | **0,7** | Mérito, mas de um trecho |
| `AUTORIDADE` | **0,3** | Voto em pessoa, não em política |
| `PROCEDIMENTAL` | **0,0** | ⛔ Fora da matriz — mede obstrução, não posição |

> 🔴 **Correção de 2026-08-26.** A regex de categoria classificava como `DESTAQUE` toda
> descrição que citasse a palavra — inclusive *"Aprovado o Substitutivo […] **ressalvados
> os destaques**"*, que é voto no TEXTO PRINCIPAL: a frase menciona destaque para dizer
> que ele **não** estava em jogo. Eram **69 votações de mérito** da legislatura 57
> entrando com peso 0,7 em vez de 1,0. Corrigido com *lookbehind* negativo. ⭐ A
> polaridade não foi afetada — ela olha `"mantido o texto"`, não a categoria.

**b) Recência** — a posição muda devagar, mas muda:

```
peso_tempo = r ^ anos_decorridos          com r = 0,86
```

⭐ **O `r = 0,86` não é arbitrário.** Vem da correlação medida entre a similaridade de
2023 e a de 2025 sobre 9.873 pares: **r = 0,862**, diferença absoluta média de 7,5 pp
([`00-discovery §7.4.1`](../00-discovery.md)). Traduz uma afirmação verificada — *a
posição é estável dentro da legislatura* — em decaimento suave.

#### 3.2.3 🔴 Por que o mínimo é 20 votações em comum (RN-02)

**A pergunta certa é: quantas votações bastam para o número não ser sorte?**

Com |C| pequeno a proporção é instável — dois deputados que coincidiram em 3 votações
podem marcar 100% sem que isso signifique nada. O corte em 20 é onde o custo de manter
passa a superar o de descartar:

| | Medido |
|---|---|
| Deputados com **menos de 20** posicionamentos na legislatura 57 | **6 de 643** (0,9%) |
| Mediana de posicionamentos por deputado | **821** |
| Mediana de votações em comum entre pares guardados | **279** |
| Pares acima do corte | **185.908** |

⭐ **O corte custa pouco e protege muito:** exclui menos de 1% dos deputados, e a
mediana de base dos pares que ficam é 279 — quatorze vezes o mínimo. Na medição do
discovery, sobre 2025 isolado, o custo era de 14 deputados em 552 (2,5%).

⚠️ **No Senado o corte morde mais:** 88% dos pares têm ≥ 20 em comum, com média de 33
([`11-api-senado §2.5`](../11-api-senado.md)). O intervalo de confiança lá é de ±17 pp —
o custo é precisão, não viabilidade.

🔴 **A regra vive no banco, não em comentário:**

```sql
CHECK (n_votacoes_comuns >= 20)   -- ck_sim_minimo
```

Um bug no Python que tentasse gravar par com base insuficiente é rejeitado pelo Postgres.
É a regra 4 do projeto: *onde a regra puder virar `CHECK`, ela vira.*

#### 3.2.4 ⚠️ O que fica de fora da matriz, e por quê

| Filtro | Motivo |
|---|---|
| `casa = 'CAMARA'` | Câmara e Senado votam matérias diferentes (achado #7) — o par entre casas não teria base comum |
| `legislatura = 57` | §3.2.5 |
| `plenario` | Comissão é **3× mais consensual** que plenário (39% vs 12% de quase unanimidade); misturar achataria a similaridade |
| `NOT secreta` | Sem voto individual registrado, não há o que comparar |
| `valor IS NOT NULL` | Ausência ⛔ **não é discordância** — ver §4.4 |
| `valor != 0` | Abstenção é posição declarada de não tomar partido |

#### 3.2.5 🔴 Por que só a legislatura 57

> **Resposta à pergunta do autor: sim, só a 57 — e por quatro motivos medidos.**

| Motivo | |
|---|---|
| 🔴 **Cobertura** | Deputado eleito em 2022 **não votou nada** da legislatura 56. Comparar entre legislaturas geraria "sem dados" para boa parte do painel |
| 🔴 **Comparabilidade** | A RN-02 exige base comum. Misturar legislaturas infla `|C|` com votações que metade do painel não podia ter votado |
| **Relevância** | Pauta de 2019 mede afinidade com um debate que já passou |
| **Estabilidade** | Dentro da legislatura, r = 0,862. **Entre** legislaturas, ⛔ não se mediu — e afirmar sem medir é o erro que este projeto já cometeu antes |

⚠️ **A decisão vale para o questionário e para o grafo do produto.** O histórico
2001–2026 continua disponível para análise no TCC — são perguntas diferentes.

⛔ **E ainda NÃO está no código** — nenhuma consulta filtra por legislatura fora do ETL.
É a **PL35**, e o prazo é real: a 57ª termina em **janeiro de 2027**.

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

### 3.5 🔴 As comunidades — como são detectadas e o que significam

**Algoritmo: Louvain**, ponderado pela similaridade, sobre o grafo kNN.

```python
nx.community.louvain_communities(g, weight="peso", seed=SEMENTE)
```

⭐ **O número de comunidades NÃO é escolhido.** Louvain o encontra maximizando
modularidade. Fixar *k* de antemão embutiria a resposta na pergunta do objetivo
específico #3 — que é justamente saber se o voto agrupa como o partido.

**Medido na legislatura 57:**

| | |
|---|---|
| Comunidades detectadas | **30** — mas 631 dos 655 nós em **seis** |
| Tamanhos das seis | 241 · 171 · 111 · 76 · 18 · 14 |
| Isolados (sem aresta) | 24 |

Composição partidária das quatro maiores:

| # | Deputados | Partidos predominantes |
|---|---:|---|
| 1 | 241 | UNIÃO, REPUBLICANOS, PP, MDB, PODE |
| 2 | 171 | PL, PP, UNIÃO, MDB, PODE |
| 3 | 111 | PT, PCdoB, PSB, PV, REDE |
| 4 | 76 | PSD, UNIÃO, PSB, PODE, PP |

⭐ **UNIÃO aparece em quatro das seis.** O partido não determina o bloco — é o achado
central do objetivo #3, visto de perto.

#### 3.5.1 ✅ RQ2 resolvida — ARI **e** modularidade

A RQ2 perguntava *"ARI ou modularidade?"*. **A resposta é as duas, porque respondem
coisas diferentes:**

| Medida | Responde | Medido |
|---|---|---|
| **ARI** | As comunidades *coincidem* com os partidos? | **0,277** |
| **Modularidade da comunidade** | A divisão por voto descreve o grafo? | **0,558** |
| **Modularidade do partido** | E a divisão por partido? | **0,288** |

⚠️ Sozinha, a modularidade não compara nada — mede a qualidade de UMA partição. Sozinho,
o ARI diz que duas partições diferem, mas ⛔ não diz qual descreve melhor.

⭐ **Juntas sustentam a afirmação do TCC:** *as comunidades de voto descrevem a estrutura
quase duas vezes melhor que os partidos (0,558 × 0,288), e coincidem com eles apenas em
0,277.*

🔴 **"Ajustado" no ARI é a palavra que importa.** O Rand simples sobe só por haver muitos
grupos: com 25 partidos e 30 comunidades, quase todo par de deputados cai em grupos
diferentes nas duas partições, e isso contaria como concordância. O ajuste desconta o
acaso — por isso **0 significa "nada além do acaso"**, não "nenhuma coincidência".

⚠️ Implementados à mão (`comparacao.py`) em vez de trazer `scikit-learn`: o ARI são vinte
linhas e a modularidade o `networkx` já tem. 30 MB de dependência por uma função seria
custo sem contrapartida.

---

### 3.6 ⚠️ A posição no desenho — o que ela NÃO é

**Algoritmo: layout de molas (Fruchterman-Reingold)**, `nx.spring_layout`.

> 🔴 **Isto DIVERGE do plano original**, e a divergência precisa estar registrada: o
> rascunho previa `eixo_x` como **1ª componente do SVD** — um eixo ordenado e
> interpretável, na linhagem do W-NOMINATE. O que está implementado é layout de molas,
> que ⛔ **não tem eixo interpretável nenhum**.

| | SVD / PCA (planejado) | Molas (implementado) |
|---|---|---|
| O eixo x significa algo? | **Sim** — ordena por posição | ⛔ **Não** |
| Bom para desenhar o grafo? | Regular — ignora as arestas | ⭐ **Sim** — é para isso |
| Risco de ler espectro onde não há | Existe, e é grande | Menor, mas o leitor lê assim mesmo |

**Consequência prática:** hoje a tela diz, com todas as letras, que *não existe
"esquerda" à esquerda*. Isso é honesto com o layout de molas — e seria **falso** com SVD,
onde o eixo teria sim uma ordenação defensável.

⏳ **Decisão em aberto (PL43):** guardar as duas coisas — PCA para o eixo interpretável do
TCC, molas para o desenho — ou ficar só com molas. As colunas já existem; o que falta é a
escolha.

#### 3.6.1 🔴 O que mede cada eixo — e o que o centro NÃO é

**Medido na legislatura 57 completa:**

| Componente | Variância explicada |
|---|---|
| **1ª** | **34,6%** |
| 2ª | 9,6% |
| 3ª | 3,0% |

⭐ **A primeira explica 3,6× mais que a segunda.** É resultado, não detalhe técnico: o
comportamento de voto da Câmara é **quase unidimensional**. A figura sai achatada porque
essa é a forma verdadeira — o layout de molas a arredonda por conta própria.

🔴 **O centro da figura NÃO é moderação.**

Ausência e abstenção viram `0` antes do SVD. Depois de centrar, zero fica perto da média,
e **quem faltou muito é empurrado para o meio**. O centro mistura duas coisas
incomparáveis.

| | Mediana de votações |
|---|---|
| 80 nós mais próximos do centro | **472** |
| 80 nós nos extremos | **925** |

Correlação entre distância do centro e número de votações: **r = 0,566**.

⛔ É limitação do método, não bug — a literatura de *ideal point estimation* trata
ausência com imputação justamente por isso. Está dito na tela, junto do seletor de
layout, e travado por teste em `test_grafo.py`.

⚠️ **E o sinal é convenção nossa.** Numericamente a figura espelhada é igualmente válida;
qual lado fica à esquerda foi escolha de implementação, não do dado.

#### 3.6.2 O que a 1ª componente separou

⭐ Sem que ninguém dissesse ao algoritmo o que é PT ou PL:

| Extremo negativo | Extremo positivo |
|---|---|
| Merlong Solano (PT) | Sargento Fahur (PL) |
| Luiz Couto (PT) | Delegado Paulo Bilynskyj (PL) |
| Jandira Feghali (PCdoB) | Rodolfo Nogueira (PL) |

---

🔴 **Reprodutibilidade:** Louvain e o layout são estocásticos. **Semente fixa (20260826)**
em ambos, e mudá-la exige nova `versao_carga` na tabela `execucao`. Sem isso, a banca
reproduz o experimento e não bate — o que é fatal num TCC. As comunidades são numeradas
por **tamanho**, não pela ordem que o algoritmo devolve, senão a legenda da tela troca de
cor entre duas execuções do mesmo dado.

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

### 4.6 🔴 Onde o cidadão aparece no grafo

Ele **não é nó** — não está em `no_metrica`, não tem aresta, não entra no Louvain. Mas
**é posicionado**, e a conta é esta:

```
                Σ  c_i² · (x_i , y_i)
               i∈V
posição  =  ──────────────────────────      V = os 10 parlamentares
                    Σ  c_i²                     de maior concordância c
                   i∈V
```

Centroide dos vizinhos, **ponderado pela concordância ao quadrado**.

#### 4.6.1 Três decisões, e o que cada uma evita

| Decisão | O que evita |
|---|---|
| **Centroide**, ⛔ não a posição do 1º colocado | O topo empata — mediana de **30** empatados com 22 perguntas. Copiar o primeiro seria sortear entre gente que a conta não distingue |
| Peso ao **quadrado** | Sem elevar, quem concordou em 60% puxa quase tanto quanto quem concordou em 95%, e todos acabam no meio do desenho — parece medida e não separa nada |
| Comunidade pela **moda** dos vizinhos | Mesma razão do primeiro item |

#### 4.6.2 🔴 A franqueza obrigatória na tela

⚠️ **A posição do cidadão e a do deputado NÃO são a mesma medida com o mesmo nome:**

| | Base |
|---|---|
| Deputado | até **1.127** votações |
| Cidadão | as perguntas que respondeu — hoje **21** |

Por isso `PosicaoDoCidadao.BaseDeVotacoes` viaja junto na resposta da API e **aparece na
tela**: *"sua posição vale sobre 21 perguntas — a de cada deputado, sobre a legislatura
inteira"*. Omitir isso afirmaria uma precisão que o dado não tem.

⛔ Sem execução do grafo concluída a API devolve `null` e a tela **omite o desenho** —
não inventa ponto.

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

## 5.2 🔵 O que NÃO é gravado hoje — e a decisão adiada (PL34)

> **Nenhuma resposta individual do questionário é salva.** O cálculo acontece em memória,
> na requisição, e o resultado não é persistido. Fechada a aba, não há registro de que a
> pessoa respondeu — muito menos do que respondeu.

### 5.2.1 O que é gravado hoje

Só se a pessoa preencher a avaliação opcional, e **sem vínculo com a conta**:

| Campo | O que é |
|---|---|
| `perguntas_respondidas` | **Quantas**, nunca quais |
| `acordos_do_primeiro` · `comparaveis_do_primeiro` | O placar do primeiro colocado |
| `acertou` | Se o resultado combinou com o esperado |
| `posicao_autodeclarada` | Escala de −3 a +3 |

⛔ **Não existe coluna de resposta.** Não há `q1 = concordo` em lugar nenhum do schema.

### 5.2.2 Por que assim

> **Guardar as 22 respostas seria guardar a opinião política da pessoa, pergunta por
> pergunta** — posição declarada sobre anistia, armas, licenciamento, item a item.
>
> É mais sensível que a lista de quem ela segue, porque seguir é interesse; responder é
> posição.

E não era preciso: para validar o método bastam o placar e a autodeclaração.

### 5.2.3 🔵 O que se perde — e a decisão adiada

Sem as respostas individuais, duas perguntas ficam sem resposta:

| Pergunta que não dá para responder | Por que importa |
|---|---|
| *"Qual afirmação mais divide os usuários?"* | Mede se o questionário discrimina |
| ⭐ *"Qual afirmação ninguém entende?"* | 🔴 **Avalia a curadoria** — taxa alta de "não sei" numa pergunta significa que a reescrita falhou (PL11, PL12) |

⭐ **O desenho que resolveria isso sem criar perfil:** uma linha por questionário
respondido, com as respostas e **sem `usuario_id`** — exatamente o padrão já usado na
`avaliacao_questionario`.

Isso permitiria afirmar *"a q7 teve 40% de 'não sei'"*, que é achado forte sobre o método,
sem permitir *"o Fulano respondeu X na q7"*.

⚠️ **Adiado por decisão do autor (2026-08-26).** Registrado como **PL34** — hoje o sistema
não grava, e mudar isso é acréscimo, não correção.

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
| **PL34** | 🔵 **Adiada** — gravar respostas individuais sem vínculo com a conta, para avaliar a curadoria (§5.2.3) |
