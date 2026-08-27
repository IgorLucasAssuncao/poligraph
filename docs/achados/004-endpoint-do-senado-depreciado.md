# Achado #4 — o endpoint de plenário do Senado está depreciado

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** legis.senado.leg.br/dadosabertos
> **Status:** ✅ Resolvido — já migrado
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

`GET /dadosabertos/plenario/lista/votacao/{data}` responde 200, mas está marcado como
**depreciado** no bloco `Metadados.Descontinuacao`.

## Consequência

⭐ Migrado para `/dadosabertos/votacao?dataInicio=&dataFim=`, que devolve array plano com
voto por parlamentar.

⚠️ A RNF-11 pede **registrar em log** o bloco `Descontinuacao` — para o próximo endpoint
não morrer em silêncio.

## Onde é citado

- [`11-api-senado.md`](../11-api-senado.md)
