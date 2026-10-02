"""Testes da similaridade e do grafo.

ATENÇÃO: Cada constante testada aqui veio de medição no discovery, não de escolha estética.
"""

import numpy as np
import pytest

from poligraph_etl.similaridade import (
    MINIMO_VOTACOES_COMUNS,
    PESO_CATEGORIA,
    RAZAO_RECENCIA,
    ParSimilar,
    arestas_knn,
    calcular_pares,
    concordancia_simples,
    cosseno,
    peso_da_votacao,
)

UM = np.ones(30)


# ═══════════════════════════════════════════════════════════════════
# Concordância simples — a métrica que vai para a tela
# ═══════════════════════════════════════════════════════════════════


def test_votos_identicos_dao_um():
    votos = np.array([1.0, -1.0, 1.0] * 10)
    valor, n = concordancia_simples(votos, votos, UM)

    assert valor == pytest.approx(1.0)
    assert n == 30


def test_votos_opostos_dao_zero():
    a = np.array([1.0] * 30)
    b = np.array([-1.0] * 30)
    valor, _ = concordancia_simples(a, b, UM)

    assert valor == pytest.approx(0.0)


def test_metade_igual_da_meio():
    a = np.array([1.0] * 30)
    b = np.array([1.0] * 15 + [-1.0] * 15)
    valor, n = concordancia_simples(a, b, UM)

    assert valor == pytest.approx(0.5)
    assert n == 30


# ═══════════════════════════════════════════════════════════════════
# RISCO: O que sai do denominador
# ═══════════════════════════════════════════════════════════════════


def test_ausencia_sai_da_conta_nao_conta_como_desacordo():
    """ATENÇÃO: Se ausência contasse como desacordo, o grafo mediria presença."""
    a = np.array([1.0, 1.0, np.nan, 1.0])
    b = np.array([1.0, 1.0, -1.0, 1.0])

    valor, n = concordancia_simples(a, b, np.ones(4))

    assert n == 3                       # DECISÃO: não 4
    assert valor == pytest.approx(1.0)  # DECISÃO: não 0,75


def test_abstencao_sai_da_conta():
    a = np.array([1.0, 0.0, 1.0, 1.0])
    b = np.array([1.0, 1.0, 1.0, 1.0])

    _, n = concordancia_simples(a, b, np.ones(4))

    assert n == 3


def test_votacao_procedimental_sai_da_matriz():
    """Não Peso 0: mede obstrução, não posição."""
    a = np.array([1.0, 1.0, 1.0])
    b = np.array([1.0, -1.0, 1.0])
    pesos = np.array([1.0, 0.0, 1.0])   # a do meio é PROCEDIMENTAL

    valor, n = concordancia_simples(a, b, pesos)

    assert n == 2
    assert valor == pytest.approx(1.0)


# ═══════════════════════════════════════════════════════════════════
# Pesos medidos
# ═══════════════════════════════════════════════════════════════════


def test_procedimental_tem_peso_zero():
    assert PESO_CATEGORIA["PROCEDIMENTAL"] == 0.0


def test_destaque_entra_na_matriz():
    """RISCO: O que sustenta o grafo NÃO é o valor do peso: é o destaque estar dentro.

    MEDIDO: Medido em 2026-08-29 sobre a matriz real (643 × 1.122), comparando os 10 vizinhos
    mais próximos de cada deputado contra o peso atual:

    | Peso | Sobreposição |
    |---|---|
    | RISCO: **0,0** | **2,00 de 10 (20%)** |
    | 0,3 | 8,28 de 10 (82,8%) |
    | 0,5 | 9,18 de 10 (91,8%) |
    | 0,9 | 9,40 de 10 (94,0%) |
    | 1,0 | 9,23 de 10 (92,3%) |

    DECISÃO: **Qualquer valor entre 0,3 e 1,0 devolve 83% a 94% da mesma vizinhança** — o `0,7`
    não é escolha delicada. Não **Zerar reescreve o grafo**: sobram 2 dos 10 vizinhos,
    porque a matriz tem 422 destaques contra 141 substantivas.

    ATENÇÃO: Este teste não trava o VALOR, de propósito — travar 0,7 fingiria uma precisão
    que a medição desmente. Trava o que ela mostrou importar.

    MEDIDO: [achado #30](../../../docs/achados/030-o-destaque-carrega-o-grafo.md)
    """
    assert PESO_CATEGORIA["DESTAQUE"] > 0.0


def test_substantiva_pesa_mais_que_destaque_que_pesa_mais_que_autoridade():
    assert (
        PESO_CATEGORIA["SUBSTANTIVA"]
        > PESO_CATEGORIA["DESTAQUE"]
        > PESO_CATEGORIA["AUTORIDADE"]
        > PESO_CATEGORIA["PROCEDIMENTAL"]
    )


def test_recencia_decai_na_razao_medida():
    """DECISÃO: r = 0,86 vem da correlação de posição entre anos (discovery §7.4.1)."""
    assert peso_da_votacao("SUBSTANTIVA", 0) == pytest.approx(1.0)
    assert peso_da_votacao("SUBSTANTIVA", 1) == pytest.approx(RAZAO_RECENCIA)
    assert peso_da_votacao("SUBSTANTIVA", 2) == pytest.approx(RAZAO_RECENCIA**2)


def test_votacao_recente_pesa_mais_que_antiga():
    assert peso_da_votacao("SUBSTANTIVA", 0) > peso_da_votacao("SUBSTANTIVA", 3)


# ═══════════════════════════════════════════════════════════════════
# Cosseno — vai para o grafo
# ═══════════════════════════════════════════════════════════════════


def test_cosseno_fica_no_intervalo_que_o_banco_aceita():
    """ATENÇÃO: `ck_sim_valor` exige [0, 1]. O cosseno cru vive em [-1, 1]."""
    a = np.array([1.0] * 30)
    b = np.array([-1.0] * 30)

    valor, _ = cosseno(a, b, UM)

    assert 0.0 <= valor <= 1.0
    assert valor == pytest.approx(0.0)   # oposto perfeito → 0 após reescala


def test_cosseno_de_identicos_da_um():
    votos = np.array([1.0, -1.0] * 15)
    valor, _ = cosseno(votos, votos, UM)

    assert valor == pytest.approx(1.0)


# ═══════════════════════════════════════════════════════════════════
# RN-02 e I3
# ═══════════════════════════════════════════════════════════════════


def test_par_com_poucas_votacoes_comuns_e_descartado():
    """RN-02 — o banco também tem CHECK para isto."""
    matriz = np.array([[1.0] * 19 + [np.nan], [1.0] * 19 + [np.nan]])
    pares = calcular_pares(matriz, [1, 2], np.ones(20))

    assert pares == []


def test_par_com_exatamente_o_minimo_e_mantido():
    matriz = np.array([[1.0] * MINIMO_VOTACOES_COMUNS] * 2)
    pares = calcular_pares(matriz, [1, 2], np.ones(MINIMO_VOTACOES_COMUNS))

    assert len(pares) == 1
    assert pares[0].n_votacoes_comuns == MINIMO_VOTACOES_COMUNS


def test_par_sai_sempre_com_a_menor_pessoa_primeiro():
    """I3 — aresta não-direcionada, gravada uma vez."""
    matriz = np.array([[1.0] * 30] * 2)
    pares = calcular_pares(matriz, [99, 7], np.ones(30))

    assert pares[0].pessoa_a == 7
    assert pares[0].pessoa_b == 99
    assert pares[0].pessoa_a < pares[0].pessoa_b


# ═══════════════════════════════════════════════════════════════════
# DECISÃO: kNN — por que não limiar global
# ═══════════════════════════════════════════════════════════════════


def test_knn_limita_o_grau_de_cada_no():
    # 6 pessoas, todos os pares: 15 arestas
    pares = [
        ParSimilar(a, b, "CONCORDANCIA", 0.5 + (a + b) / 100, 30)
        for a in range(1, 7)
        for b in range(a + 1, 7)
    ]

    mantidas = arestas_knn(pares, k=2)

    assert len(mantidas) < len(pares)
    assert all(p.pessoa_a < p.pessoa_b for p in mantidas)


def test_knn_mantem_a_aresta_mais_forte_de_quem_tem_escolha():
    pares = [
        ParSimilar(1, 2, "CONCORDANCIA", 0.95, 30),
        ParSimilar(1, 3, "CONCORDANCIA", 0.90, 30),
        ParSimilar(1, 4, "CONCORDANCIA", 0.10, 30),
    ]

    mantidas = arestas_knn(pares, k=1)

    # a pessoa 1 tem três opções e escolhe a mais forte
    assert any(p.valor == 0.95 for p in mantidas)


def test_knn_e_uniao_nao_intersecao_e_isso_e_deliberado():
    """RISCO: A aresta sobrevive se QUALQUER um dos dois a escolheu.

    ATENÇÃO: Meu teste anterior supunha o contrário: que a aresta fraca (1,4) seria
    descartada. Não é — e a razão importa para o grafo.

    A pessoa 4 tem UMA única aresta possível. Numa regra de interseção (a aresta só
    sobrevive se AMBOS a escolherem), ela ficaria ISOLADA: um deputado sumiria da
    visualização por ter votado diferente de todo mundo — que é justamente o caso
    mais interessante de mostrar.

    DECISÃO: União garante grau ≥ 1 para todo nó. O preço é que um nó popular pode passar
    de k vizinhos, o que é aceitável: o grafo continua esparso e legível.
    """
    pares = [
        ParSimilar(1, 2, "CONCORDANCIA", 0.95, 30),
        ParSimilar(1, 3, "CONCORDANCIA", 0.90, 30),
        ParSimilar(1, 4, "CONCORDANCIA", 0.10, 30),   # única aresta da pessoa 4
    ]

    mantidas = arestas_knn(pares, k=1)
    pessoas_com_aresta = {p.pessoa_a for p in mantidas} | {p.pessoa_b for p in mantidas}

    assert 4 in pessoas_com_aresta, "nenhum parlamentar pode ficar isolado do grafo"


def test_knn_nao_isola_ninguem():
    """Todo parlamentar com ao menos um par válido aparece no grafo."""
    pares = [
        ParSimilar(1, 2, "CONCORDANCIA", 0.99, 30),
        ParSimilar(1, 3, "CONCORDANCIA", 0.98, 30),
        ParSimilar(2, 3, "CONCORDANCIA", 0.97, 30),
        ParSimilar(1, 9, "CONCORDANCIA", 0.05, 30),   # o "diferentão"
    ]

    mantidas = arestas_knn(pares, k=2)
    presentes = {p.pessoa_a for p in mantidas} | {p.pessoa_b for p in mantidas}

    assert {1, 2, 3, 9} <= presentes


def test_knn_nao_produz_aresta_duplicada():
    pares = [
        ParSimilar(1, 2, "CONCORDANCIA", 0.9, 30),
        ParSimilar(1, 3, "CONCORDANCIA", 0.8, 30),
        ParSimilar(2, 3, "CONCORDANCIA", 0.7, 30),
    ]

    mantidas = arestas_knn(pares, k=2)
    chaves = [(p.pessoa_a, p.pessoa_b) for p in mantidas]

    assert len(chaves) == len(set(chaves))


def test_parametros_gravados_sao_os_que_o_calculo_usa():
    """RISCO: A metodologia mostra o que a execução gravou — e ela grava as constantes do cálculo.

    ATENÇÃO: Se alguém mudar o peso do destaque, a página muda junto, sem ninguém editar texto.
    """
    from poligraph_etl import similaridade

    assert similaridade.parametros() == {
        "minimo_votacoes_comuns": similaridade.MINIMO_VOTACOES_COMUNS,
        "razao_recencia": similaridade.RAZAO_RECENCIA,
        "peso_destaque": similaridade.PESO_CATEGORIA["DESTAQUE"],
        "peso_autoridade": similaridade.PESO_CATEGORIA["AUTORIDADE"],
    }
