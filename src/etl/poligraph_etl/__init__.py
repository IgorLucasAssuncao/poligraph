"""ETL do poligraph — **entrada, tratamento e saída**, nesta ordem e sempre separados.

Este pacote é a *"Arquitetura ETL"* do título do TCC. A separação abaixo ⛔ não é
organização de arquivo: é o que permite dizer, para cada número que aparece na tela, de
qual arquivo ele veio, o que foi feito com ele e em que coluna foi parar.

---

## As três fases, e quem faz cada uma

| Fase | Responsabilidade | Módulos |
|---|---|---|
| **ENTRADA** | Baixar e ler. ⛔ Não interpreta, ⛔ não descarta | `fontes/camara` · `fontes/tse` · o `baixar`/`ler` de `cota` e `emendas` |
| **TRATAMENTO** | Normalizar, classificar, descartar o que ⛔ não entra | `normalizacao` · `ingestao` · o `para_linhas` de cada fonte |
| **SAÍDA** | Gravar. ⛔ Não decide nada | `persistencia` |
| **ANÁLISE** | Ler do banco, calcular, gravar de volta | `similaridade` · `grafo` · `comparacao` · `validacao` |

🔴 **Nenhum módulo de ENTRADA toca o banco, e `persistencia` ⛔ não decide o que gravar.**
Quando as três primeiras se misturam, um descarte silencioso vira um número plausível e
errado — que é o modo de falha que este projeto persegue.

⭐ **A ANÁLISE é uma fase à parte, e o contrato dela é outro:** a entrada ⛔ não é arquivo,
são tabelas já tratadas; a saída é sempre atrelada a uma `execucao`, que é o que torna
cada retrato do grafo reproduzível. `validacao` é a exceção — ⛔ **não grava nada**, só
mede.

---

## 🔴 A ordem de execução

```
ingerir                       pessoas, votacoes, votos — TUDO depende dele
│
├── analisar                  similaridade, comunidades, grafo
│   └── validar               ⭐ só mede, ⛔ não grava
│
├── cota                      🔴 BARRA sem `ingerir`
│
├── emendas                   🔑 exige chave do Portal
│   └── emendas --resolver    reconciliação manual dos ambíguos
│
└── cpf                       🔴 grava o HASH, nunca o CPF
    └── fundo                 🔴 BARRA sem `cpf`
```

⚠️ **Duas dependências são DURAS — o comando estoura com mensagem dizendo o que rodar
antes.** As outras degradam, e é aí que mora o perigo:

| Comando | Sem o pré-requisito |
|---|---|
| 🔴 `cota` | **Estoura**: *"De-para de pessoas vazio. Rode `ingerir` antes"* |
| 🔴 `fundo` | **Estoura**: *"Nenhuma pessoa com `cpf_hash`. Rode `cpf` antes"* |
| `analisar` | ⚠️ Avisa *"menos de duas pessoas com voto"* e sai — ⛔ não estoura |
| `emendas` | ⚠️ Ingere normalmente e **resolve zero autores**, calado |
| `validar` | ⚠️ Avisa *"nenhuma execução concluída — rode `analisar` antes"* |

🔴 **Os dois `raise` existem porque o silêncio custa caro:** sem eles, `fundo` leria
**396 MB**, descartaria **toda** linha por não achar dono, e terminaria com log de
sucesso. Foi esse formato de falha que já custou uma ingestão inteira neste projeto.

⭐ **`ingerir` também estoura ao ler zero deputados** — e ⛔ não é excesso de zelo: quando
o `id` mudou de lugar no CSV, o ETL registrou `0 deputados` e `0 votos` em `INFO` e
seguiu. Dois zeros plausíveis, nenhuma exceção.

---

## O contrato de cada fonte

Todo módulo de fonte abre com o mesmo bloco — **Entrada · Tratamento · Saída** — para que
a revisão ⛔ não dependa de ler o código inteiro:

| Fonte | Entrada | Liga por | Saída |
|---|---|---|---|
| 🔴 `ingestao` | CSVs anuais da Câmara | `id` da Câmara, extraído da `uri` | `votacoes` · `votos` · `pessoas` |
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
