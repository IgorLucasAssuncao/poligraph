# Achado #11 — a maioria das votações nominais é procedimental

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** 526 votações nominais da Câmara em 2025
> **Status:** ✅ Vale — define duas regras opostas
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

| Categoria | Qtd | % |
|---|---|---|
| **Requerimentos e incidentes** | **307** | 58,4% |
| **Destaques** | 74 | 14,1% |
| **Substantivas** | **145** | 27,6% |

As 145 substantivas cobrem **100 proposições distintas** em 2025.

## 🔴 Duas consequências, e apontam para lados OPOSTOS

**1. Questionário: filtro obrigatório.** Perguntar se o cidadão aprova o "Requerimento de
Retirada de Matéria da Pauta" é inútil.

**2. Matriz de similaridade: ⛔ NÃO filtrar.** Requerimento de urgência é um dos sinais
mais limpos de alinhamento governo × oposição — quem quer pautar e quem quer travar.

⭐ São dois recortes sobre a mesma tabela. `voto` guarda tudo; `votacao.categoria`
distingue.

⚠️ **Divergência aberta:** na implementação `PROCEDIMENTAL` recebe peso **0,0** na
matriz, o que contraria a consequência 2. Ver
[`plano/07 §3.2.2`](../plano/07-grafo-e-afinidade.md).

## Onde é citado

- [`01-camara-dos-deputados.md`](../01-camara-dos-deputados.md)
