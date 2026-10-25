# Métodos e medidas — o que cada número significa

> **Tipo:** referência · **Atualizado em:** 2026-08-27
>
> ⭐ **Para que este documento existe:** a fundamentação teórica vai citar estes números.
> Cada medida precisa ser uma unidade com nome, intervalo, leitura e valor medido — não
> um número solto no meio de um parágrafo.
>
> 🔴 **Regra:** cada medida tem **um** dono. Outros documentos citam com link, ⛔ nunca
> repetem o valor. Número repetido é número que diverge.

---

## 🔴 Aviso: `r` significa DUAS coisas neste projeto

Antes de qualquer outra coisa, porque é a maior fonte de confusão:

| Onde | O que `r` é | Valor |
|---|---|---|
| [`00-discovery §7.4.1`](00-discovery.md) | **Coeficiente de correlação de Pearson** — mede associação entre duas variáveis | 0,862 |
| [`plano/07 §3.2.2`](plano/07-grafo-e-afinidade.md) e `similaridade.py` | **Razão de decaimento** de um peso exponencial | 0,86 |

⚠️ **Não são a mesma coisa.** A segunda foi *escolhida igual* à primeira, e essa escolha
é uma decisão de modelagem que precisa ser defendida — ver
[§2 · Razão de decaimento](#2-razão-de-decaimento-r--086).

⛔ No código a variável se chama `RAZAO_RECENCIA`, o que é correto. Na documentação virou
`r`, o que colidiu com Pearson.

---

## 1. Coeficiente de correlação de Pearson (`r`)

| | |
|---|---|
| **O que mede** | Quanto duas variáveis andam juntas, em linha reta |
| **Intervalo** | −1 a +1 |
| **Como ler** | 0 = nenhuma associação linear · +1 = sobem juntas perfeitamente · −1 = uma sobe quando a outra desce |
| **Fórmula** | `cov(X,Y) / (σx · σy)` |

⚠️ **Correlação ⛔ não é causa.** E mede só associação **linear**: duas variáveis podem
ter relação forte em curva e dar `r` perto de zero.

### Onde aparece neste projeto

| Medição | `r` | Leitura |
|---|---|---|
| Similaridade de 2023 × similaridade de 2025, em 9.873 pares | **0,862** | ⭐ Forte. Quem votava junto em 2023 continua votando junto em 2025 — a posição é estável **dentro** da legislatura |
| Distância do centro no SVD × nº de votações do deputado | **0,566** | ⚠️ Moderada, e é um **problema**: quem faltou é empurrado para o meio do desenho. Ver [`plano/07 §3.6.1`](plano/07-grafo-e-afinidade.md) |

⛔ **Entre legislaturas, a estabilidade NÃO foi medida.** É o que sustenta a decisão de
usar só a 57ª — e afirmar sem medir seria repetir o erro que o projeto já cometeu.

---

## 2. Razão de decaimento (`r` = 0,86)

| | |
|---|---|
| **O que é** | O fator que reduz o peso de uma votação a cada ano decorrido |
| **Fórmula** | `peso_tempo = 0,86 ^ anos_decorridos` |
| **Efeito** | Votação de 1 ano atrás pesa 86% · de 3 anos, 64% |

⭐ **Por que 0,86 e não 0,5 ou 0,95:** o valor foi igualado ao `r` de Pearson da
estabilidade (0,862). O raciocínio: se a posição se mantém com correlação de 0,86 ao
longo da legislatura, decair nessa taxa traduz a estabilidade observada em vez de inventar
uma.

⚠️ **É uma escolha de modelagem, não uma dedução.** Correlação e razão de decaimento são
grandezas diferentes; igualá-las é defensável e precisa ser **defendido**, não apresentado
como consequência automática.

🔵 **Alternativa registrada:** [`00-discovery §7.4.1`](00-discovery.md) conclui que,
**dentro** de uma legislatura, o ganho de ponderar por recência é pequeno e o custo é
arbitrariedade. A ponderação permaneceu; a alternativa de não ponderar está aberta.

---

## 3. Concordância simples

| | |
|---|---|
| **O que mede** | Fração das votações em comum em que dois votaram igual |
| **Intervalo** | 0 a 1 |
| **Onde vai** | ⭐ Para a **TELA** — é a métrica explicável |

```
                  Σ  w(v) · [ voto_A(v) == voto_B(v) ]
                 v∈C
concordância =  ───────────────────────────────────────
                          Σ  w(v)
                         v∈C
```

⭐ Lê-se direto: *"votaram igual em 82% das votações em que ambos se posicionaram"*.

🔴 **A RF-29 proíbe exibir isso como percentual solto.** Sempre "concordaram em X de Y" —
"82%" esconde que a base foram 5 votações.

---

## 4. Cosseno (reescalado)

| | |
|---|---|
| **O que mede** | O ângulo entre dois vetores de voto |
| **Intervalo cru** | −1 a +1 |
| **Intervalo usado** | **0 a 1**, via `(cos + 1) / 2` |
| **Onde vai** | Para o **GRAFO** |

⚠️ **O reescalonamento não é cosmético.** O banco exige [0, 1] (`ck_sim_valor`); sem a
transformação, **todo par em oposição seria rejeitado pelo `CHECK`** — e o grafo perderia
justamente quem vota ao contrário.

📐 Detalhe em [`plano/07 §3.2.1`](plano/07-grafo-e-afinidade.md).

---

## 5. Índice de Rand ajustado (ARI)

| | |
|---|---|
| **O que mede** | Quanto duas divisões dos mesmos elementos coincidem |
| **Intervalo** | −1 a +1 |
| **Como ler** | 🔴 **0 = coincidência ao acaso** · 1 = partições idênticas · negativo = pior que o acaso |
| **Medido** | **0,277** — comunidade de voto × partido |

🔴 **"Ajustado" é a palavra que importa.** O Rand simples sobe só por haver muitos grupos:
com 25 partidos e 17 comunidades, quase todo par de deputados cai em grupos diferentes nas
duas partições, e isso contaria como concordância. O ajuste desconta o esperado do acaso.

⚠️ Por isso **0 não significa "nenhuma coincidência"** — significa "nada além do que o
acaso já daria".

⛔ Implementado à mão em `comparacao.py`, sem `scikit-learn`: são vinte linhas de
combinatória contra 30 MB de dependência.

---

## 6. Modularidade

| | |
|---|---|
| **O que mede** | Quanto das arestas fica **dentro** dos grupos, descontado o esperado num grafo aleatório de mesmos graus |
| **Intervalo** | ≈ −0,5 a +1 |
| **Como ler** | Alto = a divisão explica a estrutura do grafo |
| **Medido** | **0,558** (comunidade de voto) × **0,288** (partido) |

⭐ **É o que Louvain maximiza** para encontrar as comunidades — por isso o número de
comunidades não é escolhido por nós.

🔴 **ARI e modularidade respondem coisas DIFERENTES, e o TCC precisa das duas:**

- ARI sozinho diz que as partições diferem, ⛔ mas não diz qual é melhor
- Modularidade sozinha mede a qualidade de **uma** partição, ⛔ não compara nada

⭐ Juntas sustentam a afirmação: *as comunidades de voto descrevem a estrutura quase duas
vezes melhor que os partidos, e coincidem com eles apenas em 0,277.*

---

## 7. Divisão da votação

| | |
|---|---|
| **O que mede** | Quão dividida foi uma votação |
| **Fórmula** | `min(sim, não) / (sim + não)` |
| **Intervalo** | 0 a 0,5 |
| **Como ler** | 0 = unânime · 0,5 = meio a meio |

⭐ **É a medida de quanto uma pergunta INFORMA.** Votação em que 95% votaram igual não
separa ninguém: a pessoa responde e o ranking não muda.

**Medido na legislatura 57** (1.121 votações com ≥ 100 posicionados):

| | |
|---|---|
| Divisão média | **0,227** — a Câmara concorda muito |
| Muito divididas (≥ 0,40) | 76 |
| Divididas (≥ 0,25) | 590 |
| Quase unânimes (< 0,05) | 159 |

---

## 8. Variância explicada (SVD)

| | |
|---|---|
| **O que mede** | Quanto de toda a variação do voto uma componente sozinha captura |
| **Intervalo** | 0 a 100% |
| **Medido** | 1ª: **34,6%** · 2ª: **9,6%** · 3ª: 3,0% |

⭐ **A primeira explica 3,6× mais que a segunda.** É afirmação de TCC: o comportamento de
voto da Câmara é **quase unidimensional**.

⚠️ Consequência visual: a figura sai achatada, e isso é a forma verdadeira. O layout de
molas arredonda a nuvem por conta própria — a redondeza é invenção do algoritmo.

📐 Ressalvas em [`plano/07 §3.6.1`](plano/07-grafo-e-afinidade.md).

---

## 9. Parâmetros que NÃO são medidas

Aparecem junto dos números acima e não são estatísticas — são escolhas:

| Parâmetro | Valor | Por quê |
|---|---|---|
| **k** do kNN | 10 | Limiar global não funciona: similaridade média é 0,663 e liga quase todo mundo. Ver [`plano/07 §3.3`](plano/07-grafo-e-afinidade.md) |
| **Mínimo de votações comuns** | 20 | RN-02 — custa 6 de 643 deputados (0,9%). Ver [`plano/07 §3.2.3`](plano/07-grafo-e-afinidade.md) |
| **Piso de respostas** | 60% das perguntas ativas | CT7 — abaixo disso o resultado não significa nada |
| **Semente** | 20260826 | 🔴 Reprodutibilidade. Louvain e o layout são estocásticos |

---

## Onde cada número vive

⚠️ Se um valor desta página divergir do código, **o código está certo e esta página está
velha** — todos foram medidos contra o banco em execução, não estimados.

| Medida | Implementação |
|---|---|
| Concordância, cosseno, peso | `src/etl/poligraph_etl/analise/similaridade.py` |
| ARI, modularidade | `src/etl/poligraph_etl/analise/comparacao.py` |
| Componentes, comunidades, layout | `src/etl/poligraph_etl/analise/grafo.py` |
| Divisão, curva de discriminação | `src/etl/poligraph_etl/analise/validacao.py` |
| Afinidade do cidadão | `src/Poligraph.Api/Services/CalculadoraAfinidade.cs` |
