# Achado #7 — 🔴 as duas casas não são comparáveis entre si

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** Votações de Câmara e Senado em 2025
> **Status:** 🔴 **Achado estruturante** — define a arquitetura inteira
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Se Câmara e Senado votam as mesmas matérias, permitindo um grafo único.

## Resultado

⛔ **Não votam.** Em 2025:

| | |
|---|---|
| `casaSessao` nas 128 votações do Senado | **`SF` em 100%** — nenhuma sessão do Congresso Nacional |
| `siglaOrgao` nas 526 nominais da Câmara | PLEN 410, CCJC 49, CE 18… — **nenhum `CN`** |

As duas casas votam **matérias diferentes, em sessões separadas**.

## 🔴 Consequência estruturante

⛔ **Não existe grafo único Câmara + Senado.** São dois grafos, e comparar um deputado com
um senador não tem base comum — a RN-02 exigiria votações compartilhadas que não existem.

⭐ O produto contorna isso pelo desenho da §3.4.1 dos requisitos: **fluxo único de
perguntas das duas casas, embaralhadas**, e o resultado separa internamente em duas
listas. O cidadão nunca escolhe entre Câmara e Senado (RNF-28).

⚠️ [Achado #21](021-cpmi-nao-publica-votacao.md) registra a única exceção possível — e ela
não publica dado.

## Onde é citado

- [`02-senado-federal.md`](../02-senado-federal.md)
- [`03-requisitos.md`](../03-requisitos.md) — RNF-28
- [`13-correlacao-entre-fontes.md`](../13-correlacao-entre-fontes.md)
- [`plano/07-grafo-e-afinidade.md`](../plano/07-grafo-e-afinidade.md)
