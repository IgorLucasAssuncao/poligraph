"""ETL do poligraph — **entrada, tratamento e saída**, nesta ordem e sempre separados.

Este pacote é a *"Arquitetura ETL"* do título do TCC. A separação abaixo ⛔ não é
organização de arquivo: é o que permite dizer, para cada número que aparece na tela, de
qual arquivo ele veio, o que foi feito com ele e em que coluna foi parar.

---

## As três fases, e quem faz cada uma

| Fase | Responsabilidade | Módulos |
|---|---|---|
| **ENTRADA** | Baixar e ler. ⛔ Não interpreta, ⛔ não descarta | `fontes/camara` · `fontes/tse` · a metade `baixar`/`ler` de `cota` e `emendas` |
| **TRATAMENTO** | Normalizar, classificar, descartar o que ⛔ não entra | `normalizacao` · `ingestao` · `para_linhas` de cada fonte |
| **SAÍDA** | Gravar. ⛔ Não decide nada | `persistencia` |

🔴 **Nenhum módulo de ENTRADA toca o banco, e `persistencia` ⛔ não decide o que gravar.**
Quando as três se misturam, um descarte silencioso vira um número plausível e errado —
que é o modo de falha que este projeto persegue.

---

## O contrato de cada fonte

Todo módulo de fonte abre com o mesmo bloco — **Entrada · Tratamento · Saída** — para que
a revisão ⛔ não dependa de ler o código inteiro:

| Fonte | Entrada | Liga por | Saída |
|---|---|---|---|
| `ingestao` | CSVs anuais da Câmara | `id` da Câmara | `votacoes` · `votos` · `pessoas` |
| `cota` | `cotas/Ano-{ano}.csv.zip` | `ideCadastro` | `despesas` |
| `emendas` | `api-de-dados/emendas` 🔑 | **código do autor** | `emendas` · `autores_de_emenda` |
| `receitas` | `prestacao_de_contas_*.zip` | **hash de CPF** | `receitas_de_campanha` |

---

## 🔴 O que vale para todas

| Regra | Por quê |
|---|---|
| **O EF é dono do schema** | O Python ⛔ nunca cria tabela. `test_contrato_schema` trava a divergência de nome de tabela, de coluna e de literal |
| **CPF ⛔ nunca em claro** | RNF-13. O CPF existe só em memória, durante a leitura; o que sai é hash |
| **Descarte é LOGADO** | Linha descartada em silêncio é a origem do número plausível e errado |
| **Zero ⛔ não é sucesso** | Ingestão que grava zero linhas **estoura**, ⛔ não registra `INFO` |
| **Reingestão é idempotente** | A Câmara reconstrói os CSVs toda madrugada, e o Portal corrige valor retroativo |

---

## Nomes

Tudo em português, e **nome curto só onde ele é a notação do assunto**:

| Fica | Onde | Por quê |
|---|---|---|
| `i`, `j` | Índices de matriz | É a notação de álgebra linear; `indice_da_linha` piora a leitura |
| `k` | kNN | É o nome do parâmetro no método |
| `u` | Fator do SVD | É como a decomposição é escrita |
| `a`, `b` | As duas partições do ARI | A função é simétrica: nomeá-las sugeriria papéis que ⛔ não existem |

⛔ **Todo o resto é por extenso** — `registro`, `linha`, `pessoa`, `caractere`, `emenda`,
`coluna`. Uma letra que ⛔ não é notação é significado escondido.

📐 [`docs/README.md`](../../../docs/README.md) · [`docs/achados/`](../../../docs/achados/README.md)
"""
