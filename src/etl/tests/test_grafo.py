"""Comunidades e layout.

🔴 O que estes testes protegem, acima de tudo, é a **reprodutibilidade**. Louvain e o
layout de molas são estocásticos: sem semente fixa, duas execuções sobre o mesmo dado
dão comunidades e posições diferentes. Num TCC isso é fatal — a banca reproduz e não
bate.
"""

from dataclasses import dataclass

import pytest

from poligraph_etl import grafo


@dataclass(frozen=True)
class Aresta:
    """⚠️ Espelha o que `arestas_knn` devolve: `ParSimilar`."""

    pessoa_a: int
    pessoa_b: int
    valor: float


def dois_blocos() -> tuple[list[int], list[Aresta]]:
    """Dois grupos de 4, densos por dentro e ligados por um fio só.

    ⭐ É a estrutura mais simples em que "comunidade" tem resposta certa conhecida —
    se o algoritmo não separar isto, não separa nada.
    """
    a, b = [1, 2, 3, 4], [5, 6, 7, 8]
    arestas = [Aresta(x, y, 0.95) for i, x in enumerate(a) for y in a[i + 1 :]]
    arestas += [Aresta(x, y, 0.95) for i, x in enumerate(b) for y in b[i + 1 :]]
    arestas.append(Aresta(4, 5, 0.10))       # a única ponte entre os dois

    return a + b, arestas


def test_separa_dois_blocos_evidentes():
    pessoas, arestas = dois_blocos()

    comunidades = grafo.detectar_comunidades(grafo.montar(pessoas, arestas))

    assert comunidades[1] == comunidades[2] == comunidades[3]
    assert comunidades[6] == comunidades[7] == comunidades[8]
    assert comunidades[1] != comunidades[6]


def test_duas_execucoes_dao_o_mesmo_resultado():
    """🔴 Sem semente fixa isto falha — e o TCC deixa de ser reproduzível."""
    pessoas, arestas = dois_blocos()
    g = grafo.montar(pessoas, arestas)

    assert grafo.detectar_comunidades(g) == grafo.detectar_comunidades(g)
    assert grafo.calcular_posicoes(g) == grafo.calcular_posicoes(g)


def test_comunidades_numeradas_por_tamanho():
    """⚠️ Sem ordem estável, a legenda da tela troca de cor entre execuções."""
    pessoas = [1, 2, 3, 4, 5]
    arestas = [
        Aresta(1, 2, 0.9), Aresta(2, 3, 0.9), Aresta(1, 3, 0.9),   # trio
        Aresta(4, 5, 0.9),                                          # dupla
    ]

    comunidades = grafo.detectar_comunidades(grafo.montar(pessoas, arestas))

    # ⭐ 0 é sempre a MAIOR comunidade
    assert comunidades[1] == 0
    assert comunidades[4] == 1


def test_deputado_sem_aresta_continua_no_grafo():
    """🔴 Quem não passou do mínimo da RN-02 com ninguém não pode SUMIR.

    ⚠️ Construir o grafo a partir das arestas o eliminaria em silêncio — e um deputado
    ausente do desenho, sem nada registrando o motivo, é exatamente o tipo de omissão
    que ninguém percebe olhando a tela.
    """
    pessoas = [1, 2, 3, 99]
    arestas = [Aresta(1, 2, 0.9), Aresta(2, 3, 0.9)]

    nos = grafo.calcular_nos(pessoas, arestas, {1: 40, 2: 40, 3: 40, 99: 3})

    assert {no.pessoa_id for no in nos} == {1, 2, 3, 99}
    isolado = next(no for no in nos if no.pessoa_id == 99)
    assert isolado.n_votacoes == 3


def test_todo_no_recebe_comunidade_e_posicao():
    pessoas, arestas = dois_blocos()

    nos = grafo.calcular_nos(pessoas, arestas, {p: 30 for p in pessoas})

    assert len(nos) == len(pessoas)
    for no in nos:
        assert no.comunidade >= 0
        assert isinstance(no.eixo_x, float)
        assert isinstance(no.eixo_y, float)


@pytest.mark.parametrize("atributo", ["eixo_x", "eixo_y"])
def test_posicoes_ficam_num_intervalo_desenhavel(atributo: str):
    """⚠️ O `spring_layout` normaliza em torno de [-1, 1]. A tela conta com isso."""
    pessoas, arestas = dois_blocos()

    nos = grafo.calcular_nos(pessoas, arestas, {})

    valores = [getattr(no, atributo) for no in nos]
    assert all(-1.5 <= v <= 1.5 for v in valores)
