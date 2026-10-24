"""A Selic de cada ano, para pôr ao lado dos juros que o governo federal pagou.

| | |
|---|---|
| Fonte | Banco Central, SGS, série 4390: Selic acumulada no mês, em % |
| Tratamento | Os meses de cada ano capitalizados: (1 + m₁) × (1 + m₂) × … − 1 |
| Saída | `selic_por_ano`, uma linha por ano, com quantos meses entraram |

RISCO: o juro pago num ano não acompanha a Selic do mesmo ano. Parte da dívida é prefixada ou corrigida pela inflação, e o
título paga juro no vencimento, não todo mês. A tela põe os dois lado a lado e diz isso; não calcula correlação.
"""

from .contratos.banco import SelicDoAno
from .contratos.bcb import LinhaDaSerie

SERIE_DA_SELIC_NO_MES = 4390
DESDE = 2000


def selic_para_linhas(linhas: list[LinhaDaSerie]) -> list[SelicDoAno]:
    """Uma linha por ano, com a taxa dos meses publicados capitalizada e o número de meses."""
    por_ano: dict[int, list[float]] = {}
    for linha in linhas:
        if not linha.data or linha.valor is None:
            continue
        ano = int(linha.data[-4:])
        por_ano.setdefault(ano, []).append(float(linha.valor))
    saida = []
    for ano, meses in sorted(por_ano.items()):
        fator = 1.0
        for taxa in meses:
            fator *= 1 + taxa / 100
        saida.append(SelicDoAno(ano=ano, taxa_no_ano=round((fator - 1) * 100, 4), meses=len(meses)))
    return saida
