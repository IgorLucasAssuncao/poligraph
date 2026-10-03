# Achado #9 — o prefixo do id da votação é o id da proposição

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara, amostra de 30 prefixos distintos
> **Status:** ✅ Vale
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Se o prefixo de `idVotacao` resolve para uma proposição real.

## Resultado

`2456731-84` decompõe em proposição **2456731** + sequencial **84**.

| | |
|---|---|
| Prefixos testados | 30 |
| Resolveram para proposição real | **30 / 30** |
| Tipos encontrados | PL (23), PLP (3), PEC (3), REQ (1) |

## Consequência

⭐ Liga votação → matéria **sem chamada extra à API**, direto do CSV. É a saída para a
armadilha do [achado #8](008-uriproposicaocitada-e-armadilha.md).

⚠️ Mas a proposição em si **não é ingerida** — ver Pendência 40 em
[`PENDENCIAS.md`](../PENDENCIAS.md).

## Onde é citado

- [`10-api-camara.md`](../10-api-camara.md)
