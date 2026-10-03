# Achado 26 — a comunidade não é o partido nem o bloco governista

**Medido em 2026-08-28**, sobre os 643 deputados da 57ª legislatura, depois de ingerir
`votacoesOrientacoes` e preencher `nos_metrica.governismo`.

---

## O que se procurava

A RQ2 pergunta se o voto agrupa como o partido agrupa. A resposta medida era ARI 0,272 e
modularidade 0,562 (comunidade) contra 0,287 (partido) — ou seja, **o partido explica
pouco**, e a comunidade detectada pelo voto é uma partição melhor da rede.

Ficava em aberto a explicação alternativa mais óbvia no Brasil: se não é partido, é
**governo contra oposição**? Sem orientação de bancada não havia como perguntar.

## O rótulo, e por que ele vem do dado

`governismo` é a proporção de vezes em que o deputado votou como a bancada **Governo**
orientou, sobre as votações em que os dois se posicionaram. O rótulo binário é
`governismo > 0,5`.

⭐ **Ele é derivado, ⛔ não uma lista de partidos que alguém escreveu.** Classificar
partido como governista seria decisão editorial nossa, e é exatamente o que a RNF-16
proíbe.

## Os números

| | ARI |
|---|---:|
| Comunidade × **partido** | **0,272** |
| Comunidade × **bloco governo/oposição** | **0,268** |
| **Partido × bloco** | **0,058** |

| Variação do governismo explicada por | |
|---|---:|
| Comunidade do voto | **87,5%** |
| Partido | **66,7%** |

## A leitura

**As duas explicações empatam, e são quase independentes entre si.** A comunidade
corresponde ao partido tão bem quanto corresponde ao bloco governista (0,272 contra
0,268) — mas partido e bloco quase não se correspondem (0,058). Um partido está dos dois
lados; um lado tem muitos partidos.

Isso derruba a hipótese simples. A comunidade detectada pelo voto **não é** o partido com
outro nome, e **também não é** governo contra oposição com outro nome. Ela é uma partição
que nenhum dos dois rótulos disponíveis reproduz sozinho.

⭐ E ela **prevê o governismo melhor que o partido**: 87,5% contra 66,7% da variação. Ou
seja, saber em que comunidade o deputado caiu diz mais sobre como ele vota em relação ao
Governo do que saber a sigla dele.

## A distribuição, que sustenta o rótulo binário

| | |
|---|---:|
| Mediana do governismo | 80,7% |
| Abaixo de 40% | 128 deputados |
| Entre 40% e 60% | **53** |
| Acima de 60% | 462 |

O vale no meio é o que torna o corte em 0,5 defensável: só 8% dos deputados ficam na
faixa ambígua. ⛔ Não é um corte arbitrário sobre uma distribuição contínua.

## Governismo médio por comunidade

| Grupo | Nós | Governismo médio | Desvio |
|---:|---:|---:|---:|
| 3 | 111 | 96,4% | 3,9% |
| 5 | 18 | 86,9% | 3,4% |
| 4 | 110 | 83,9% | 9,0% |
| 1 | 224 | 78,6% | 9,0% |
| 2 | 168 | **33,3%** | 11,4% |

Um grupo de oposição bem definido (2), um núcleo governista quase unânime (3, com desvio
de 3,9 pontos) e três faixas intermediárias que o rótulo binário achata.

## Consequências

- A resposta da RQ2 ganha um segundo eixo. Antes era "o voto não agrupa como o partido";
  agora é "e também não agrupa como governo contra oposição — os dois explicam o mesmo
  tanto, e explicam coisas diferentes".
- ⚠️ 384 dos 643 têm `disciplina` medida. Os demais não têm porque o partido registrado
  no voto ⛔ não aparece como bancada que orienta — são as siglas que orientam por bloco,
  não por sigla própria.
- ⛔ **Nada disso existe para o Senado**, que não publica orientação de bancada. As duas
  colunas ficam nulas lá, de propósito.

---

## 🔴 O eixo horizontal do desenho tinha nome, e ninguém sabia

A interface nunca conseguiu dizer o que o eixo horizontal significa. O layout de molas
declarava que *"os eixos não significam nada"*; o de componentes dizia apenas *"a direção
em que os parlamentares mais se diferenciam"*. Com `governismo` medido, deu para
perguntar contra o quê aquele eixo se correlaciona:

| Eixo do desenho | × governismo (Spearman) | × governismo (Pearson) |
|---|---:|---:|
| **Componente 1 (SVD)** | **−0,870** | **−0,903** |
| **Molas — horizontal** | **−0,889** | −0,830 |
| Componente 2 | +0,187 | +0,027 |
| Molas — vertical | −0,130 | −0,149 |

O gradiente, por faixa do eixo horizontal de molas:

| Faixa | Nós | Governismo médio |
|---:|---:|---:|
| 2 | 70 | 94,9% |
| 3 | 261 | 86,6% |
| 4 | 227 | 60,2% |
| 5 | 75 | 25,2% |

⚠️ As faixas 1, 6 e 7 têm 7, 2 e 1 nó — são os isolados, e o número ali é ruído.

### Por que isto vale como validação, e até onde

⭐ **O layout de molas nunca viu orientação de bancada.** Ele posiciona por similaridade
de voto entre pares, passando por kNN e Fruchterman-Reingold, e nenhuma dessas etapas
sabe o que o Governo pediu. Ainda assim o eixo que ele produziu reproduz o alinhamento
governista a −0,889.

⚠️ **⛔ Não é evidência independente, e afirmar isso seria exagero.** As duas medidas
saem do mesmo voto bruto. O que a correlação mostra é que **construções independentes
sobre o mesmo dado convergem** — a similaridade entre pares e o alinhamento com uma
orientação externa chegam ao mesmo eixo por caminhos que não se falam.

### O que a tela passou a dizer, e o que ⛔ não pode dizer

O eixo agora é nomeado, com duas ressalvas obrigatórias:

1. 🔴 **⛔ Não é esquerda e direita.** É alinhamento com **este** governo. Um deputado
   troca de lado na eleição seguinte sem mudar uma posição sequer.
2. O centro continua ⛔ não sendo moderação — quem faltou a muitas votações cai ali.

⛔ **A cor do nó continua sendo comunidade, e ⛔ não governismo.** Colorir por alinhamento
daria ao desenho uma segunda leitura de cor, e a única regra que a figura tem é a
RNF-16: cor é rótulo de grupo, ⛔ nunca escala política.

### Consequência para a Pendência 43

A pendência era manter os dois layouts ou só molas. Os dois eixos horizontais medem a
mesma coisa (−0,87 e −0,89), então **⛔ não se contradizem** — a escolha deixa de ser
sobre qual está certo e passa a ser sobre qual explica melhor.
