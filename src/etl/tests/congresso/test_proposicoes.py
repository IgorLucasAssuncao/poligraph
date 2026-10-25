"""A ementa que destrava a curadoria (Pendência 11).

ATENÇÃO: Sem ela, quem cura lê só a descrição da votação — que diz o NÚMERO do projeto e não
diz sobre o que ele é.
"""

from poligraph_etl.congresso import proposicoes

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
    """DECISÃO: Os dois saem juntos: separar exigiria percorrer o arquivo duas vezes."""
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
    """ATENÇÃO: A fonte traz quebra de linha DENTRO do campo — o mesmo vício dos outros CSVs."""
    lista, _ = proposicoes.para_linhas(
        [linha(proposicao_ementa="Altera  a Lei\nnº 7.210,\n  de 1984.")], CONHECIDAS
    )

    assert lista[0]["ementa"] == "Altera a Lei nº 7.210, de 1984."


# ═══════════════════════════════════════════════════════════════════
# O que fica de fora
# ═══════════════════════════════════════════════════════════════════


def test_votacao_fora_da_base_e_descartada():
    """RISCO: O vínculo apontaria para votação inexistente, e a FK recusaria."""
    lista, vinculo = proposicoes.para_linhas([linha(votacao="999-1")], CONHECIDAS)

    assert (lista, vinculo) == ([], {})


def test_linha_sem_proposicao_e_descartada():
    lista, vinculo = proposicoes.para_linhas([linha(proposicao="")], CONHECIDAS)

    assert (lista, vinculo) == ([], {})


def test_proposicao_nao_numerica_e_descartada():
    """Id que não é número é mudança de contrato, não caso normal."""
    lista, vinculo = proposicoes.para_linhas([linha(proposicao="PL-2672")], CONHECIDAS)

    assert (lista, vinculo) == ([], {})


# ═══════════════════════════════════════════════════════════════════
# Duplicatas — as duas direções
# ═══════════════════════════════════════════════════════════════════


def test_votacao_com_varios_objetos_vincula_uma_vez():
    """ATENÇÃO: A mesma votação aparece repetida quando tem mais de um objeto em pauta."""
    lista, vinculo = proposicoes.para_linhas(
        [linha(), linha(proposicao="9999999")], CONHECIDAS
    )

    assert vinculo == {"2162802-89": 2121642}
    assert len(lista) == 1


def test_mesma_proposicao_em_votacoes_diferentes_grava_uma_vez():
    """DECISÃO: Vários turnos do mesmo projeto: duas votações, uma proposição."""
    lista, vinculo = proposicoes.para_linhas(
        [linha(votacao="2162802-89"), linha(votacao="2162802-90")], CONHECIDAS
    )

    assert len(vinculo) == 2
    assert len(lista) == 1


def test_ementa_vazia_vira_nula_e_nao_string_vazia():
    """Não String vazia na tela vira um espaço em branco que parece defeito de layout."""
    lista, _ = proposicoes.para_linhas([linha(proposicao_ementa="  ")], CONHECIDAS)

    assert lista[0]["ementa"] is None


# ═══════════════════════════════════════════════════════════════════
# RISCO: O Senado — outra fonte, outro namespace
# ═══════════════════════════════════════════════════════════════════


def materia(codigo="171682", **campos) -> dict:
    """ATENÇÃO: A fonte manda com zeros à esquerda.
    """
    base = {
        "codigo": codigo,
        "sigla_tipo": "PLP",
        "numero": "00124",
        "ano": "2022",
        "ementa": "Altera o Código Tributário Nacional.",
        "indexacao": "ALTERAÇÃO , LEGISLAÇÃO TRIBUTARIA",
    }

    return {**base, **campos}


def test_a_casa_faz_parte_da_linha():
    """RISCO: As duas fontes numeram no mesmo espaço.

    MEDIDO: Medido em 2026-08-29: a Câmara vai de 106.701 a 2.638.483 e o Senado de 121.883 a
    175.446 — 3 proposições da Câmara já estão dentro da faixa do Senado. Sem a casa
    na chave, uma matéria sobrescreveria a ementa de um projeto da outra casa, e o
    defeito não daria erro: apareceria como assunto plausível e errado na ficha.
    """
    linhas, _ = proposicoes.do_senado([materia()], {"SF-1": "171682"})

    assert linhas[0]["casa"] == "SENADO"
    assert linhas[0]["id"] == 171682


def test_zeros_a_esquerda_saem_do_numero():
    """ATENÇÃO: Sem isto a tela mostraria "PLP 00124/2022"."""
    linhas, _ = proposicoes.do_senado([materia()], {"SF-1": "171682"})

    assert linhas[0]["numero"] == 124
    assert linhas[0]["ano"] == 2022


def test_a_ementa_e_o_que_importa():
    linhas, _ = proposicoes.do_senado([materia()], {"SF-1": "171682"})

    assert linhas[0]["ementa"] == "Altera o Código Tributário Nacional."


def test_materia_sem_ementa_e_descartada():
    """Não Gravar linha sem ementa não resolve nada: a ficha continuaria no número."""
    linhas, vinculo = proposicoes.do_senado([materia(ementa="")], {"SF-1": "171682"})

    assert (linhas, vinculo) == ([], {})


def test_materia_que_nao_respondeu_e_descartada():
    """Não `baixar_materia` devolve None em falha — o tratamento não pode estourar."""
    linhas, vinculo = proposicoes.do_senado([None], {"SF-1": "171682"})

    assert (linhas, vinculo) == ([], {})


def test_vinculo_so_aponta_para_materia_gravada():
    """RISCO: Apontar para matéria descartada deixaria `proposicao_id` preenchido, e a chave
    estrangeira recusaria a votação inteira.
    """
    linhas, vinculo = proposicoes.do_senado(
        [materia()], {"SF-1": "171682", "SF-2": "999999"}
    )

    assert len(linhas) == 1
    assert vinculo == {"SF-1": 171682}


def test_varias_votacoes_da_mesma_materia():
    """DECISÃO: 421 votações apontam para 359 matérias: a mesma matéria vai a voto várias vezes."""
    _, vinculo = proposicoes.do_senado(
        [materia()], {"SF-1": "171682", "SF-2": "171682"}
    )

    assert vinculo == {"SF-1": 171682, "SF-2": 171682}


def test_materia_repetida_grava_uma_vez():
    linhas, _ = proposicoes.do_senado([materia(), materia()], {"SF-1": "171682"})

    assert len(linhas) == 1


def test_inteiro_teor_so_das_pendentes_e_vazio_quando_nao_e_https():
    from poligraph_etl.contratos.camara import LinhaDeProposicaoDaCamara

    linhas = [
        LinhaDeProposicaoDaCamara("10", "https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1"),
        LinhaDeProposicaoDaCamara("20", None),
        LinhaDeProposicaoDaCamara("30", "javascript:alert(1)"),
        LinhaDeProposicaoDaCamara("40", "https://outra.proposicao/que-ninguem-votou"),
    ]

    assert sorted(proposicoes.inteiro_teor_para_linhas(linhas, {10, 20, 30})) == [
        (10, "https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=1"), (20, ""), (30, ""),
    ]
