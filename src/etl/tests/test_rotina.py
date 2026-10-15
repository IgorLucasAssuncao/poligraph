"""Pendência 64 — as etapas da carga agendada, decididas pela frequência e pela data."""

from datetime import date

import pytest

from poligraph_etl import rotina


def _comandos(lista):
    return [str(etapa) for etapa in lista]


def test_semanal_traz_as_votacoes_do_ano_e_confere():
    lista = rotina.etapas("semanal", date(2026, 10, 5))

    assert _comandos(lista) == [
        "ingerir --anos 2026", "senado --anos 2026", "simbolicas --anos 2026", "palavras-chave", "conferir",
    ]


def test_mensal_acrescenta_dinheiro_e_grafo_e_confere_uma_vez_no_fim():
    lista = rotina.etapas("mensal", date(2026, 10, 5))

    assert _comandos(lista) == [
        "ingerir --anos 2026",
        "senado --anos 2026",
        "simbolicas --anos 2026",
        "palavras-chave",
        "cota --anos 2026",
        "emendas --anos 2026",
        "sedes-brasilapi",
        "convenios",
        "governo --anos 2026 --eleicao 2022",
        "defesa-civil --anos 2026",
        "compras-centralizadas --anos 2026",
        "viagens --anos 2026",
        "compras --anos 2026",
        "sancoes",
        "populacao",
        "municipios",
        "analisar --casa CAMARA",
        "analisar --casa SENADO",
        "conferir",
    ]


def test_cadastro_da_receita_so_uma_vez_por_trimestre():
    assert "municipios" not in _comandos(rotina.etapas("mensal", date(2026, 11, 5)))
    assert "municipios" in _comandos(rotina.etapas("mensal", date(2027, 1, 5)))


def test_tse_depois_da_eleicao_geral():
    """Nov e dez de 2026 trazem campanha, bens e redes da eleição; nov de 2028 não."""
    comandos = _comandos(rotina.etapas("mensal", date(2026, 11, 5)))

    assert "fundo --eleicao 2026" in comandos
    assert "patrimonio --anos 2026" in comandos
    assert "redes --anos 2026" in comandos
    assert not any(c.startswith("fundo") for c in _comandos(rotina.etapas("mensal", date(2028, 11, 5))))


def test_o_governo_em_exercicio_e_o_da_ultima_eleicao_geral():
    assert rotina.ultima_eleicao_geral(date(2026, 11, 5)) == 2022
    assert rotina.ultima_eleicao_geral(date(2027, 1, 5)) == 2026


@pytest.mark.parametrize("mes", [1, 2])
def test_janeiro_e_fevereiro_olham_o_ano_anterior(mes):
    """A nota de dezembro chega à cota com semanas de atraso, e a emenda do ano passado ainda é paga."""
    lista = rotina.etapas("mensal", date(2027, mes, 3))

    assert lista[0].argumentos["anos"] == [2026, 2027]
    assert lista[4].argumentos["anos"] == [2026, 2027]


def test_marco_ja_nao_olha():
    assert rotina.anos_com_dado_novo(date(2027, 3, 1)) == [2027]


def test_frequencia_desconhecida_e_recusada():
    with pytest.raises(ValueError):
        rotina.etapas("diaria", date(2026, 10, 5))


def test_toda_etapa_tem_execucao_no_main(monkeypatch):
    """Uma etapa nova em `rotina` sem o ramo em `_executar_etapa` só falharia no VPS, no dia agendado."""
    from poligraph_etl import __main__ as principal

    class ConexaoFalsa:
        def execute(self, *_):
            return self

        def fetchone(self):
            return (57,)

    executados = []
    nomes = (
        "_ingerir", "_senado", "_simbolicas", "_palavras_chave", "_cota", "_emendas", "_sedes_brasilapi", "_convenios",
        "_governo", "_defesa_civil", "_compras_centralizadas", "_viagens", "_compras", "_sancoes", "_municipios", "_fundo", "_patrimonio", "_redes", "_populacao", "_analisar", "_conferir",
    )
    for nome in nomes:
        monkeypatch.setattr(principal, nome, lambda *_, nome=nome: executados.append(nome))

    for frequencia in rotina.FREQUENCIAS:
        for dia in (date(2026, 10, 5), date(2026, 11, 5)):
            for etapa in rotina.etapas(frequencia, dia):
                principal._executar_etapa(ConexaoFalsa(), etapa)

    assert set(executados) == set(nomes)
