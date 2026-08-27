# Achado #21 — a CPMI é votação compartilhada, mas ninguém publica

> **Tipo:** achado medido · **Medido em:** 2026-08-22 · **Fonte:** API da Câmara, órgão 102648
> **Status:** ⏳ **Reverificar antes da conclusão** — pode mudar
>
> ⚠️ Este arquivo é a **fonte canônica** deste achado. Outros documentos devem
> LINKAR, ⛔ nunca repetir o número — número repetido é número que diverge.

---

## Resultado

`CPMI8JAN` existe como órgão (id **102648**), mas retorna **0 votações**.

## Por que importa

🔴 É o **único lugar** onde deputados e senadores votam **o mesmo, juntos**. Se passar a
publicar, a unificação dos dois grafos vira possível e o
[achado #7](007-casas-nao-sao-comparaveis.md) muda.

## ⏳ Como reverificar

```
GET /api/v2/votacoes?idOrgao=102648
```

E `casaSessao` no `/votacao` do Senado.

⚠️ **Está na lista de reverificação antes da conclusão.** Afirmar na defesa algo que
deixou de ser verdade é o pior erro possível num trabalho cuja força é ter medido tudo.

## Onde é citado

- [`REVISAR-ANTES-DA-CONCLUSAO.md`](../REVISAR-ANTES-DA-CONCLUSAO.md)
