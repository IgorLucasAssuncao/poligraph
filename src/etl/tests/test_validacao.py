"""O experimento de recuperação.

ATENÇÃO: A aritmética da concordância é feita em matriz, e matriz erra em silêncio: um sinal
trocado não estoura, devolve número plausível. Estes testes conferem o resultado contra
casos calculados à mão.
"""

import numpy as np
import pytest

from poligraph_etl import validacao

NAN = np.nan


def test_concordancia_perfeita_deixa_o_topo_lotado():
    """DECISÃO: Três deputados que votaram idêntico: cada um empata com os outros dois."""
    matriz = np.array(
        [
            [1, -1, 1],
            [1, -1, 1],
            [1, -1, 1],
        ],
        dtype=float,
    )

    r = validacao.avaliar(matriz, [0, 1, 2])

    assert r.deputados_avaliados == 3
    assert r.empate_mediano == 3
    assert r.unicos == 0


def test_deputado_com_padrao_proprio_fica_sozinho_no_topo():
    """RISCO: O caso que o instrumento precisa acertar: quem vota diferente é distinguível.

    `[-1, -1, -1, -1],`: o divergente

    o divergente é único no topo; os dois iguais empatam entre si
    """
    matriz = np.array(
        [
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [-1, -1, -1, -1],
        ],
        dtype=float,
    )

    r = validacao.avaliar(matriz, [0, 1, 2, 3])

    assert r.unicos == 1


def test_mais_perguntas_desafogam_o_topo():
    """DECISÃO: O achado que o experimento existe para produzir.

    Com uma pergunta, todo mundo que votou igual empata. Com quatro, os padrões se
    separam. É por isso que a medida é o TAMANHO DO EMPATE, não a posição.
    """
    matriz = np.array(
        [
            [1, 1, 1, 1],
            [1, 1, 1, -1],
            [1, 1, -1, -1],
            [1, -1, -1, -1],
        ],
        dtype=float,
    )

    com_uma = validacao.avaliar(matriz, [0])
    com_quatro = validacao.avaliar(matriz, [0, 1, 2, 3])

    assert com_uma.empate_medio > com_quatro.empate_medio
    assert com_quatro.unicos > com_uma.unicos


def test_ausencia_nao_conta_como_discordancia():
    """RISCO: A regra que atravessa o projeto inteiro.

    ATENÇÃO: Tratar `nan` como voto contrário faria o instrumento medir PRESENÇA em vez de
    afinidade — e deputado faltoso viraria "discordante de todos".

    DECISÃO: A afirmação é sobre QUEM FALTOU, não sobre o tamanho do empate: quem respondeu
    2 de 4 e concordou nas 2 continua encontrando par. O piso de base comparável age
    do outro lado — impede que ELE seja oferecido como par a quem respondeu tudo.

    os dois entram na avaliação; ninguém foi eliminado por ter faltado
    """
    ausente = np.array([[1, 1, NAN, NAN], [1, 1, 1, 1]], dtype=float)

    r = validacao.avaliar(ausente, [0, 1, 2, 3])

    assert r.deputados_avaliados == 2


def test_abstencao_tambem_fica_de_fora():
    """ATENÇÃO: 0 é abstenção declarada — não é meio-termo entre Sim e Não.

    compara só as colunas 0 e 2, em que ambos se posicionaram
    """
    matriz = np.array([[1, 0, 1], [1, 1, 1]], dtype=float)

    r = validacao.avaliar(matriz, [0, 1, 2])

    assert r.deputados_avaliados == 2


def test_quem_nao_respondeu_o_minimo_fica_de_fora():
    matriz = np.array([[1, 1, 1], [NAN, NAN, NAN]], dtype=float)

    r = validacao.avaliar(matriz, [0, 1, 2], minimo_respostas=1)

    assert r.deputados_avaliados == 1


def test_curva_e_reproduzivel():
    """RISCO: Sorteio com semente fixa — senão a curva do TCC muda a cada execução."""
    matriz = np.random.default_rng(1).choice([-1.0, 1.0], size=(30, 20))

    primeira = validacao.curva_de_discriminacao(matriz, list(range(20)), [5, 10])
    segunda = validacao.curva_de_discriminacao(matriz, list(range(20)), [5, 10])

    assert primeira == segunda


@pytest.mark.parametrize(
    ("coluna", "esperado"),
    [(0, 0.5), (1, 0.0)],
)
def test_divisao_mede_quanto_a_pergunta_informa(coluna: int, esperado: float):
    matriz = np.array([[1, 1], [1, 1], [-1, 1], [-1, 1]], dtype=float)

    assert validacao.divisao(matriz, coluna) == esperado


def test_quem_faltou_demais_nao_empata_no_topo():
    """RISCO: O erro que a primeira medição cometeu, agora travado.

    ATENÇÃO: Sem piso de base comparável, o deputado que faltou em quase tudo e concordou no
    pouco que compareceu marca concordância 1,0 e empata com quem respondeu tudo. A
    primeira rodada do experimento deu empate mediano de 90 por causa disso; a
    conferência direta no banco dava no máximo 8.

    DECISÃO: O piso é o MESMO da API (`TemBaseSuficiente`): 60% do que a pessoa respondeu.

    `[1, 1, 1, 1, 1],`: respondeu tudo

    `[-1, -1, -1, -1, -1],`: discorda em tudo

    `[1, NAN, NAN, NAN, NAN],`: concordou em 1 de 5 — não pode empatar

    o primeiro fica SOZINHO no topo: o terceiro não tem base para empatar com ele
    """
    matriz = np.array(
        [
            [1, 1, 1, 1, 1],
            [-1, -1, -1, -1, -1],
            [1, NAN, NAN, NAN, NAN],
        ],
        dtype=float,
    )

    r = validacao.avaliar(matriz, [0, 1, 2, 3, 4])

    assert r.unicos >= 1


# ═══════════════════════════════════════════════════════════════════
# Desempate dirigido
# ═══════════════════════════════════════════════════════════════════


def test_escolhe_a_pergunta_que_divide_O_GRUPO_nao_a_camara():
    """RISCO: A diferença entre o nível A e o nível C do `plano/03`.

    ATENÇÃO: A coluna 0 racha a matriz inteira ao meio, mas é UNÂNIME dentro do grupo que
    empatou — não desempata nada. A coluna 1 é quase unânime no geral e divide o grupo
    exatamente ao meio. Escolher pela divisão global pegaria a errada.

    `[1, 1, 1],`: ┐ o grupo empatado

    `[1, -1, 1],`: ┘
    """
    matriz = np.array(
        [
            [1, 1, 1],
            [1, -1, 1],
            [-1, 1, 1],
            [-1, 1, 1],
        ],
        dtype=float,
    )
    grupo = np.array([0, 1])

    assert validacao.melhor_pergunta_para_dividir(matriz, grupo, [0, 1]) == 1


def test_sem_pergunta_que_divida_devolve_nada():
    """ATENÇÃO: Acontece: se os empatados votaram idêntico em tudo, insistir faria a pessoa
    responder à toa."""
    matriz = np.array([[1, 1], [1, 1]], dtype=float)

    assert validacao.melhor_pergunta_para_dividir(matriz, np.array([0, 1]), [0, 1]) is None


def test_grupo_de_um_nao_precisa_de_desempate():
    matriz = np.array([[1, -1], [1, 1]], dtype=float)

    assert validacao.melhor_pergunta_para_dividir(matriz, np.array([0]), [0, 1]) is None


def test_empatados_com_respeita_o_piso_de_base():
    """RISCO: O mesmo piso da API — quem faltou demais não entra no empate.

    `[1, NAN, NAN, NAN, NAN],`: concordou em 1 de 5
    """
    matriz = np.array(
        [
            [1, 1, 1, 1, 1],
            [1, NAN, NAN, NAN, NAN],
        ],
        dtype=float,
    )

    grupo = validacao.empatados_com(matriz, {0: 1, 1: 1, 2: 1, 3: 1, 4: 1})

    assert grupo.tolist() == [0]


def test_desempate_dirigido_encolhe_o_grupo():
    """DECISÃO: O efeito que a contribuição do trabalho promete.

    8 deputados, todos idênticos na coluna 0 e distinguíveis nas demais

    `assert tamanhos[0] == 8`: com só a coluna 0, todos empatam
    """
    matriz = np.array(
        [[1] + [1 if (i >> b) & 1 else -1 for b in range(3)] for i in range(8)],
        dtype=float,
    )

    tamanhos = validacao.simular_desempate(matriz, quem=0, base=[0], candidatas=[1, 2, 3])

    assert tamanhos[0] == 8
    assert tamanhos[-1] < tamanhos[0]
