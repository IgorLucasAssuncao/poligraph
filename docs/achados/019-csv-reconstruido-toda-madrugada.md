# Achado #19 — a Câmara reconstrói os CSVs todas as madrugadas

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** dadosabertos.camara.leg.br
> **Status:** ✅ Vale
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

Os arquivos anuais são **reconstruídos toda madrugada** — inclusive os de anos já
fechados.

## Consequência

⛔ **Não dá para supor que o arquivo de 2023 nunca muda.** A Câmara corrige dado
retroativamente.

⭐ Por isso a ingestão usa `ON CONFLICT (id) DO UPDATE` em vez de `DO NOTHING`: reingerir
um ano fechado **atualiza** o que mudou.

## Onde é citado

- [`04-contratos.md`](../04-contratos.md)
- [`REVISAR-ANTES-DA-CONCLUSAO.md`](../REVISAR-ANTES-DA-CONCLUSAO.md)
