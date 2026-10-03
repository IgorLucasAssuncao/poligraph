# Achado #25 — a métrica de afinidade não é onde mora a qualidade

> **Tipo:** achado medido · **Medido em:** 2026-08-27 · **Fonte:** matriz real da legislatura 57 (643 × 1.122)
> **Status:** ✅ Vale
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número.

---

## A pergunta

*"A forma como calculamos afinidade é a melhor para este caso?"* — e, por trás dela, a
suspeita razoável de que trocar a métrica melhoraria o resultado.

## Resultado: quatro métricas, o mesmo ranking

Medido em **6.632 pares** de uma amostra de 120 deputados, todos com ao menos 20 votações
em comum. Correlação de ranking (Spearman):

| | concordância | cosseno | Pearson | ponderada |
|---|---:|---:|---:|---:|
| **concordância** | 1,000 | **0,999** | 0,996 | 0,925 |
| **cosseno** | 0,999 | 1,000 | 0,998 | 0,922 |
| **Pearson** | 0,996 | 0,998 | 1,000 | 0,928 |
| **ponderada** | 0,925 | 0,922 | 0,928 | 1,000 |

> A "ponderada" pesa cada votação pela **surpresa** do voto — `-log₂` da frequência
> daquela posição —, que é a ideia por trás de dar menos peso a votação quase unânime.

🔴 **Concordância simples, cosseno e Pearson são a mesma medida, para este dado.** Elas
divergem quando os vetores têm magnitudes diferentes; aqui todo voto é `-1`, `0` ou `1`,
e o espaço é o mesmo para todos.

## E a ponderada, que diverge, ⛔ não discrimina melhor

Empate mediano no topo — quantos parlamentares ficam empatados na primeira posição:

| Perguntas | Concordância simples | Ponderada por informação |
|---:|---:|---:|
| 10 | 78 | 78 |
| 15 | 34 | 34 |
| 22 | 19 | 19 |
| 30 | 10 | 10 |
| 40 | 7 | 7 |

⭐ **Idênticos.** A ponderação muda a nota e ⛔ não muda quem fica em primeiro.

## O que move o número, então

### 1. A quantidade de perguntas

De 10 para 40 perguntas, o empate no topo cai de **78 para 7**. É o fator dominante, e é a
pendência **RQ3**.

### 2. A ESCOLHA das perguntas — e este é o achado prático

Com 22 perguntas fixas, mudando só o critério de seleção:

| Universo de onde as perguntas saem | Votações | Empate mediano |
|---|---:|---:|
| Todas as votações | 1.121 | **22** |
| Só divididas (minoria ≥ 25%) | 590 | **18** |
| Só muito divididas (minoria ≥ 40%) | 76 | **9** |

🔴 **Escolher votações divididas corta o empate pela metade**, com o mesmo número de
perguntas e a mesma métrica.

⚠️ E o critério atual (25%) é conservador demais: exigir 40% dobra a discriminação. O
custo é o pool encolher de 590 para 76 votações, o que aperta a cobertura temática
(RN-06) — a decisão é essa troca, ⛔ não a fórmula.

### 3. O contexto: 14% das votações quase não separam ninguém

Distribuição das 1.122 votações abertas de plenário:

| Divisão (tamanho da minoria) | Votações |
|---|---:|
| Quase unânime (< 5%) | 160 — **14%** |
| 5% a 20% | 234 |
| 20% a 35% | 573 |
| Dividida (≥ 35%) | 155 — 14% |

## Consequência

⛔ **Trocar a métrica é otimizar o que ⛔ não está errado.** A decisão já registrada em
[`plano/07 §4.5`](../plano/07-grafo-e-afinidade.md) — cosseno no grafo, concordância
simples na tela — sobrevive à medição, e o argumento dela era outro: *"você concordou em
17 de 20"* é auditável por qualquer pessoa; *"cosseno 0,84"* ⛔ não.

⭐ **O esforço rende na curadoria**, que é justamente a Pendência 11 — e o critério de seleção
merece subir de 25% para algo entre 35% e 40%.

## Ver também

- [`plano/07 §4.5`](../plano/07-grafo-e-afinidade.md) — a decisão original
- [`metodos.md`](../metodos.md) — o que cada medida significa
- **RQ3** em [`PENDENCIAS`](../PENDENCIAS.md) — o número final de perguntas
