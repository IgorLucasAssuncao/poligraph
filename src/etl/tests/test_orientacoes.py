"""Orientação de bancada — o que transforma "votou Sim" em posição.

🔴 O risco aqui é o mesmo da polaridade: um alinhamento invertido ⛔ não aparece na
tela. Aparece como um governismo de 0,82 que deveria ser 0,18, e ninguém percebe.
"""

from poligraph_etl import orientacoes


def linha(votacao="2162802-89", bancada="Governo", orientacao="Sim") -> dict:
    return {"idVotacao": votacao, "siglaBancada": bancada, "orientacao": orientacao}


CONHECIDAS = {"2162802-89", "2162802-90"}


# ═══════════════════════════════════════════════════════════════════
# TRATAMENTO
# ═══════════════════════════════════════════════════════════════════


def test_orientacao_vazia_e_descartada():
    """⚠️ 24% das linhas de 2025 vêm com orientação vazia.

    Vazio ⛔ não é "Liberado": gravá-lo como se fosse inventaria uma decisão que a
    bancada não tomou, e ela entraria no denominador de disciplina.
    """
    linhas = orientacoes.para_linhas([linha(orientacao="")], CONHECIDAS)

    assert linhas == []


def test_votacao_fora_da_base_e_descartada():
    """Orientação sem votação ⛔ não mede o alinhamento de ninguém."""
    linhas = orientacoes.para_linhas([linha(votacao="999-1")], CONHECIDAS)

    assert linhas == []


def test_par_repetido_nao_duplica():
    """⚠️ A fonte repete (votação, bancada) quando a votação tem mais de um objeto.

    Deduplicar aqui, e ⛔ não só no `ON CONFLICT`, mantém verdadeira a contagem do log.
    """
    linhas = orientacoes.para_linhas([linha(), linha()], CONHECIDAS)

    assert len(linhas) == 1


def test_bancada_com_espaco_extra_e_normalizada():
    linhas = orientacoes.para_linhas(
        [linha(bancada="  Bl  AvanSolidPrd  ")], CONHECIDAS
    )

    assert linhas[0]["bancada"] == "Bl AvanSolidPrd"


def test_obstrucao_e_liberado_sao_gravados():
    """⭐ Gravados como dado; quem os exclui do cálculo é `alinhamento`."""
    linhas = orientacoes.para_linhas(
        [linha(orientacao="Obstrução"), linha(bancada="Novo", orientacao="Liberado")],
        CONHECIDAS,
    )

    assert {l["orientacao"] for l in linhas} == {"Obstrução", "Liberado"}


# ═══════════════════════════════════════════════════════════════════
# 🔴 ALINHAMENTO — onde um sinal invertido não apareceria
# ═══════════════════════════════════════════════════════════════════


def test_seguir_a_orientacao_conta_como_alinhado():
    seguiu, base = orientacoes.alinhamento(
        {"a": 1, "b": -1},
        {"a": {"Governo": "Sim"}, "b": {"Governo": "Não"}},
        "Governo",
    )

    assert (seguiu, base) == (2, 2)


def test_contrariar_a_orientacao_nao_conta():
    """🔴 O teste que pega o sinal invertido.

    Votar Sim quando o Governo pediu Não é o OPOSTO de governismo. Trocar a comparação
    daria 1 de 1 — um número plausível e exatamente errado.
    """
    seguiu, base = orientacoes.alinhamento(
        {"a": 1}, {"a": {"Governo": "Não"}}, "Governo"
    )

    assert (seguiu, base) == (0, 1)


def test_obstrucao_sai_do_denominador():
    """⭐ Obstrução é tática de quórum, ⛔ não posição de mérito.

    Contá-la como "Não" transformaria manobra regimental em discordância de conteúdo.
    """
    seguiu, base = orientacoes.alinhamento(
        {"a": -1}, {"a": {"Governo": "Obstrução"}}, "Governo"
    )

    assert (seguiu, base) == (0, 0)


def test_liberado_sai_do_denominador():
    """⛔ Não houve orientação a seguir — não há o que medir."""
    seguiu, base = orientacoes.alinhamento(
        {"a": 1}, {"a": {"Governo": "Liberado"}}, "Governo"
    )

    assert (seguiu, base) == (0, 0)


def test_abstencao_do_parlamentar_sai_do_denominador():
    """Ausência ⛔ não é desobediência — a mesma regra da afinidade."""
    seguiu, base = orientacoes.alinhamento(
        {"a": 0}, {"a": {"Governo": "Sim"}}, "Governo"
    )

    assert (seguiu, base) == (0, 0)


def test_votacao_sem_orientacao_da_bancada_sai():
    """A bancada não orientou aquela votação: nada a comparar."""
    seguiu, base = orientacoes.alinhamento(
        {"a": 1}, {"a": {"Oposição": "Sim"}}, "Governo"
    )

    assert (seguiu, base) == (0, 0)


def test_devolve_o_par_e_nunca_a_proporcao():
    """
    ⭐ `12 de 15` e `800 de 1000` dão 0,8 os dois. Só o par distingue o deputado que
    participou de tudo daquele que apareceu quinze vezes — e é a base que a tela precisa
    exibir junto do número.
    """
    votos = {f"v{i}": 1 for i in range(15)}
    orient = {f"v{i}": {"Governo": "Sim" if i < 12 else "Não"} for i in range(15)}

    assert orientacoes.alinhamento(votos, orient, "Governo") == (12, 15)


def test_bancada_inexistente_devolve_base_zero():
    """⛔ Quem não tem partido conhecido fica sem disciplina, ⛔ não com disciplina zero."""
    seguiu, base = orientacoes.alinhamento({"a": 1}, {"a": {"Governo": "Sim"}}, "")

    assert (seguiu, base) == (0, 0)
