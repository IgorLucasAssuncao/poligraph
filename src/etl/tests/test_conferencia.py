"""PL66 — as regras de plausibilidade, com os casos reais que as motivaram.

Cada teste usa o número medido em 2026-10-02: a regra que não pega o caso real não serve.
"""

from poligraph_etl import conferencia


def test_os_203_senadores_da_55a_sao_erro():
    """RISCO: Achado #37: o caso que a conferência existe para pegar no dia da carga."""
    [achado] = conferencia.votantes_na_legislatura([("SENADO", 55, 203)])

    assert achado.severidade == "ERRO"
    assert achado.legislatura == 55


def test_os_maiores_medidos_passam():
    """MEDIDO: Câmara 644 (54ª) e Senado 111 (54ª e 56ª): suplentes não são erro."""
    assert conferencia.votantes_na_legislatura([("CAMARA", 54, 644), ("SENADO", 56, 111)]) == []


def test_82_senadores_numa_votacao_e_aviso_e_muito_acima_e_erro():
    """MEDIDO: SF-5999: titular e suplente juntos no dia da troca. É da fonte, não defeito nosso."""
    aviso, erro = conferencia.votantes_na_votacao(
        [("SENADO", 56, "SF-5999", 82), ("SENADO", 55, "SF-1", 120)]
    )

    assert aviso.severidade == "AVISO"
    assert erro.severidade == "ERRO"


def test_codigo_antigo_com_data_nova_e_erro_nos_dois_sentidos():
    achados = conferencia.codigo_fora_de_epoca([
        (55, "SF-1483", "2015-04-01"),   # votação de 1998 datada de 2015
        (51, "SF-5293", "2002-04-16"),   # votação de 2014 datada de 2002
        (57, "SF-7105", "2026-06-30"),   # certa
        (51, "SF-481", "2001-02-21"),    # certa, numeração antiga
    ])

    assert [a.detalhe.split()[0] for a in achados] == ["SF-1483", "SF-5293"]
    assert all(a.severidade == "ERRO" for a in achados)


def test_placar_divergente_e_aviso_so_quando_difere():
    achados = conferencia.placar_divergente([
        (53, "363391-44", 3, 3, 275, 276),
        (57, "ok", 300, 300, 100, 100),
    ])

    assert [a.severidade for a in achados] == ["AVISO"]
    assert "275" in achados[0].detalhe


def test_votacao_so_com_presenca_na_camara_e_aviso_de_secreta_de_fato():
    """MEDIDO: "Eleito o Sr. …": 11 na Câmara, todas sem posição registrada."""
    achados = conferencia.sem_posicao_nenhuma([("CAMARA", 55, "1203407-4"), ("SENADO", 56, "SF-1")])

    assert [a.casa for a in achados] == ["CAMARA"]


def test_a_51a_da_camara_quase_sem_voto_nominal_e_aviso():
    """MEDIDO: 1.541 de 1.548 votações sem voto. A 56ª, com 129 de ~2.400, não é."""
    achados = conferencia.votacoes_sem_voto([("CAMARA", 51, 1548, 1541), ("CAMARA", 56, 2400, 129)])

    assert [a.legislatura for a in achados] == [51]


def test_partido_vazio_acima_de_1_por_cento_e_aviso():
    achados = conferencia.sem_partido([("SENADO", 55, 1377, 578), ("CAMARA", 57, 470727, 0)])

    assert [a.legislatura for a in achados] == [55]


def test_quatro_senadores_de_uma_uf_e_aviso():
    achados = conferencia.senadores_demais_por_uf([(56, "SF-5999", "TO", 4), (56, "SF-5999", "SP", 3)])

    assert [a.detalhe for a in achados] == ["SF-5999: 4 senadores de TO"]


def test_conferir_roda_toda_regra_com_a_consulta_dela():
    """Cada regra tem consulta, e uma base vazia não quebra nada."""
    vistas = []

    def executar(sql):
        vistas.append(sql)
        return []

    assert conferencia.conferir(executar) == []
    assert len(vistas) == len(conferencia.REGRAS) == len(conferencia.CONSULTAS)
