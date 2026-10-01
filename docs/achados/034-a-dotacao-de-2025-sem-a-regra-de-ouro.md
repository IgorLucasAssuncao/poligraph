# Achado 34 — a dotação de 2025 publicada sem a regra de ouro

**Medido em 2026-09-25**, sobre `orcamento-despesa/{ano}` do Portal da Transparência
(arquivos gerados em 22/09/2026), anos **2023 a 2026**. ⚠️ 2026 é parcial.

---

## A anomalia

Empenhar além da dotação é ilegal. O arquivo de 2025 mostra isso em quase todas as áreas.

Comparado **onde a dotação é autorizada** — a programação da unidade orçamentária
(unidade × função × subfunção × programa × ação) —, e ⛔ linha a linha, onde a dotação
está no elemento `00` e o empenho em outro:

| Ano | Empenhado além da dotação publicada | Sobre o empenhado |
|---|---:|---:|
| 2023 | R$ 0,1 bi | 0,002% |
| 2024 | R$ 1,4 bi | 0,03% |
| 🔴 **2025** | **R$ 228,6 bi** | **4,2%** |
| 2026 *(até 22/09)* | R$ 0,2 bi | — |

📐 Benefícios previdenciários (ação 00SJ): em 2023 e 2024 o empenhado é **igual** à
dotação, como se espera de despesa obrigatória. Em 2025: dotação R$ 981,3 bi, empenhado
**R$ 1.110,9 bi**.

## A causa

A lei orçamentária de 2025 deixou **R$ 228,5 bi condicionados à "regra de ouro"**
(benefícios previdenciários, Bolsa Família, sentenças judiciais, aposentadorias civis),
liberados depois pelo Congresso por crédito suplementar — o PLN 14/2025 foi um deles.

⭐ **R$ 228,5 bi condicionados contra R$ 228,6 bi medidos.** O arquivo publica a dotação
**sem** a parcela condicionada, e o empenho a usou depois de liberada.

⚠️ O mecanismo exato — em que campo do SIAFI a parcela condicionada fica — ⛔ foi
verificado. O que se afirma é a coincidência de valor, que é forte, e o padrão por ação.

Fontes: [Câmara — "Cresce valor das despesas que extrapolam a regra de ouro"](https://www.camara.leg.br/noticias/1302913-cresce-valor-das-despesas-que-extrapolam-a-regra-de-ouro-orcamentaria)
· [Câmara — "Congresso aprova crédito de R$ 34,3 bilhões para pagamento de benefícios"](https://www.camara.leg.br/noticias/1227624-congresso-aprova-credito-de-r-343-bilhoes-para-pagamento-de-beneficios/)

## O segundo achado, na mesma varredura: o arquivo é do Executivo

| Função | Dotação 2025 |
|---|---:|
| Legislativa | ~R$ 0 |
| Judiciária | R$ 0,1 bi |

O arquivo cobre **36 órgãos superiores do Poder Executivo**. Legislativo, Judiciário e
Ministério Público aparecem só em linhas residuais. ⛔ É "o orçamento federal": é o do
Executivo federal, e a página diz isso.

## 🔴 O que mudou na tela

- `orcamento_por_funcao.empenhado_acima_da_dotacao` é gravado ao lado dos totais
- A função com excesso acima de **0,5% da dotação** tem `dotacaoCompleta = false`, e a
  coluna "pago da dotação" fica **em branco**, com o motivo — ⛔ um "104%" plausível e
  falso

| Ano | Funções marcadas |
|---|---|
| 2023 | Legislativa (residual), Comércio e Serviços (2,0%) |
| 2024 | Judiciária (residual), Defesa (1,1%), Relações Exteriores (5,3%) |
| 🔴 2025 | **23 de 28** |
| 2026 | Legislativa e Judiciária (residuais) |

⚠️ As marcas de 2023 e 2024 fora das residuais ⛔ foram investigadas. A regra as trata
como a de 2025: o dado ⛔ sustenta o percentual, então ele ⛔ aparece.

---

## Adendo (mesmo dia) — o "pago" do arquivo ⛔ é o que saiu no ano

A pergunta que expôs isto: *"parece que está faltando dinheiro"*. ⛔ Faltava na carga —
os 12 arquivos mensais de execução de 2025 somam **R$ 5.444,0 bi** empenhados e
**R$ 5.147,8 bi** pagos, exatamente o arquivo anual. Faltava na **definição**:

| O que ⛔ estava na página | 2025 |
|---|---:|
| Restos a pagar pagos — despesa de anos anteriores paga no ano | **R$ 234,6 bi** |
| Urbanismo: pago do exercício · de anos anteriores | R$ 2,0 bi · **R$ 6,5 bi** |

⭐ A página passou a somar os dois, com a parte de anos anteriores em textura própria.

## E o que parecia gasto e ⛔ é

"Encargos especiais" (R$ 2,9 tri pagos em 2025) se divide pela subfunção:

| Grupo | Subfunções | Pago em 2025 |
|---|---|---:|
| Rolagem — dívida paga com dívida nova | 841, 842 | R$ 1.412 bi |
| Juros e amortização | 843, 844 | R$ 607 bi |
| Transferências a estados e municípios | 845, 847 | R$ 588 bi |
| Outros encargos | 846 | R$ 230 bi |

⚠️ Do lado da receita, o espelho: **R$ 2.464 bi de operações de crédito** — títulos
emitidos —, quase o mesmo que a arrecadação de receitas correntes (R$ 2.878 bi). A página
mostra as duas separadas e ⛔ as soma.
