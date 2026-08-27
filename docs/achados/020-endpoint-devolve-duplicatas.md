# Achado #20 — o endpoint de deputados devolve linhas duplicadas

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara
> **Status:** ✅ Vale
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

O CSV de deputados **repete a mesma pessoa por partido** — e ⛔ **não é histórico**: são
linhas duplicadas do mesmo estado.

## Consequência

A ingestão deduplica por `id_externo` antes de gravar. Sem isso, `pessoa_fonte_ids`
violaria a chave primária.

## Onde é citado

- [`10-api-camara.md`](../10-api-camara.md)
- [`04-contratos.md`](../04-contratos.md)
