# Achado #3 — o id de votação é string composta, não inteiro

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara
> **Status:** ✅ Vale — está no schema
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

O id de votação tem a forma `"2456731-84"` — **proposição + sequencial**, separados por
hífen. ⛔ Não é inteiro.

## Consequência

`votacao.id` é `TEXT` no schema, ⛔ nunca `BIGINT`. Modelar como número quebraria na
primeira ingestão.

⭐ E o prefixo é aproveitável — ver [achado #9](009-prefixo-do-id-e-a-proposicao.md).

## Onde é citado

- [`plano/04-esqueleto.md`](../plano/04-esqueleto.md) — schema
