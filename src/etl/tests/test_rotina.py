"""PL64 — as etapas da carga agendada, decididas pela frequência e pela data."""

from datetime import date

import pytest

from poligraph_etl import rotina


def _comandos(lista):
    return [str(etapa) for etapa in lista]


def test_semanal_traz_as_votacoes_do_ano_e_confere():
    lista = rotina.etapas("semanal", date(2026, 10, 5))

    assert _comandos(lista) == ["ingerir --anos 2026", "senado --anos 2026", "conferir"]


def test_mensal_acrescenta_dinheiro_e_grafo_e_confere_uma_vez_no_fim():
    lista = rotina.etapas("mensal", date(2026, 10, 5))

    assert _comandos(lista) == [
        "ingerir --anos 2026",
        "senado --anos 2026",
        "cota --anos 2026",
        "emendas --anos 2026",
        "analisar --casa CAMARA",
        "analisar --casa SENADO",
        "conferir",
    ]


@pytest.mark.parametrize("mes", [1, 2])
def test_janeiro_e_fevereiro_olham_o_ano_anterior(mes):
    """A nota de dezembro chega à cota com semanas de atraso, e a emenda do ano passado ainda é paga."""
    lista = rotina.etapas("mensal", date(2027, mes, 3))

    assert lista[0].argumentos["anos"] == [2026, 2027]
    assert lista[2].argumentos["anos"] == [2026, 2027]


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
    for nome in ("_ingerir", "_senado", "_cota", "_emendas", "_analisar", "_conferir"):
        monkeypatch.setattr(principal, nome, lambda *_, nome=nome: executados.append(nome))

    for frequencia in rotina.FREQUENCIAS:
        for etapa in rotina.etapas(frequencia, date(2026, 10, 5)):
            principal._executar_etapa(ConexaoFalsa(), etapa)

    assert set(executados) == {"_ingerir", "_senado", "_cota", "_emendas", "_analisar", "_conferir"}
