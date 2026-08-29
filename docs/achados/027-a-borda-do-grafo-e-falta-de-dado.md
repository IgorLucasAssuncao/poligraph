# Achado 27 — a borda do grafo é falta de dado, e o centro é a maioria

**Medido em 2026-08-28**, sobre os 643 deputados da 57ª legislatura, com `governismo`
disponível pela primeira vez.

---

## As duas leituras erradas que a figura convida a fazer

Um grafo político desenhado convida a duas conclusões automáticas, e **as duas são
falsas nesta figura**:

| A intuição diz | O dado diz |
|---|---|
| Quem está na **borda** é radical | Quem está na borda **não tem ligação nenhuma** |
| Quem está no **centro** é moderado | Quem está no centro é o deputado **típico**, que é governista |

Nenhuma das duas é opinião: as duas foram medidas.

---

## A borda

Os 10 nós com `|eixo_x| ≥ 0,6`:

| Deputado | eixo x | Votações | **Ligações** |
|---|---:|---:|---:|
| Gorete Pereira | +1,00 | 29 | **0** |
| Cristiano Furlan | −0,98 | 22 | **0** |
| Glaycon Franco | −0,96 | 31 | **0** |
| Marcelo Calero | −0,95 | 24 | **0** |
| José Carlos Araujo | −0,92 | 10 | **0** |
| Valdir Trindade | −0,88 | 14 | **0** |
| Nivaldo Albuquerque | −0,87 | 6 | **0** |
| Ivan Junior | −0,81 | 25 | **0** |
| Paulo Soares | +0,76 | 13 | **0** |
| Soldado Noelio | +0,69 | 40 | **0** |

**Todos com zero ligações.** ⛔ Não há um único caso de nó conectado na borda.

| | Isolados (12) | Conectados (631) |
|---|---:|---:|
| Distância média do centro | **0,79** | 0,18 |
| Votações em média | **20** | 707 |

### Por que acontece

O layout de molas posiciona por **atração das ligações**. Quem ⛔ não tem ligação ⛔ não
recebe atração nenhuma, e sobra só a repulsão de todos contra todos — que empurra para
fora.

E ⛔ não têm ligação porque ⛔ não alcançam o mínimo de 20 votações em comum com ninguém
(RN-02). Com 6, 10 ou 14 votações no mandato inteiro, ⛔ não há base para dizer com quem
a pessoa se parece.

⭐ **A posição extrema deles ⛔ não é medida de nada. É o algoritmo dizendo que ⛔ não sabe
onde colocá-los.**

### ⛔ Por que eles ⛔ não são removidos da figura

Removê-los apagaria do desenho pessoas que exerceram mandato. Mantê-los isolados na borda
é a representação honesta de que ⛔ não há base para dizer com quem elas se parecem — e é
verificável na tela, porque nenhuma linha sai delas.

---

## O centro

| Faixa do eixo | Deputados | Governismo mediano | Votações medianas |
|---|---:|---:|---:|
| −0,6 a −0,2 | 127 | **97,3%** | 907 |
| **−0,2 a +0,2** | **357** | **81,3%** | 771 |
| +0,2 a +0,6 | 149 | **28,5%** | 849 |

Dos **80 mais centrais**, apenas **11** têm governismo ambíguo (entre 35% e 75%). Os
outros 69 são claramente de um lado.

| | |
|---|---:|
| Governismo mediano dos 80 mais centrais | **81,8%** |
| Governismo mediano dos 643 | **80,7%** |

São o mesmo número. **O centro geométrico é indistinguível do deputado típico.**

### Por que acontece

A nuvem ⛔ **não é simétrica em conteúdo**. 462 dos 643 têm governismo acima de 60%. Com a
maior parte da massa de um lado, o miolo geométrico cai **dentro** do bloco maior, ⛔ não
entre os dois blocos.

⭐ O bloco realmente coeso está **fora** do centro: os 127 da faixa `−0,6 a −0,2`, com
97,3% de governismo e desvio de poucos pontos.

---

## 🔴 A afirmação que a interface fazia, e estava errada

A explicação do layout dizia:

> *"o centro não é moderação — quem faltou a muitas votações também cai ali"*

A conclusão estava certa, **a razão estava errada**. Quem faltou cai na **borda** (20
votações em média), ⛔ não no centro (771). O motivo real de o centro ⛔ não ser moderação
é outro e mais forte: **o centro está dentro do bloco majoritário**.

⚠️ Uma explicação certa pelo motivo errado sobrevive até alguém verificar — e aí derruba
a confiança em tudo o mais que a tela afirma.

O texto foi corrigido, e a legenda agora **calcula** as faixas em vez de descrevê-las por
escrito.

---

## Consequência para a leitura da figura

Ao olhar o desenho, a ordem correta de leitura é:

1. **Ignore as pontas.** São dez pessoas sem dado suficiente, ⛔ não dez radicais.
2. **O meio ⛔ não é o meio-termo.** É onde está a maioria.
3. **O bloco mais coeso está entre o centro e a borda**, ⛔ não na borda.
