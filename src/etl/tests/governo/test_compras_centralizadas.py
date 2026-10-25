"""Cartão de compras centralizadas: soma por órgão e mês, sem ler o favorecido."""

from poligraph_etl.governo import compras_centralizadas
from poligraph_etl.contratos import entrada
from poligraph_etl.contratos.banco import CompraCentralizadaNoCartao
from poligraph_etl.contratos.portal import LinhaDeCompraCentralizadaNoCartao


def transacao(**campos) -> dict:
    """DECISÃO: valores de uma linha REAL de `202305_CPGFComprasCentralizadas.csv`, sem o favorecido."""
    base = {"ANO EXTRATO": "2023", "MÊS EXTRATO": "05", "NOME ÓRGÃO SUPERIOR": "Ministério da Educação",
            "CNPJ OU CPF FAVORECIDO": "01167991613", "NOME FAVORECIDO": "PESSOA", "VALOR TRANSAÇÃO": "290,00"}
    return {**base, **campos}


def test_soma_por_orgao_e_mes():
    linhas = entrada.ler(LinhaDeCompraCentralizadaNoCartao, [transacao(), transacao(**{"VALOR TRANSAÇÃO": "314,30"})])

    assert compras_centralizadas.transformar(linhas) == [
        CompraCentralizadaNoCartao(ano=2023, mes=5, orgao_superior="Ministério da Educação", valor=604.3, transacoes=2)]


def test_o_contrato_nao_le_o_favorecido():
    """RISCO: o arquivo traz CPF de favorecido sem máscara."""
    lidas = set(entrada.colunas_da_fonte(LinhaDeCompraCentralizadaNoCartao).values())

    assert lidas.isdisjoint({"CNPJ OU CPF FAVORECIDO", "NOME FAVORECIDO"})
