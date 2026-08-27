# Achado #22 — o arquivo de deputados não é anual

> **Tipo:** achado medido · **Medido em:** 2026-08-26 · **Fonte:** Primeira ingestão real contra a Câmara
> **Status:** ✅ Vale — ⭐ **achado da implementação, não do discovery**
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Se `deputados` segue o mesmo padrão anual dos outros datasets
([achado #6](006-csv-consolidado-por-ano.md)).

## Resultado

⛔ **Não segue.**

| URL | |
|---|---|
| `deputados/csv/deputados-2025.csv` | **404** |
| `deputados/csv/deputados.csv` | **200** |

É **um arquivo só**, com todos os deputados de todas as legislaturas.

## ⚠️ E ele não tem coluna `id`

O id está no último segmento da coluna `uri`:

```
https://dadosabertos.camara.leg.br/api/v2/deputados/220593  →  220593
```

🔴 Ler `r.get("id")` devolvia vazio para toda linha. O laço pulava todas, e o ETL
registrava **em INFO**, sem erro:

```
0 deputados no arquivo, 0 novos
...
0 votos
```

Sem o de-para, os 13.825 registros de 2025 lidos corretamente foram **todos
descartados**. Dois zeros plausíveis e nenhuma exceção.

## Consequência

⭐ Além da correção, **o zero virou erro**: nenhum deputado lido levanta exceção com a
hipótese junto (*"o layout do CSV mudou?"*), e voto descartado por falta de de-para sai
como WARNING com a contagem.

⚠️ **A lição vale mais que o bug:** era o silêncio que o escondia, não a leitura.

## Onde é citado

- `src/etl/poligraph_etl/fontes/camara.py`
- `src/etl/tests/test_ingestao.py`
