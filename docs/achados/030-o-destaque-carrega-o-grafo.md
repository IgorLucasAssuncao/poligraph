# Achado 30 — o destaque carrega o grafo, e o peso dele quase não importa

**Medido em 2026-08-29**, sobre a matriz da Câmara na 57ª legislatura (643 × 1.122).

---

## A pergunta

`PESO_CATEGORIA["DESTAQUE"] = 0.7` está no código desde o início, e ⛔ **nunca foi
medido**. O `0,86` da recência tem origem declarada — a correlação de posição entre anos
(r = 0,862, discovery §7.4.1). O `0,7` ⛔ não tem: é *"mérito, mas de um trecho"*, um
argumento, ⛔ não uma medição.

⚠️ Se ele estivesse errado, o grafo inteiro estaria errado — e ⛔ **não haveria como
saber**, porque um peso ruim ⛔ não produz erro, produz um desenho plausível.

## O que se mediu

Para cada peso, os **10 vizinhos mais próximos** de cada um dos 643 deputados,
comparados contra o peso atual.

| Peso do destaque | Sobreposição média | Deputados com top-10 **idêntico** |
|---:|---:|---:|
| 🔴 **0,0** *(excluir destaques)* | **2,00 de 10 — 20%** | 13 de 643 (2,0%) |
| 0,3 | 8,28 de 10 — 82,8% | 114 (17,7%) |
| 0,5 | 9,18 de 10 — 91,8% | 267 (41,5%) |
| ⭐ **0,7** *(atual)* | — | — |
| 0,9 | 9,40 de 10 — 94,0% | 348 (54,1%) |
| 1,0 | 9,23 de 10 — 92,3% | 278 (43,2%) |

## As duas conclusões, e elas puxam para lados opostos

### ⭐ 1. O valor exato ⛔ não sustenta nada

Qualquer peso entre **0,3 e 1,0** devolve **83% a 94%** da mesma vizinhança. ⛔ O `0,7`
⛔ não é uma escolha delicada — é uma escolha **quase irrelevante**, e trocá-lo por 0,5 ou
por 1,0 ⛔ não mudaria a leitura de nenhuma figura do TCC.

⚠️ **Isto ⛔ não valida o 0,7** — mostra que a pergunta *"qual é o peso certo?"* ⛔ não
tinha resposta a dar. ⭐ Uma constante que ⛔ não muda o resultado ⛔ não precisa de
defesa; precisa de **um teste que registre que ⛔ não precisa**.

### 🔴 2. **Incluir** destaques sustenta tudo

Com peso **zero**, sobram **2 dos 10** vizinhos. **80% da vizinhança de cada deputado
vem dos destaques.**

📐 O motivo está na contagem, ⛔ não na importância:

| Categoria | Na legislatura | 🔴 **Na matriz** (plenário e aberta) |
|---|---:|---:|
| PROCEDIMENTAL | 896 | 558 — ⛔ peso **0,0**, fora |
| **DESTAQUE** | 431 | **422** |
| SUBSTANTIVA | 266 | **141** |
| AUTORIDADE | 1 | 1 |

🔴 **125 das 266 substantivas (47%) ⛔ não são de plenário** — são de comissão, e a
matriz só usa plenário. ⭐ O resultado é que a categoria "mais forte" entra em
**minoria de 3 para 1** contra a que vale 0,7.

## O que isto obriga a dizer no TCC

⚠️ **O grafo de similaridade é construído principalmente sobre disputa de trecho de
texto, ⛔ não sobre mérito de projeto.** ⛔ Não é defeito — o destaque é onde a divergência
real aparece, e votação de mérito costuma ser consensual —, mas ⛔ **não pode ser
omitido**: quem lê "quem vota junto fica junto" imagina projetos, e são emendas
supressivas.

⭐ **⛔ A polaridade ⛔ não contamina isto.** `concordancia_simples` compara os votos
**crus** (`votos_a == votos_b`); se dois deputados votaram "Sim", eles concordaram,
qualquer que seja o significado do "Sim" naquela votação. ⭐ O sinal invertido ⛔ **não
afeta o grafo** — ele afeta apenas o **questionário**, onde a comparação é contra a
resposta de uma pessoa, e é lá que a RN-08 e o teste API3 vivem.

## Consequência prática

| | |
|---|---|
| ⭐ O `0,7` **fica** | ⛔ Não por estar certo: por ⛔ não fazer diferença |
| 🔴 A **exclusão** de destaques ⛔ **nunca** entra sem medir de novo | É a única mudança que reescreveria o grafo |
| ⚠️ O texto do TCC precisa dizer sobre **o que** o grafo é feito | 422 destaques contra 141 substantivas |
