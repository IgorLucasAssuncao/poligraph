"""A ementa que destrava a curadoria (PL11).

⚠️ Sem ela, quem cura lê só a descrição da votação — que diz o NÚMERO do projeto e não
diz sobre o que ele é.
"""

from poligraph_etl import proposicoes

CONHECIDAS = {"2162802-89", "2162802-90", "1029018-80"}


def linha(votacao="2162802-89", proposicao="2121642", **campos) -> dict:
    base = {
        "idVotacao": votacao,
        "proposicao_id": proposicao,
        "proposicao_siglaTipo": "PL",
        "proposicao_numero": "2672",
        "proposicao_ano": "2025",
        "proposicao_ementa": "Altera o Código Penal para tipificar conduta.",
    }

    return {**base, **campos}


# ═══════════════════════════════════════════════════════════════════
# O que entra
# ═══════════════════════════════════════════════════════════════════


def test_extrai_a_proposicao_e_o_vinculo_de_uma_leitura_so():
    """⭐ Os dois saem juntos: separar exigiria percorrer o arquivo duas vezes."""
    lista, vinculo = proposicoes.para_linhas([linha()], CONHECIDAS)

    assert vinculo == {"2162802-89": 2121642}
    assert lista[0]["id"] == 2121642
    assert lista[0]["sigla_tipo"] == "PL"
    assert lista[0]["numero"] == 2672
    assert lista[0]["ano"] == 2025


def test_a_ementa_e_o_que_importa():
    lista, _ = proposicoes.para_linhas([linha()], CONHECIDAS)

    assert lista[0]["ementa"] == "Altera o Código Penal para tipificar conduta."


def test_quebra_de_linha_dentro_da_ementa_e_colapsada():
    """⚠️ A fonte traz quebra de linha DENTRO do campo — o mesmo vício dos outros CSVs."""
    lista, _ = proposicoes.para_linhas(
        [linha(proposicao_ementa="Altera  a Lei\nnº 7.210,\n  de 1984.")], CONHECIDAS
    )

    assert lista[0]["ementa"] == "Altera a Lei nº 7.210, de 1984."


# ═══════════════════════════════════════════════════════════════════
# O que fica de fora
# ═══════════════════════════════════════════════════════════════════


def test_votacao_fora_da_base_e_descartada():
    """🔴 O vínculo apontaria para votação inexistente, e a FK recusaria."""
    lista, vinculo = proposicoes.para_linhas([linha(votacao="999-1")], CONHECIDAS)

    assert (lista, vinculo) == ([], {})


def test_linha_sem_proposicao_e_descartada():
    lista, vinculo = proposicoes.para_linhas([linha(proposicao="")], CONHECIDAS)

    assert (lista, vinculo) == ([], {})


def test_proposicao_nao_numerica_e_descartada():
    """Id que não é número é mudança de contrato, ⛔ não caso normal."""
    lista, vinculo = proposicoes.para_linhas([linha(proposicao="PL-2672")], CONHECIDAS)

    assert (lista, vinculo) == ([], {})


# ═══════════════════════════════════════════════════════════════════
# Duplicatas — as duas direções
# ═══════════════════════════════════════════════════════════════════


def test_votacao_com_varios_objetos_vincula_uma_vez():
    """⚠️ A mesma votação aparece repetida quando tem mais de um objeto em pauta."""
    lista, vinculo = proposicoes.para_linhas(
        [linha(), linha(proposicao="9999999")], CONHECIDAS
    )

    assert vinculo == {"2162802-89": 2121642}
    assert len(lista) == 1


def test_mesma_proposicao_em_votacoes_diferentes_grava_uma_vez():
    """⭐ Vários turnos do mesmo projeto: duas votações, uma proposição."""
    lista, vinculo = proposicoes.para_linhas(
        [linha(votacao="2162802-89"), linha(votacao="2162802-90")], CONHECIDAS
    )

    assert len(vinculo) == 2
    assert len(lista) == 1


def test_ementa_vazia_vira_nula_e_nao_string_vazia():
    """⛔ String vazia na tela vira um espaço em branco que parece defeito de layout."""
    lista, _ = proposicoes.para_linhas([linha(proposicao_ementa="  ")], CONHECIDAS)

    assert lista[0]["ementa"] is None
