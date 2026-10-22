"""As contas anuais das prefeituras, da DCA do Siconfi (Pendência 90, fase 5).

| Número | Anexo | Conta | Coluna |
|---|---|---|---|
| Receita bruta | I-C | `ReceitasExcetoIntraOrcamentarias` | Receitas Brutas Realizadas |
| Deduções | I-C | `ReceitasExcetoIntraOrcamentarias` | Deduções - FUNDEB, Outras Deduções da Receita |
| Despesa empenhada e paga | I-D | `DO3.0.00.00.00.00` (correntes) mais `DO4.0.00.00.00.00` (capital) | Despesas Empenhadas, Despesas Pagas |

MEDIDO em 2026-10-22, Campinas, 2023: o Anexo I-D não traz uma conta de total; correntes mais capital é
a despesa orçamentária inteira. A coluna e a conta são comparadas por igualdade exata (regra do `CLAUDE.md`).
"""

from .contratos.banco import ContasDoMunicipio
from .contratos.siconfi import LinhaDaDca

CONTA_DA_RECEITA = "ReceitasExcetoIntraOrcamentarias"
COLUNA_DA_RECEITA_BRUTA = "Receitas Brutas Realizadas"
COLUNAS_DE_DEDUCAO = frozenset({"Deduções - FUNDEB", "Outras Deduções da Receita", "Deduções - Transferências Constitucionais"})
CONTAS_DA_DESPESA = frozenset({"DO3.0.00.00.00.00", "DO4.0.00.00.00.00"})
COLUNA_EMPENHADA = "Despesas Empenhadas"
COLUNA_PAGA = "Despesas Pagas"


def contas_para_linha(codigo_ibge: str, ano: int, receitas: list[LinhaDaDca], despesas: list[LinhaDaDca]) -> ContasDoMunicipio | None:
    """As contas do município no ano. `None` quando ele não declarou a receita: sem ela, a linha mentiria um zero."""
    bruta = [r for r in receitas if r.cod_conta == CONTA_DA_RECEITA and r.coluna_da_dca == COLUNA_DA_RECEITA_BRUTA]
    if not bruta:
        return None
    deducoes = sum(_valor(r) for r in receitas if r.cod_conta == CONTA_DA_RECEITA and r.coluna_da_dca in COLUNAS_DE_DEDUCAO)
    da_despesa = [d for d in despesas if d.cod_conta in CONTAS_DA_DESPESA]
    return ContasDoMunicipio(
        codigo_ibge=codigo_ibge,
        ano=ano,
        receita_bruta=round(sum(_valor(r) for r in bruta), 2),
        deducoes=round(deducoes, 2),
        despesa_empenhada=round(sum(_valor(d) for d in da_despesa if d.coluna_da_dca == COLUNA_EMPENHADA), 2),
        despesa_paga=round(sum(_valor(d) for d in da_despesa if d.coluna_da_dca == COLUNA_PAGA), 2),
    )


def _valor(linha: LinhaDaDca) -> float:
    return float(linha.valor or 0)
