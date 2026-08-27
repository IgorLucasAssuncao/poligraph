# Achado #23 — no TSE, o consolidado é o único arquivo com o Distrito Federal

> **Tipo:** achado medido · **Medido em:** 2026-08-27 · **Fonte:** `prestacao_de_contas_eleitorais_candidatos_2022.zip`
> **Status:** ✅ Vale — ⭐ **achado da implementação:** apareceu ao rodar a ingestão real,
> ⛔ não no discovery
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Quais arquivos de `receitas_candidatos_2022_*` ler para não perder nem duplicar nada.

## O pressuposto que estava errado — nos dois pontos

A primeira versão do módulo lia os arquivos **estaduais** e pulava o `_BRASIL`, com este
comentário no código:

> *"O arquivo `_BRASIL` é o consolidado de 1,3 GB. Ler os 27 estaduais dá o mesmo conteúdo
> com uma fração da memória — e ler os dois duplicaria tudo."*

**Duas afirmações, ambas falsas.**

## Resultado

| Medido no ZIP real de 2022 | |
|---|---|
| Arquivos com o prefixo `receitas_candidatos_2022_` | **27** |
| ⚠️ Mas um deles é o `_BRASIL` — logo, **estaduais** | **26** |
| UFs no `_BRASIL` (cargo Deputado Federal) | **27** |
| 🔴 UF **sem arquivo próprio** | **DF** — 3.075 linhas |
| `_BRASIL` / SP × arquivo `_SP` (Deputado Federal) | **17.609 × 17.609** |
| Tamanho do `_BRASIL` descompactado | **432 MB** — ⛔ não 1,3 GB |
| Linhas de Deputado Federal no `_BRASIL` | **103.703** |

### 1. Não são 27 estaduais — são 26

O Distrito Federal **⛔ não tem arquivo próprio**. Ele existe apenas dentro do
consolidado. O DF elege **8 deputados federais**.

### 2. O consolidado duplica os estaduais exatamente

`_BRASIL` filtrado por `SG_UF = SP` traz as **mesmas 17.609** linhas do arquivo `_SP`.
⛔ Não é um recorte diferente nem um agregado: é repetição literal.

> 🔴 Logo, as duas leituras "óbvias" estão erradas: **só os estaduais** perde o DF, e
> **os dois** dobra todo o resto.

## Impacto medido no projeto

Ingerindo os 26 estaduais × ingerindo só o consolidado:

| | 26 estaduais | Consolidado |
|---|---:|---:|
| Receitas gravadas | 21.828 | **22.511** |
| Parlamentares alcançados | 632 | **642** |
| Total arrecadado | R$ 1.146,2 mi | **R$ 1.163,4 mi** |
| Fundo Especial (FEFC) | R$ 893,6 mi | **R$ 907,7 mi** |

⚠️ **R$ 17,2 milhões e 10 parlamentares desapareciam em silêncio.** Nenhuma exceção,
nenhum log de aviso — o ETL terminava com `Concluído` e um total plausível.

## Por que ninguém perceberia

O sintoma seria **a ficha de 10 deputados do DF mostrando "nenhuma receita de campanha
registrada"** — que é exatamente o mesmo texto que o estado vazio legítimo usa para o
suplente que não foi candidato. ⛔ Indistinguível a olho.

⭐ O que denunciou foi o **canário de casamento**: o comando avisa quando menos da metade
das pessoas com CPF casa. Ele não disparou (632 de 643 é 98%), mas o log imprimia
`26 arquivos estaduais` — e o Brasil tem 27 UFs. **A conta que não fechava era a do log**,
⛔ não a do dado.

> 🔴 **A lição:** um canário sobre o RESULTADO (quantos casaram) ⛔ não pega perda
> proporcionalmente pequena. O que pegou foi um número **estrutural** — quantas UFs — que
> tem valor esperado conhecido e independente do dado.

## O que o código faz hoje

**Quando o consolidado existe, ele é o único lido.** Os estaduais ficam como plano B, para
o ano em que o TSE não publicar o consolidado — e nesse caminho o DF fica de fora, o que
está escrito no módulo e coberto por teste.

📐 [`receitas.py`](../../src/etl/poligraph_etl/receitas.py) · testes em
[`test_receitas.py`](../../src/etl/tests/test_receitas.py).

## Ver também

- [Achado #5](005-tse-bloqueia-acesso-automatizado.md) — o WAF do TSE, e o `HEAD` que mente
- [`14-fontes-de-gasto §3`](../14-fontes-de-gasto.md) — o levantamento do fundão
