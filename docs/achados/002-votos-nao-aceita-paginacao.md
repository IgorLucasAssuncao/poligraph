# Achado #2 — o endpoint de votos não aceita paginação

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara
> **Status:** ✅ Vale — mas perdeu relevância prática (ver consequência)
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Se `GET /api/v2/votacoes/{id}/votos` aceita o parâmetro `itens`.

## Resultado

⛔ **HTTP 400.** O endpoint devolve a lista completa de uma vez, sem opção de paginar.

## Consequência

Na prática **deixou de importar**: o [achado #6](006-csv-consolidado-por-ano.md) mostrou
que existem CSVs anuais consolidados, e o ETL passou a usá-los em vez de varrer a API
votação por votação.

⚠️ Continua valendo para quem precisar de **uma** votação específica em tempo real — o
tamanho da resposta não é negociável.

## Onde é citado

- [`10-api-camara.md`](../10-api-camara.md)
