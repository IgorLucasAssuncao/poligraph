# Achado #1 — a maioria das votações não tem voto nominal

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara, amostra de 40 votações (mar–abr/2025)
> **Status:** ✅ Vale — é a base de todo o dimensionamento do projeto
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Quantas votações da Câmara registram o voto **individual** de cada deputado.

## Como

`GET /api/v2/votacoes/{id}/votos` sobre 40 votações de março e abril de 2025.

## Resultado

| | |
|---|---|
| Votações da amostra | 40 |
| Com voto nominal | **~5** |
| Votos por votação nominal | 350–400 |

Para as demais, o endpoint devolve `{"dados": []}` — a votação foi **simbólica**, e não
há registro de quem votou o quê.

## Consequência

🔴 **O volume útil é muito menor do que a lista de votações sugere.** Todo dimensionamento
do projeto — tamanho do questionário, densidade da matriz, viabilidade do grafo — parte
deste número, não do total de votações.

O ETL filtra na ingestão: `votacoes_para_linhas` descarta o que tem `votosSim + votosNao
+ votosOutros == 0`.

## Onde é citado

- [`01-camara-dos-deputados.md`](../01-camara-dos-deputados.md)
- [`00-discovery.md §4.1`](../00-discovery.md)
