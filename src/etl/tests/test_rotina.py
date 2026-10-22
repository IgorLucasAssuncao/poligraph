"""Pendência 64 — as etapas da carga agendada, decididas pela frequência e pela data."""

from datetime import date

import pytest

from poligraph_etl import rotina


def _comandos(lista):
    return [str(etapa) for etapa in lista]


def test_semanal_traz_as_votacoes_do_ano_e_confere():
    lista = rotina.etapas("semanal", date(2026, 10, 5))

    assert _comandos(lista) == [
        "ingerir --anos 2026", "senado --anos 2026", "em-exercicio", "simbolicas --anos 2026", "palavras-chave", "conferir",
        "limpar-cache",
    ]


def test_mensal_acrescenta_dinheiro_e_grafo_e_confere_uma_vez_no_fim():
    lista = rotina.etapas("mensal", date(2026, 10, 5))

    assert _comandos(lista) == [
        "ingerir --anos 2026",
        "senado --anos 2026",
        "em-exercicio",
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
        "limpar-cache",
    ]


def test_cadastro_da_receita_so_uma_vez_por_trimestre():
    assert "municipios" not in _comandos(rotina.etapas("mensal", date(2026, 11, 5)))
    assert "municipios" in _comandos(rotina.etapas("mensal", date(2027, 1, 5)))


def test_tse_depois_da_eleicao_geral():
    """Nov e dez de 2026 trazem campanha, bens e redes da eleição; nov de 2028 também, a dos prefeitos."""
    comandos = _comandos(rotina.etapas("mensal", date(2026, 11, 5)))

    assert "fundo --eleicao 2026" in comandos
    assert "patrimonio --anos 2026" in comandos
    assert "redes --anos 2026" in comandos
    assert "mandatos --eleicoes 2026" in comandos
    assert "fundo --eleicao 2028" in _comandos(rotina.etapas("mensal", date(2028, 11, 5)))


def test_eleicao_municipal_traz_prefeitos_bens_e_redes():
    """Pendência 90: nov de 2028 traz os prefeitos e vices eleitos e a campanha deles."""
    comandos = _comandos(rotina.etapas("mensal", date(2028, 11, 5)))

    assert "mandatos --eleicoes 2028" in comandos
    assert "patrimonio --anos 2028" in comandos
    assert not any(c.startswith("mandatos") for c in _comandos(rotina.etapas("mensal", date(2027, 11, 5))))


def test_o_governo_em_exercicio_e_o_da_ultima_eleicao_geral():
    assert rotina.ultima_eleicao_geral(date(2026, 11, 5)) == 2022
    assert rotina.ultima_eleicao_geral(date(2027, 1, 5)) == 2026


@pytest.mark.parametrize("mes", [1, 2])
def test_janeiro_e_fevereiro_olham_o_ano_anterior(mes):
    """A nota de dezembro chega à cota com semanas de atraso, e a emenda do ano passado ainda é paga."""
    lista = rotina.etapas("mensal", date(2027, mes, 3))

    assert lista[0].argumentos["anos"] == [2026, 2027]
    assert lista[5].argumentos["anos"] == [2026, 2027]


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
        "_governo", "_defesa_civil", "_compras_centralizadas", "_viagens", "_compras", "_sancoes", "_municipios", "_fundo", "_mandatos", "_siconfi", "_patrimonio", "_redes", "_populacao", "_analisar", "_conferir", "_em_exercicio",
        "_limpar_cache",
    )
    for nome in nomes:
        monkeypatch.setattr(principal, nome, lambda *_, nome=nome: executados.append(nome))

    for frequencia in rotina.FREQUENCIAS:
        for dia in (date(2026, 10, 5), date(2026, 11, 5), date(2027, 5, 5)):
            for etapa in rotina.etapas(frequencia, dia):
                principal._executar_etapa(ConexaoFalsa(), etapa)

    assert set(executados) == set(nomes)


class _ConexaoComTrava:
    """Registra o SQL da trava e responde se ela estava livre."""

    def __init__(self, livre: bool):
        self.livre = livre
        self.comandos: list[str] = []

    def execute(self, sql, *_):
        self.comandos.append(sql.split("(")[0].replace("SELECT ", ""))
        return self

    def fetchone(self):
        return (self.livre,)


def test_rotina_espera_a_outra_e_solta_a_trava_mesmo_falhando(monkeypatch):
    """Duas rotinas ao mesmo tempo gravariam as mesmas tabelas; a segunda espera a primeira."""
    from poligraph_etl import __main__ as principal

    def falhar(*_):
        raise RuntimeError("conferir acusou ERRO")

    monkeypatch.setattr(principal.rotina, "etapas", lambda *_: [rotina.Etapa("conferir")])
    monkeypatch.setattr(principal, "_conferir", falhar)
    conexao = _ConexaoComTrava(livre=False)

    with pytest.raises(RuntimeError):
        principal._rotina(conexao, "semanal")

    assert conexao.comandos == ["pg_try_advisory_lock", "pg_advisory_lock", "pg_advisory_unlock"]


def test_rotina_com_a_trava_livre_nao_espera(monkeypatch):
    from poligraph_etl import __main__ as principal

    monkeypatch.setattr(principal.rotina, "etapas", lambda *_: [rotina.Etapa("conferir")])
    monkeypatch.setattr(principal, "_conferir", lambda *_: None)
    conexao = _ConexaoComTrava(livre=True)

    principal._rotina(conexao, "semanal")

    assert conexao.comandos == ["pg_try_advisory_lock", "INSERT INTO eventos ", "pg_advisory_unlock"]


def test_rotina_que_falha_nao_grava_evento(monkeypatch):
    """Pendência 89: rotina parada no meio não avisa ninguém."""
    from poligraph_etl import __main__ as principal

    def falhar(*_):
        raise RuntimeError("cota fora do ar")

    monkeypatch.setattr(principal.rotina, "etapas", lambda *_: [rotina.Etapa("cota")])
    monkeypatch.setattr(principal, "_cota", falhar)
    conexao = _ConexaoComTrava(livre=True)

    with pytest.raises(RuntimeError):
        principal._rotina(conexao, "mensal")

    assert not any(c.startswith("INSERT") for c in conexao.comandos)


@pytest.mark.parametrize("frequencia", rotina.FREQUENCIAS)
def test_evento_da_rotina_passa_pelo_check_do_banco(conexao, frequencia):
    """O tipo que o Python grava é um dos que o `CHECK` do EF aceita."""
    from poligraph_etl import __main__ as principal

    principal._avisar_que_terminou(conexao, frequencia)

    tipo = conexao.execute("SELECT tipo FROM eventos ORDER BY id DESC LIMIT 1").fetchone()[0]
    assert tipo == f"ROTINA_{frequencia.upper()}"
    conexao.execute("DELETE FROM eventos")


def test_maio_traz_as_contas_das_prefeituras_do_ano_anterior():
    """Pendência 90, fase 5: a DCA vence em 30 de abril."""
    assert "siconfi --anos 2026" in _comandos(rotina.etapas("mensal", date(2027, 5, 5)))
    assert not any(c.startswith("siconfi") for c in _comandos(rotina.etapas("mensal", date(2027, 6, 5))))
