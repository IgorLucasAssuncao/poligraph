"""Arrecadação federal — receitas do Portal da Transparência.

Responde *"de onde veio o dinheiro que o governo federal gastou?"*.

## ENTRADA

| | |
|---|---|
| Fonte | Download `receitas/{ano}` — ver [`fontes/portal.py`](fontes/portal.py) |
| Grão | Uma linha por unidade gestora × espécie × detalhamento da receita |
| Volume | ~170 mil linhas por ano, ZIP com menos de 2 MB |

## SAÍDA

`receitas_por_origem` — uma linha por ano, categoria econômica e origem.

---

🔴 **Operação de crédito ⛔ é arrecadação.** É dinheiro emprestado — a emissão de títulos
da dívida —, e em 2025 soma R$ 2.464 bi, quase o mesmo que tudo o que se arrecadou em
impostos, contribuições e demais receitas correntes (R$ 2.878 bi). Somar os dois
faria a arrecadação parecer o dobro. A tabela guarda a categoria e a origem como o
Portal publica; quem separa é a API, e a tela diz por quê.

⚠️ As intra-orçamentárias são o governo pagando a si mesmo — a contribuição patronal
que um órgão recolhe para a previdência do servidor. Ficam gravadas e ⛔ entram na
arrecadação.
"""

from datetime import date

import pandas as pd

from . import normalizacao

RECURSO = "receitas/{ano}"


def arquivo(ano: int) -> str:
    return f"{ano}_Receitas.csv"


def para_linhas(df: pd.DataFrame, gerado_em: date) -> list[dict]:
    """Soma prevista e realizada por ano, categoria econômica e origem."""
    base = df[["ANO EXERCÍCIO", "CATEGORIA ECONÔMICA", "ORIGEM RECEITA"]].copy()
    base["prevista"] = df["VALOR PREVISTO ATUALIZADO"].map(normalizacao.valor_pt_br)
    base["realizada"] = df["VALOR REALIZADO"].map(normalizacao.valor_pt_br)

    somas = base.groupby(["ANO EXERCÍCIO", "CATEGORIA ECONÔMICA", "ORIGEM RECEITA"])[
        ["prevista", "realizada"]
    ].sum()

    return [
        {
            "ano": int(ano),
            "categoria": categoria,
            "origem": origem,
            "prevista": round(float(linha["prevista"]), 2),
            "realizada": round(float(linha["realizada"]), 2),
            "gerado_em": gerado_em.isoformat(),
        }
        for (ano, categoria, origem), linha in somas.iterrows()
    ]
