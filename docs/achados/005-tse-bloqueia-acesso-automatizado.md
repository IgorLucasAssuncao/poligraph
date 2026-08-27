# Achado #5 — o TSE bloqueia acesso automatizado

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** Portal e CDN do TSE, via curl
> **Status:** ⚠️ **REVISADO em 2026-08-23** — o TSE É automatizável; ver [`12-fonte-tse §2`](../12-fonte-tse.md)
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Se dá para baixar os arquivos de candidatura do TSE por script.

## Resultado original (2026-08-22)

⛔ **HTTP 403**, tanto no portal quanto no CDN, inclusive com User-Agent de navegador.

## ⚠️ Revisão (2026-08-23)

A medição posterior, registrada em [`12-fonte-tse §2`](../12-fonte-tse.md), mostrou que
**o TSE é automatizável**. O bloqueio original tinha outra causa.

🔴 **Este achado permanece registrado como exemplo do próprio método:** afirmar a partir
de uma medição isolada e generalizar foi a origem de quase todos os erros deste projeto.
O plano B — carga manual versionada — ficou registrado e não foi necessário.

## Onde é citado

- [`12-fonte-tse.md`](../12-fonte-tse.md)
- [`00-discovery.md §4.3`](../00-discovery.md)
