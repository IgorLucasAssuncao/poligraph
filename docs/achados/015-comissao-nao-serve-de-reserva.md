# Achado #15 — as votações de comissão NÃO servem como reserva

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** 526 votações nominais da Câmara em 2025
> **Status:** ✅ Vale — ⚠️ **corrige afirmação anterior do próprio discovery**
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## ⚠️ Este achado corrige o documento que o contém

A v0.2 do discovery dizia que "sobram ~116 votações de comissão como reserva" para
engordar a matriz. **A medição desmente.**

## Resultado

| | Votações | Votos por votação (mediana) | Mín–Máx |
|---|---|---|---|
| **Plenário** | 410 | **405** | 127–494 |
| **Comissões** | 116 | **29** | 10–66 |

Uma votação de comissão registra ~29 votos, não 400 — só os membros daquela comissão
votam. Ao todo, 345 dos 552 deputados aparecem em ao menos uma.

⭐ **O voto é real e legítimo.** O problema é misturá-lo na mesma matriz: comissão é
**3× mais consensual** que plenário (39% vs 12% de quase unanimidade), e misturar
achataria a similaridade.

## Consequência

🔴 A matriz filtra `plenario = true`. Ver
[`plano/07 §3.2.4`](../plano/07-grafo-e-afinidade.md).

## Onde é citado

- [`01-camara-dos-deputados.md`](../01-camara-dos-deputados.md)
