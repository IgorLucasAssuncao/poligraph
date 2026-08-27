# Achado #12 — 🔴 a polaridade de "Sim" não é constante

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** 74 destaques das 526 votações nominais de 2025
> **Status:** 🔴 **O achado mais perigoso do projeto** — vale integralmente
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem LINKAR,
> ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

Nos **74 destaques** (14,1% das votações nominais de 2025), a descrição é
*"Mantido o texto"*.

Votar **Sim mantém o dispositivo** — ou seja, **rejeita** o destaque que queria removê-lo.
O sentido político de "Sim" **se inverte** em relação à intenção de quem apresentou o
destaque.

O mesmo vale para requerimentos de retirada de pauta.

## 🔴 Por que é o achado mais perigoso

⚠️ **Um sinal invertido não aparece na tela.** Aparece como um número plausível e errado:
o ranking de afinidade fica silenciosamente incorreto em ~14% dos casos, e nada acusa.

Não é hipótese — é o tipo de erro que este projeto já cometeu em outras frentes, e o
motivo de a regra 1 do `CLAUDE.md` existir.

## Consequência

Cada votação usada no questionário tem `polaridade` (+1 / −1), atribuída na **curadoria
humana**, mapeando "Sim" para "a favor da medida".

🔴 **Regra do projeto:** nenhuma mudança que toque cálculo de afinidade entra sem o teste
de regressão de polaridade (API3).

⚠️ `inferir_polaridade` no ETL é **auxílio** à curadoria, ⛔ não substituto: ela olha
`"mantido o texto"` e devolve −1. O valor final é decidido por pessoa.

⭐ **Cuidado com a categoria.** A regex que classifica `DESTAQUE` já errou uma vez —
casava com *"ressalvados os destaques"*, que é voto no texto principal. A polaridade
passou ao largo porque olha a frase, não a categoria. Ver
[`plano/07 §3.2.2`](../plano/07-grafo-e-afinidade.md).

## Onde é citado

- [`CLAUDE.md`](../../CLAUDE.md) — regra 1 do projeto
- [`plano/06-perguntas-lote-1.md`](../plano/06-perguntas-lote-1.md)
- [`plano/07-grafo-e-afinidade.md`](../plano/07-grafo-e-afinidade.md)
- [`arq/10-api-e-afinidade.md`](../arq/10-api-e-afinidade.md)
