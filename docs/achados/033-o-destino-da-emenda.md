# Achado 33 — o destino da emenda: três números que inflavam sem erro

**Medido em 2026-09-24 e 2026-09-25**, sobre o download único de emendas do Portal da
Transparência (`emendas-parlamentares/UNICO`, gerado em 24/09/2026), nas emendas de
**2023 a 2026**. ⚠️ 2026 é parcial.

---

## O que mudou na fonte

A ingestão lia a API de dados: ~1.700 requisições de 15 itens, com a chave **pessoal** de
quem a pediu. O download é **público**, é um arquivo só (32 MB) e traz três tabelas:

| Arquivo | Linhas de 2023–26 | O que acrescenta |
|---|---:|---|
| `EmendasParlamentares.csv` | **25.001** (24.946 emendas) | Código do autor em coluna própria, IBGE do município, ação e plano orçamentário |
| `…_PorFavorecido.csv` | **274.240** · R$ 132,82 bi | **Quem recebeu**, mês a mês |
| `…_Convenios.csv` | **17.784** | O **objeto** concreto: convenente, número, valor |

⭐ O código do autor da coluna própria bate com o recortado do código da emenda em
**25.001 de 25.001** linhas. O recorte continua no código como conferência.

## 🔴 Os três números que inflavam — ou sumiam — em silêncio

### 1. A emenda de duas linhas

Uma emenda pode ocupar mais de uma linha, uma por **localidade × ação × plano
orçamentário**. A chave única antiga era `(código do autor, código da emenda)`, com
`ON CONFLICT DO NOTHING`:

| | |
|---|---:|
| Emendas em mais de uma linha | **55** |
| Linhas que o `DO NOTHING` descartaria | **55** |
| Empenhado nessas linhas | **R$ 0,18 bi** |

⭐ Correção: chave `(código, localidade, ação, plano)` com `NULLS NOT DISTINCT`, e **sem**
`ON CONFLICT` — linha repetida agora derruba a carga em vez de sumir.

### 2. O convênio somado uma vez por emenda

O valor no arquivo de convênios é o do **convênio inteiro**, repetido em cada emenda que
o financia. O convênio `1AAQKR`, de R$ 80 mi, aparece em **23 emendas**.

| Convênios de 2023–26 | Total |
|---|---:|
| Somando linha a linha | R$ 24,18 bi |
| ⭐ Contando cada convênio uma vez | **R$ 18,79 bi** |
| 🔴 Diferença | **R$ 5,4 bi que não existem** |

📐 Convenente, objeto, data e valor são **iguais** em todas as linhas de um mesmo número:
o número identifica o convênio. ⭐ Correção: `convenios` é tabela própria, ligada às
emendas por `emendas_convenios`, e a ficha mostra **quantas emendas** financiam cada um.

### 3. O intermediário contado como destino

| Favorecido | 2023–26 |
|---|---:|
| **Banco do Brasil** (CNPJ 00.000.000/0001-91), sempre em Brasília | **R$ 32,57 bi** |
| Caixa Econômica Federal | R$ 0,73 bi |

O Banco do Brasil recebe para repassar. Contá-lo como destino faria o DF parecer o
maior destino de emenda do país. ⭐ Correção: `intermediario = true` pela raiz do CNPJ; a
ficha o mostra **à parte**, com o valor.

⚠️ A Caixa ⛔ foi marcada: sem medir o que é tarifa de operação e o que é repasse,
chamá-la de intermediária seria palpite.

## 🔴 LGPD — quem ⛔ é identificado

| Tipo no arquivo | Linhas de 2023–26 | Tratamento |
|---|---:|---|
| Pessoa Física | 44.166 | CPF **já mascarado** (`***.444.712-**`), nome em claro |
| Inscrição Genérica | 700 | Código que ⛔ é CPF, nome de pessoa |
| PJ "Empresário (Individual)" | 4.087 | Nome da pessoa **dentro da razão social** |
| PJ "Produtor Rural (Pessoa Física)" | 2 | Idem |

⭐ Os quatro viram `PESSOA`, **sem documento e sem nome — nem em hash**: a máscara ⛔
serve de chave, e a ficha só precisa do total. `ck_favorecido_identificacao` impede que
um nome de pessoa chegue ao banco por qualquer caminho.

## O que isto ⛔ mede

⛔ **Relação entre voto e dinheiro.** A ficha mostra os dois fatos lado a lado e
separados. Juntá-los numa métrica seria pergunta de causalidade (emenda individual é
impositiva, emenda de comissão ⛔ tem autor pessoa, pagamento se concentra em dezembro)
e esbarraria na neutralidade (RNF-16).
