"""Comunidade × partido.

ATENÇÃO: O ARI é fácil de implementar errado de um jeito que passa despercebido: o Rand
SIMPLES parece funcionar e sobe só por haver muitos grupos. Estes testes fixam os
valores de referência conhecidos.
"""

import networkx as nx
import pytest

from poligraph_etl import comparacao


def test_particoes_identicas_dao_ari_um():
    a = [0, 0, 1, 1, 2, 2]
    b = ["x", "x", "y", "y", "z", "z"]

    assert comparacao.indice_rand_ajustado(a, b) == pytest.approx(1.0)


def test_nome_do_grupo_nao_importa_so_o_agrupamento():
    """DECISÃO: Comunidade 0 e partido 'PT' podem ser o mesmo conjunto — o ARI compara
    o agrupamento, não o rótulo."""
    a = [0, 0, 1, 1]
    b = ["PT", "PT", "PL", "PL"]

    assert comparacao.indice_rand_ajustado(a, b) == pytest.approx(1.0)


def test_particoes_sem_relacao_ficam_perto_de_zero():
    """RISCO: É o ajuste que faz isto valer ~0 em vez de subir com o número de grupos."""
    a = [0, 0, 0, 0, 1, 1, 1, 1]
    b = ["x", "y", "x", "y", "x", "y", "x", "y"]

    assert comparacao.indice_rand_ajustado(a, b) == pytest.approx(0.0, abs=0.2)


def test_tudo_num_grupo_so_nao_estoura():
    """ATENÇÃO: Partição trivial zera o denominador — devolve 0, não ZeroDivisionError."""
    assert comparacao.indice_rand_ajustado([0, 0, 0], ["x", "x", "x"]) == 0.0


def test_particoes_de_tamanhos_diferentes_sao_recusadas():
    with pytest.raises(ValueError):
        comparacao.indice_rand_ajustado([0, 1], ["x"])


def dois_blocos() -> nx.Graph:
    g = nx.Graph()
    for i, x in enumerate([1, 2, 3]):
        for y in [1, 2, 3][i + 1 :]:
            g.add_edge(x, y, peso=0.9)
    for i, x in enumerate([4, 5, 6]):
        for y in [4, 5, 6][i + 1 :]:
            g.add_edge(x, y, peso=0.9)
    g.add_edge(3, 4, peso=0.05)

    return g


def test_divisao_que_segue_a_estrutura_tem_modularidade_maior():
    g = dois_blocos()

    certa = comparacao.modularidade(g, [1, 2, 3, 4, 5, 6], [0, 0, 0, 1, 1, 1])
    errada = comparacao.modularidade(g, [1, 2, 3, 4, 5, 6], [0, 1, 0, 1, 0, 1])

    assert certa > errada


def test_comparar_junta_as_duas_medidas():
    g = dois_blocos()
    pessoas = [1, 2, 3, 4, 5, 6]

    # partido que ATRAVESSA os blocos de voto — o caso que o TCC quer detectar
    r = comparacao.comparar(
        g,
        comunidade_de={p: (0 if p <= 3 else 1) for p in pessoas},
        partido_de={p: ("A" if p % 2 else "B") for p in pessoas},
    )

    assert r.n_pessoas == 6
    assert r.n_comunidades == 2
    assert r.n_partidos == 2
    # DECISÃO: a afirmação que interessa: a comunidade descreve o grafo melhor que o partido
    assert r.comunidade_descreve_melhor


def test_quem_nao_tem_partido_fica_de_fora():
    g = dois_blocos()

    r = comparacao.comparar(
        g,
        comunidade_de={p: 0 for p in [1, 2, 3, 4, 5, 6]},
        partido_de={1: "A", 2: "A", 3: "B"},      # só três têm partido
    )

    assert r.n_pessoas == 3
