# Achado #8 — `uriProposicaoCitada` não aponta para o projeto

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara, votação 2456731-84
> **Status:** ✅ Vale — armadilha ativa
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## O que foi medido

Para onde leva o campo `ultimaApresentacaoProposicao.uriProposicaoCitada`.

## Resultado

⛔ Levava à proposição `2499908`, que é um **PPP — "Parecer Proferido em Plenário"**, com
`ementa` sendo o texto burocrático da leitura do parecer e `keywords: null`.

O projeto real — PL 3469/2024, sobre incêndios florestais — só aparece em
`proposicoesAfetadas`.

## Consequência

🔴 **Quem seguir o link mais óbvio monta um questionário de pareceres.** O caminho certo é
o prefixo do id da votação ([achado #9](009-prefixo-do-id-e-a-proposicao.md)).

## Onde é citado

- [`10-api-camara.md`](../10-api-camara.md)
