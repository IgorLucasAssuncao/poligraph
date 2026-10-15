"""Cartão de Pagamento de Compras Centralizadas (CPCC): o cartão do governo federal em compras centralizadas.

Entrada: `contratos.portal.LinhaDeCompraCentralizadaNoCartao`, do ZIP `download-de-dados/cpcc/AAAAMM`.
Transformação: soma por mês do extrato e órgão superior; nenhuma linha fica de fora. Saída:
`compras_centralizadas_no_cartao`, trocando o mês.

RISCO: o arquivo traz o CPF do favorecido pessoa física sem máscara; o contrato não o lê.
"""

from collections import defaultdict
from collections.abc import Iterable

from .contratos.banco import CompraCentralizadaNoCartao
from .contratos.portal import LinhaDeCompraCentralizadaNoCartao
from .normalizacao import inteiro, valor_pt_br

RECURSO = "cpcc/{ano}{mes:02d}"


def arquivo_do_mes(ano: int, mes: int) -> str:
    """O CSV dentro do ZIP do mês."""
    return f"{ano}{mes:02d}_CPGFComprasCentralizadas.csv"


def transformar(linhas: Iterable[LinhaDeCompraCentralizadaNoCartao]) -> list[CompraCentralizadaNoCartao]:
    """As transações do mês, somadas por órgão superior."""
    somas: dict[tuple, list] = defaultdict(lambda: [0.0, 0])
    for linha in linhas:
        chave = (inteiro(linha.ano_do_extrato), inteiro(linha.mes_do_extrato), (linha.orgao_superior or "").strip())
        somas[chave][0] += valor_pt_br(linha.valor)
        somas[chave][1] += 1
    return [
        CompraCentralizadaNoCartao(ano=ano, mes=mes, orgao_superior=orgao, valor=round(valor, 2), transacoes=transacoes)
        for (ano, mes, orgao), (valor, transacoes) in sorted(somas.items())
    ]
