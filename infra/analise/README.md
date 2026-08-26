# Scripts de análise exploratória

⚠️ **Isto não é o ETL.** São scripts descartáveis usados na fase de discovery, quando
ainda não havia Python nem .NET na máquina. O ETL de verdade é Python, em `etl/`.

| Arquivo | O que faz |
|---|---|
| `csv.awk` | ⭐ Parser CSV RFC 4180 — trata **quebra de linha dentro do campo** |

## Por que este parser existe

Os CSVs da Câmara têm quebras de linha dentro de campos entre aspas. Contar por linha
infla o total em **15 a 26%**, dependendo do ano. O parser foi validado contra o número
documentado em `docs/04-contratos.md`: 2025 dá **13.825** registros, exatamente o medido.

```bash
awk -f csv.awk -f <seu-script>.awk arquivo.csv
```

O seu script precisa definir `processa(registro, n)`, que recebe o número do registro e a
quantidade de campos. Os campos chegam no array global `campo[1..n]`.
