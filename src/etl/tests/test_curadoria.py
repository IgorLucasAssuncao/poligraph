"""Seleção de candidatas a pergunta.

O que estes testes protegem: **este módulo não pode gravar pergunta**. Ele ordena e
instrui; a afirmação em linguagem leiga e a polaridade final são leitura humana (PL11).

O critério é discriminação: votação em que todos votaram igual não separa ninguém e
ocuparia uma das 15 a 25 posições do questionário sem devolver informação.
"""

from poligraph_etl.curadoria import Candidata


def candidata(sim: int, nao: int, descricao: str = "Aprovado o Projeto") -> Candidata:
    return Candidata(
        votacao_id="SF-1", data="2025-01-01", descricao=descricao,
        sim=sim, nao=nao, polaridade_sugerida=1,
    )


def test_divisao_maxima_e_metade():
    """Casa dividida ao meio é o teto: 0,5. Não existe votação mais divisiva que isso."""
    assert candidata(50, 50).divisao == 0.5


def test_unanimidade_nao_discrimina():
    """Zero significa que a votação não separa ninguém — é a pior candidata possível."""
    assert candidata(80, 0).divisao == 0.0


def test_a_divisao_nao_depende_de_qual_lado_ganhou():
    """40x60 e 60x40 discriminam igualmente: o que importa é o tamanho da minoria."""
    assert candidata(40, 60).divisao == candidata(60, 40).divisao


def test_votacao_sem_voto_nao_estoura():
    """Divisão por zero apareceria como candidata perfeita, no topo da lista."""
    assert candidata(0, 0).divisao == 0.0


def test_a_ordem_e_da_mais_dividida_para_a_menos():
    achadas = sorted(
        [candidata(80, 5), candidata(45, 44), candidata(60, 30)],
        key=lambda c: c.divisao, reverse=True,
    )

    assert [c.sim for c in achadas] == [45, 60, 80]


def test_o_modulo_nao_escreve_no_banco():
    """A polaridade é o campo mais perigoso do sistema.

    Atribuí-la automaticamente é o erro que o projeto persegue: um sinal invertido não
    aparece na tela, aparece como número plausível. Se alguém adicionar um `INSERT` ou
    `UPDATE` aqui, este teste denuncia.
    """
    from pathlib import Path

    fonte = Path("poligraph_etl/curadoria.py").read_text(encoding="utf-8").upper()

    assert "INSERT INTO" not in fonte
    assert "UPDATE " not in fonte
    assert "DELETE FROM" not in fonte
