"""Comunidades e layout.

RISCO: O que estes testes protegem, acima de tudo, é a **reprodutibilidade**. Louvain e o
layout de molas são estocásticos: sem semente fixa, duas execuções sobre o mesmo dado
dão comunidades e posições diferentes. Num TCC isso é fatal — a banca reproduz e não
bate.
"""

from dataclasses import dataclass

import pytest

from poligraph_etl import grafo


@dataclass(frozen=True)
class Aresta:
    """ATENÇÃO: Espelha o que `arestas_knn` devolve: `ParSimilar`."""

    pessoa_a: int
    pessoa_b: int
    valor: float


def dois_blocos() -> tuple[list[int], list[Aresta]]:
    """Dois grupos de 4, densos por dentro e ligados por um fio só.

    DECISÃO: É a estrutura mais simples em que "comunidade" tem resposta certa conhecida —
    se o algoritmo não separar isto, não separa nada.

    `arestas.append(Aresta(4, 5, 0.10))`: a única ponte entre os dois
    """
    a, b = [1, 2, 3, 4], [5, 6, 7, 8]
    arestas = [Aresta(x, y, 0.95) for i, x in enumerate(a) for y in a[i + 1 :]]
    arestas += [Aresta(x, y, 0.95) for i, x in enumerate(b) for y in b[i + 1 :]]
    arestas.append(Aresta(4, 5, 0.10))

    return a + b, arestas


def test_separa_dois_blocos_evidentes():
    pessoas, arestas = dois_blocos()

    comunidades = grafo.detectar_comunidades(grafo.montar(pessoas, arestas))

    assert comunidades[1] == comunidades[2] == comunidades[3]
    assert comunidades[6] == comunidades[7] == comunidades[8]
    assert comunidades[1] != comunidades[6]


def test_duas_execucoes_dao_o_mesmo_resultado():
    """RISCO: Sem semente fixa isto falha — e o TCC deixa de ser reproduzível."""
    pessoas, arestas = dois_blocos()
    g = grafo.montar(pessoas, arestas)

    assert grafo.detectar_comunidades(g) == grafo.detectar_comunidades(g)
    assert grafo.calcular_posicoes(g) == grafo.calcular_posicoes(g)


def test_comunidades_numeradas_por_tamanho():
    """ATENÇÃO: Sem ordem estável, a legenda da tela troca de cor entre execuções.

    `Aresta(1, 2, 0.9), Aresta(2, 3, 0.9), Aresta(1, 3, 0.9),`: trio

    `Aresta(4, 5, 0.9),`: dupla

    DECISÃO: 0 é sempre a MAIOR comunidade
    """
    pessoas = [1, 2, 3, 4, 5]
    arestas = [
        Aresta(1, 2, 0.9), Aresta(2, 3, 0.9), Aresta(1, 3, 0.9),
        Aresta(4, 5, 0.9),
    ]

    comunidades = grafo.detectar_comunidades(grafo.montar(pessoas, arestas))

    assert comunidades[1] == 0
    assert comunidades[4] == 1


def test_deputado_sem_aresta_continua_no_grafo():
    """RISCO: Quem não passou do mínimo da RN-02 com ninguém não pode SUMIR.

    ATENÇÃO: Construir o grafo a partir das arestas o eliminaria em silêncio — e um deputado
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
    """ATENÇÃO: O `spring_layout` normaliza em torno de [-1, 1]. A tela conta com isso."""
    pessoas, arestas = dois_blocos()

    nos = grafo.calcular_nos(pessoas, arestas, {})

    valores = [getattr(no, atributo) for no in nos]
    assert all(-1.5 <= v <= 1.5 for v in valores)


# ═══════════════════════════════════════════════════════════════════
# Componentes principais (SVD) — PL43
# ═══════════════════════════════════════════════════════════════════

import numpy as np


def test_componentes_separam_padroes_opostos():
    """DECISÃO: Quatro padrões de voto distintos viram quatro cantos.

    os dois primeiros concordam no eixo 1 e discordam no 2
    """
    matriz = np.array(
        [[1, 1, 1, -1], [1, 1, -1, -1], [-1, -1, 1, 1], [-1, -1, -1, 1]],
        dtype=float,
    )

    c = grafo.calcular_componentes(matriz)

    assert np.sign(c[0, 0]) == np.sign(c[1, 0])
    assert np.sign(c[0, 0]) != np.sign(c[2, 0])


def test_componentes_sao_reproduziveis():
    """RISCO: O sinal do SVD é arbitrário: `u` e `-u` são igualmente válidos.

    ATENÇÃO: Sem a convenção de sinal, o desenho sairia ESPELHADO entre execuções — a
    "esquerda" da figura viraria a "direita" sem nada ter mudado nos dados. Num TCC,
    a banca reproduz e vê outra figura.
    """
    matriz = np.random.default_rng(7).choice([-1.0, 1.0], size=(20, 12))

    assert np.allclose(
        grafo.calcular_componentes(matriz), grafo.calcular_componentes(matriz)
    )


def test_componentes_ficam_no_intervalo_da_tela():
    matriz = np.random.default_rng(3).choice([-1.0, 1.0], size=(30, 15))

    c = grafo.calcular_componentes(matriz)

    assert np.all(np.abs(c) <= 1.0 + 1e-9)


def test_ausencia_nao_quebra_o_svd():
    """ATENÇÃO: `nan` vira 0 — o ponto neutro entre -1 e +1. É limitação registrada,
    não descuido: o correto seria imputação."""
    matriz = np.array([[1, np.nan, 1], [-1, -1, np.nan], [1, 1, -1]], dtype=float)

    c = grafo.calcular_componentes(matriz)

    assert np.all(np.isfinite(c))


def test_no_carrega_as_duas_posicoes():
    """DECISÃO: PL43: molas e componentes convivem, e a tela escolhe."""
    pessoas, arestas = dois_blocos()
    matriz = np.random.default_rng(1).choice([-1.0, 1.0], size=(len(pessoas), 25))

    nos = grafo.calcular_nos(pessoas, arestas, {}, matriz)

    for no in nos:
        assert isinstance(no.eixo_x, float)
        assert isinstance(no.componente_1, float)


def test_o_segundo_eixo_fica_menor_quando_explica_menos():
    """RISCO: O bug que fez o SVD "ficar esquisito".

    ATENÇÃO: Normalizar cada eixo pelo próprio máximo dá ao componente 2 a MESMA altura do
    componente 1 na tela — mesmo ele explicando 9,6% da variância contra 34,6%. Ruído
    desenhado do tamanho do sinal.

    DECISÃO: Com divisor único, a figura fica achatada na proporção em que o segundo eixo
    importa menos. É essa a forma verdadeira.

    dado com muito mais variância no primeiro eixo que no segundo
    """
    gerador = np.random.default_rng(11)
    principal = gerador.choice([-1.0, 1.0], size=(60, 1))
    matriz = np.hstack([np.tile(principal, (1, 30)), gerador.normal(0, 0.05, (60, 30))])

    c = grafo.calcular_componentes(matriz)

    amplitude_1 = float(np.ptp(c[:, 0]))
    amplitude_2 = float(np.ptp(c[:, 1]))

    assert amplitude_2 < amplitude_1 / 2, (
        f"eixo 2 ocupa {amplitude_2:.2f} contra {amplitude_1:.2f} do eixo 1 — "
        "os dois estão sendo normalizados à parte"
    )


def test_quem_faltou_e_puxado_para_o_centro():
    """RISCO: A limitação que o centro da figura esconde, travada em teste.

    ATENÇÃO: Não é bug: `nan` vira 0, e depois de centrar o zero fica perto da média. Quem
    faltou muito cai no meio do desenho — e o centro passa a misturar quem é moderado
    com quem não votou.

    DECISÃO: O teste existe para que a limitação seja EXPLÍCITA. Se alguém trocar o
    preenchimento por imputação, ele falha e obriga a revisitar o texto da tela.

    20 deputados com posição forte, 5 que faltaram em quase tudo
    """
    gerador = np.random.default_rng(5)
    fortes = gerador.choice([-1.0, 1.0], size=(20, 1)) * np.ones((20, 40))
    faltosos = np.full((5, 40), np.nan)
    faltosos[:, :4] = 1.0

    c = grafo.calcular_componentes(np.vstack([fortes, faltosos]))

    distancia_dos_fortes = np.mean(np.abs(c[:20, 0]))
    distancia_dos_faltosos = np.mean(np.abs(c[20:, 0]))

    assert distancia_dos_faltosos < distancia_dos_fortes
