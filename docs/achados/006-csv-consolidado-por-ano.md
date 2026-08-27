# Achado #6 — existem CSVs consolidados por ano

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** dadosabertos.camara.leg.br/arquivos
> **Status:** ✅ Vale — é a base do ETL de ingestão
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

```
https://dadosabertos.camara.leg.br/arquivos/{dataset}/csv/{dataset}-{ano}.csv
```

Datasets confirmados: `votacoes`, `votacoesVotos`, `votacoesObjetos`, `proposicoes`.

⚠️ **`deputados` NÃO segue o padrão** — é um arquivo único, sem ano
([achado #22](022-deputados-nao-e-arquivo-anual.md)).

## Consequência

⭐ **Elimina o N+1** que motivava o risco R4: em vez de varrer a API votação por votação,
o ETL baixa um arquivo por ano.

Medido: 8,7 MB para `votacoes-2025.csv`, 58 MB para `votacoesVotos-2025.csv`.

## Onde é citado

- [`10-api-camara.md`](../10-api-camara.md)
- `src/etl/poligraph_etl/fontes/camara.py`
