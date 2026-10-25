"""Execução do orçamento federal — Portal da Transparência.

Responde *"quanto o governo federal tinha autorizado para gastar em cada área, quanto
reservou e quanto de fato pagou, ano a ano?"*. É **contexto** da legislatura, não
medida de afinidade, e não liga a parlamentar nenhum.

## ENTRADA

| | |
|---|---|
| Fonte | Download `orcamento-despesa/{ano}` — ver [`fontes/portal.py`](fontes/portal.py) |
| Grão | Uma linha por órgão × unidade × funcional-programática × elemento de despesa |
| Volume | ~25 mil linhas por ano, ZIP com menos de 1 MB |
| ATENÇÃO: Cobertura | **Poder Executivo federal**, 36 órgãos superiores. Legislativo, Judiciário e Ministério Público aparecem só em linhas residuais — a função Legislativa soma poucos milhares de reais |

## TRATAMENTO

Soma por **função** (saúde, educação, defesa...) e mede, por programação, o quanto se
empenhou **além** da dotação publicada.

## SAÍDA

| | |
|---|---|
| Tabela | `orcamento_por_funcao` — uma linha por ano e função |
| Idempotência | `DELETE` pelos anos que entram, na mesma transação do `INSERT` |

---

RISCO: **Empenhar além da dotação é ilegal — e o arquivo de 2025 mostra R$ 228,6 bi assim.**
É o valor que a lei orçamentária de 2025 deixou **condicionado à regra de ouro** (R$
228,5 bi): o arquivo publica a dotação sem essa parcela, e o empenho a usou depois de
liberada. Em 2023 o mesmo cálculo dá R$ 0,1 bi; em 2024, R$ 1,4 bi.

DECISÃO: Por isso `empenhado_acima_da_dotacao` é gravado ao lado dos totais: onde ele não é
desprezível, a razão entre pago e dotação não pode ser mostrada, e a tela diz por quê.

MEDIDO: [achado #34](../../../docs/achados/034-a-dotacao-de-2025-sem-a-regra-de-ouro.md)
"""

from datetime import date

import pandas as pd

from ..nucleo import normalizacao
from ..contratos.banco import DividaFederal
from ..nucleo.tipos import TipoGastoComDivida, gasto_com_divida

RECURSO = "orcamento-despesa/{ano}"

# ATENÇÃO: Onde a dotação é autorizada: a funcional-programática da unidade orçamentária. Abaixo
#    disso — no elemento de despesa — a dotação não existe linha a linha, e comparar ali
#    acusaria excesso em toda linha de dotação zero.
PROGRAMACAO = [
    "CÓDIGO UNIDADE ORÇAMENTÁRIA",
    "CÓDIGO FUNÇÃO",
    "CÓDIGO SUBFUNÇÃO",
    "CÓDIGO PROGRAMA ORÇAMENTÁRIO",
    "CÓDIGO AÇÃO",
]

VALORES = {
    "ORÇAMENTO INICIAL (R$)": "dotacao_inicial",
    "ORÇAMENTO ATUALIZADO (R$)": "dotacao_atualizada",
    "ORÇAMENTO EMPENHADO (R$)": "empenhado",
    "ORÇAMENTO REALIZADO (R$)": "pago",
}


def arquivo(ano: int) -> str:
    return f"{ano}_OrcamentoDespesa.csv"


def para_linhas(df: pd.DataFrame, gerado_em: date) -> list[dict]:
    """Uma linha por ano e função, com o empenho além da dotação ao lado.

    ATENÇÃO: "Realizado" no arquivo é o **pago no exercício**. Resto a pagar quitado no ano
    seguinte não entra — conferido contra a API: Defesa 2023, R$ 78,99 bi nos dois.
    """
    valores = df[list(VALORES)].apply(lambda coluna: coluna.map(normalizacao.valor_pt_br))
    base = pd.concat([df[["EXERCÍCIO", "NOME FUNÇÃO", *PROGRAMACAO]], valores], axis=1)
    base = base.rename(columns=VALORES)

    por_programacao = base.groupby(["EXERCÍCIO", *PROGRAMACAO], as_index=False)[
        ["dotacao_atualizada", "empenhado"]
    ].sum()
    por_programacao["acima"] = (
        por_programacao["empenhado"] - por_programacao["dotacao_atualizada"]
    ).clip(lower=0)
    acima = por_programacao.groupby(["EXERCÍCIO", "CÓDIGO FUNÇÃO"])["acima"].sum()

    por_funcao = base.groupby(["EXERCÍCIO", "CÓDIGO FUNÇÃO"]).agg(
        funcao=("NOME FUNÇÃO", "first"),
        **{coluna: (coluna, "sum") for coluna in VALORES.values()},
    )

    return [
        {
            "ano": int(ano),
            "codigo_funcao": codigo,
            "funcao": linha["funcao"],
            **{coluna: round(float(linha[coluna]), 2) for coluna in VALORES.values()},
            "empenhado_acima_da_dotacao": round(float(acima.loc[(ano, codigo)]), 2),
            "gerado_em": gerado_em.isoformat(),
        }
        for (ano, codigo), linha in por_funcao.iterrows()
    ]


# ═══════════════════════════════════════════════════════════════════
# Encargos especiais — dívida e transferências, separadas por subfunção
# ═══════════════════════════════════════════════════════════════════

# RISCO: "Encargos especiais" Não é área de serviço: é 60% da dotação de 2023 a 2025, e junta
#    coisas que não se leem juntas — pagar juros, rolar a dívida, repassar o FPM. A
#    subfunção separa as três. Em 2025, pago: refinanciamento R$ 1.412 bi, serviço da
#    dívida R$ 607 bi, transferências R$ 588 bi, outros R$ 230 bi.
ENCARGOS_ESPECIAIS = "28"


def encargos_para_linhas(df: pd.DataFrame) -> list[dict]:
    """Uma linha por ano e subfunção de Encargos especiais."""
    valores = df[list(VALORES)].apply(lambda coluna: coluna.map(normalizacao.valor_pt_br))
    base = pd.concat(
        [df[["EXERCÍCIO", "CÓDIGO FUNÇÃO", "CÓDIGO SUBFUNÇÃO", "NOME SUBFUNÇÃO"]], valores], axis=1
    ).rename(columns=VALORES)
    base = base[base["CÓDIGO FUNÇÃO"] == ENCARGOS_ESPECIAIS]

    por_subfuncao = base.groupby(["EXERCÍCIO", "CÓDIGO SUBFUNÇÃO"]).agg(
        subfuncao=("NOME SUBFUNÇÃO", "first"),
        dotacao_atualizada=("dotacao_atualizada", "sum"),
        empenhado=("empenhado", "sum"),
        pago=("pago", "sum"),
    )

    return [
        {
            "ano": int(ano),
            "codigo_subfuncao": codigo,
            "subfuncao": linha["subfuncao"],
            "dotacao_atualizada": round(float(linha["dotacao_atualizada"]), 2),
            "empenhado": round(float(linha["empenhado"]), 2),
            "pago": round(float(linha["pago"]), 2),
        }
        for (ano, codigo), linha in por_subfuncao.iterrows()
    ]


# ═══════════════════════════════════════════════════════════════════
# Restos a pagar — o que saiu no ano por despesa de anos anteriores
# ═══════════════════════════════════════════════════════════════════

# ATENÇÃO: O arquivo de orçamento traz só o pago do PRÓPRIO exercício. O que foi empenhado
#    num ano e pago no seguinte está no arquivo mensal de execução. MEDIDO: Em 2025: R$ 234,6
#    bi — em Urbanismo, 3,3 vezes o pago do exercício. Sem isso, área de obra parece
#    parada.
EXECUCAO = "despesas-execucao/{ano}{mes:02d}"

COLUNAS_DE_EXECUCAO = [
    "Código Função",
    "Código Subfução",  # ATENÇÃO: Sic: o cabeçalho do Portal escreve "Subfução".
    "Valor Pago (R$)",
    "Valor Restos a Pagar Pagos (R$)",
]


def arquivo_de_execucao(ano: int, mes: int) -> str:
    return f"{ano}{mes:02d}_Despesas.csv"


def restos_a_pagar_do_mes(df: pd.DataFrame) -> dict:
    """Soma o mês: resto a pagar pago por função e por subfunção de Encargos especiais.

    DECISÃO: Devolve também o pago do exercício, para conferir o arquivo mensal contra o anual.
    MEDIDO: Em 2025 os doze meses somam R$ 5.147,8 bi pagos, o mesmo do arquivo de orçamento.
    """
    valores = df[COLUNAS_DE_EXECUCAO[2:]].apply(lambda c: c.map(normalizacao.valor_pt_br))
    base = pd.concat([df[COLUNAS_DE_EXECUCAO[:2]], valores], axis=1)
    rp = "Valor Restos a Pagar Pagos (R$)"

    encargos = base[base["Código Função"] == ENCARGOS_ESPECIAIS]

    return {
        "por_funcao": base.groupby("Código Função")[rp].sum().to_dict(),
        "por_subfuncao": encargos.groupby("Código Subfução")[rp].sum().to_dict(),
        "pago": float(base["Valor Pago (R$)"].sum()),
    }


def somar_meses(meses: list[dict]) -> dict:
    """Junta os meses de um ano no mesmo formato de `restos_a_pagar_do_mes`."""
    total = {"por_funcao": {}, "por_subfuncao": {}, "pago": 0.0}
    for mes in meses:
        for chave in ("por_funcao", "por_subfuncao"):
            for codigo, valor in mes[chave].items():
                total[chave][codigo] = total[chave].get(codigo, 0.0) + valor
        total["pago"] += mes["pago"]
    return total


MENSAL_DIFERENTE_DO_ANUAL = "MENSAL_DIFERENTE_DO_ANUAL"


def reconciliar_mensal_e_anual(ano: int, pago_mensal: float, pago_anual: float) -> dict:
    """O pago do ano pelos 12 arquivos mensais de execução contra o pago do arquivo anual, que é o da base (regra 5).

    Os dois arquivos são do Portal e falam do mesmo pago do exercício, mas não batem. MEDIDO (2026-10-23, 2014 a 2025): o
    mensal passa o anual em R$ 7,77 bi em 2014 (0,37%) e fica R$ 2,38 bi abaixo em 2022 (0,06%); nos outros anos a
    diferença fica abaixo de R$ 1 bi. A base grava o anual, que é o que tem a função e a dotação.

    | Motivo | Valor | O que é |
    |---|---|---|
    | `MENSAL_DIFERENTE_DO_ANUAL` | positivo ou negativo | O mensal menos o anual: quanto um arquivo do Portal difere do outro |

    A conta fecha por construção: mensal = anual + diferença.
    """
    diferenca = round(pago_mensal - pago_anual, 2)
    return {
        "conjunto": "GOVERNO_FEDERAL",
        "medida": "PAGO",
        "ano": ano,
        "total_na_fonte": round(pago_mensal, 2),
        "total_na_base": round(pago_anual, 2),
        "total_inferido": 0.0,
        "motivos": {MENSAL_DIFERENTE_DO_ANUAL: diferenca} if diferenca != 0 else {},
    }


def divida_para_linhas(df: pd.DataFrame, gerado_em: date) -> list[DividaFederal]:
    """O pago da dívida por ano: juros (grupo 2), amortização e refinanciamento (grupo 6), pelo elemento de despesa.

    ATENÇÃO: "Realizado" é o pago no exercício, como em `para_linhas`. A soma das três partes é o que a função 28 paga em
    dívida; o resto da função são repasses a estados e municípios e outros encargos.
    """
    tipos = [gasto_com_divida(g, e) for g, e in zip(df["CÓDIGO GRUPO DE DESPESA"], df["CÓDIGO ELEMENTO DE DESPESA"])]
    base = pd.DataFrame({
        "ano": df["EXERCÍCIO"].astype(int),
        "tipo": tipos,
        "pago": df["ORÇAMENTO REALIZADO (R$)"].map(normalizacao.valor_pt_br),
    })
    base = base[base["tipo"].notna()]
    somas = base.groupby(["ano", "tipo"])["pago"].sum()
    return [
        DividaFederal(
            ano=int(ano),
            juros_pagos=round(float(somas.get((ano, TipoGastoComDivida.JUROS), 0.0)), 2),
            amortizacao_paga=round(float(somas.get((ano, TipoGastoComDivida.AMORTIZACAO), 0.0)), 2),
            refinanciamento_pago=round(float(somas.get((ano, TipoGastoComDivida.REFINANCIAMENTO), 0.0)), 2),
            gerado_em=gerado_em,
        )
        for ano in sorted(base["ano"].unique())
    ]
