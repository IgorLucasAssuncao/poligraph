"""Orientação de bancada — o que transforma "votou Sim" em posição.

RISCO: O risco aqui é o mesmo da polaridade: um alinhamento invertido não aparece na
tela. Aparece como um governismo de 0,82 que deveria ser 0,18, e ninguém percebe.
"""

import json
from pathlib import Path

import pytest

from poligraph_etl import orientacoes


def linha(votacao="2162802-89", bancada="Governo", orientacao="Sim") -> dict:
    return {"idVotacao": votacao, "siglaBancada": bancada, "orientacao": orientacao}


CONHECIDAS = {"2162802-89", "2162802-90"}


# ═══════════════════════════════════════════════════════════════════
# TRATAMENTO
# ═══════════════════════════════════════════════════════════════════


def test_orientacao_vazia_e_descartada():
    """ATENÇÃO: 24% das linhas de 2025 vêm com orientação vazia.

    Vazio não é "Liberado": gravá-lo como se fosse inventaria uma decisão que a
    bancada não tomou, e ela entraria no denominador de disciplina.
    """
    linhas = orientacoes.para_linhas([linha(orientacao="")], CONHECIDAS)

    assert linhas == []


def test_votacao_fora_da_base_e_descartada():
    """Orientação sem votação não mede o alinhamento de ninguém."""
    linhas = orientacoes.para_linhas([linha(votacao="999-1")], CONHECIDAS)

    assert linhas == []


def test_par_repetido_nao_duplica():
    """ATENÇÃO: A fonte repete (votação, bancada) quando a votação tem mais de um objeto.

    Deduplicar aqui, e não só no `ON CONFLICT`, mantém verdadeira a contagem do log.
    """
    linhas = orientacoes.para_linhas([linha(), linha()], CONHECIDAS)

    assert len(linhas) == 1


def test_bancada_com_espaco_extra_e_normalizada():
    linhas = orientacoes.para_linhas(
        [linha(bancada="  Bl  AvanSolidPrd  ")], CONHECIDAS
    )

    assert linhas[0]["bancada"] == "Bl AvanSolidPrd"


def test_obstrucao_e_liberado_sao_gravados():
    """DECISÃO: Gravados como dado; quem os exclui do cálculo é `alinhamento`."""
    linhas = orientacoes.para_linhas(
        [linha(orientacao="Obstrução"), linha(bancada="Novo", orientacao="Liberado")],
        CONHECIDAS,
    )

    assert {l["orientacao"] for l in linhas} == {"Obstrução", "Liberado"}


# ═══════════════════════════════════════════════════════════════════
# RISCO: ALINHAMENTO — onde um sinal invertido não apareceria
# ═══════════════════════════════════════════════════════════════════


def test_seguir_a_orientacao_conta_como_alinhado():
    seguiu, base = orientacoes.alinhamento(
        {"a": 1, "b": -1},
        {"a": {"Governo": "Sim"}, "b": {"Governo": "Não"}},
        "Governo",
    )

    assert (seguiu, base) == (2, 2)


def test_contrariar_a_orientacao_nao_conta():
    """RISCO: O teste que pega o sinal invertido.

    Votar Sim quando o Governo pediu Não é o OPOSTO de governismo. Trocar a comparação
    daria 1 de 1 — um número plausível e exatamente errado.
    """
    seguiu, base = orientacoes.alinhamento(
        {"a": 1}, {"a": {"Governo": "Não"}}, "Governo"
    )

    assert (seguiu, base) == (0, 1)


def test_obstrucao_sai_do_denominador():
    """DECISÃO: Obstrução é tática de quórum, não posição de mérito.

    Contá-la como "Não" transformaria manobra regimental em discordância de conteúdo.
    """
    seguiu, base = orientacoes.alinhamento(
        {"a": -1}, {"a": {"Governo": "Obstrução"}}, "Governo"
    )

    assert (seguiu, base) == (0, 0)


def test_liberado_sai_do_denominador():
    """Não houve orientação a seguir — não há o que medir."""
    seguiu, base = orientacoes.alinhamento(
        {"a": 1}, {"a": {"Governo": "Liberado"}}, "Governo"
    )

    assert (seguiu, base) == (0, 0)


def test_abstencao_do_parlamentar_sai_do_denominador():
    """Ausência não é desobediência — a mesma regra da afinidade."""
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
    DECISÃO: `12 de 15` e `800 de 1000` dão 0,8 os dois. Só o par distingue o deputado que
    participou de tudo daquele que apareceu quinze vezes — e é a base que a tela precisa
    exibir junto do número.
    """
    votos = {f"v{i}": 1 for i in range(15)}
    orient = {f"v{i}": {"Governo": "Sim" if i < 12 else "Não"} for i in range(15)}

    assert orientacoes.alinhamento(votos, orient, "Governo") == (12, 15)


def test_bancada_inexistente_devolve_base_zero():
    """Não Quem não tem partido conhecido fica sem disciplina, não com disciplina zero."""
    seguiu, base = orientacoes.alinhamento({"a": 1}, {"a": {"Governo": "Sim"}}, "")

    assert (seguiu, base) == (0, 0)


# ═══════════════════════════════════════════════════════════════════
# RISCO: Achado #36 — de que bancada é a orientação do partido
# ═══════════════════════════════════════════════════════════════════

from poligraph_etl.orientacoes import bancada_do_partido, disciplina  # noqa: E402


def test_pt_e_medido_pela_federacao():
    """MEDIDO: Na 57ª, "PT" sozinho não aparece: o PT orienta como `Fdr PT-PCdoB-PV`."""
    bancadas = ["Governo", "Fdr PT-PCdoB-PV", "PL", "Bl UniPpPsd..."]

    assert bancada_do_partido("PT", bancadas) == "Fdr PT-PCdoB-PV"
    assert bancada_do_partido("PCdoB", bancadas) == "Fdr PT-PCdoB-PV"
    assert bancada_do_partido("PV", bancadas) == "Fdr PT-PCdoB-PV"


def test_federacao_com_nome_cortado():
    assert bancada_do_partido("CIDADANIA", ["Fdr PSDB-CIDADAN"]) == "Fdr PSDB-CIDADAN"


def test_a_propria_sigla_vence_a_federacao():
    assert bancada_do_partido("PT", ["Fdr PT-PCdoB-PV", "PT"]) == "PT"


def test_caixa_e_acento_nao_importam():
    assert bancada_do_partido("NOVO", ["Novo"]) == "Novo"
    assert bancada_do_partido("UNIÃO", ["União"]) == "União"


def test_nome_cortado_pela_fonte_casa_com_a_sigla_inteira():
    assert bancada_do_partido("SOLIDARIEDADE", ["Solidaried"]) == "Solidaried"
    assert bancada_do_partido("REPUBLICANOS", ["Republican"]) == "Republican"


def test_sigla_curta_nao_casa_com_outra_que_comeca_igual():
    """`PSD` não pode ser lido como o começo de `PSDB`."""
    assert bancada_do_partido("PSDB", ["PSD"]) is None
    assert bancada_do_partido("PSD", ["PSDB"]) is None


def test_bloco_nao_conta_como_o_partido():
    """Decisão do autor: bloco é aliança de liderança, e o nome vem cortado."""
    assert bancada_do_partido("PP", ["Bl UniPpFdrPsdbCid...", "Governo"]) is None


def test_disciplina_usa_o_partido_de_cada_voto():
    """Quem trocou de sigla é medido contra a de então, em cada votação."""
    votos = {"v1": 1, "v2": 1}
    orientacoes = {"v1": {"PL": "Sim", "PP": "Não"}, "v2": {"PL": "Não", "PP": "Sim"}}

    assert disciplina(votos, orientacoes, {"v1": "PL", "v2": "PP"}) == (2, 2)


def test_votacao_sem_bancada_do_partido_sai_da_base():
    """Sem quem represente o partido, não é desobediência: a votação não conta."""
    votos = {"v1": 1, "v2": -1}
    orientacoes = {"v1": {"Bl UniPpPsd...": "Sim"}, "v2": {"PP": "Não"}}

    assert disciplina(votos, orientacoes, {"v1": "PP", "v2": "PP"}) == (1, 1)


def _casos_compartilhados():
    """Os casos que a API (C#) também lê: a mesma regra nas duas linguagens."""
    caminho = Path(__file__).parent / "casos" / "bancada_do_partido.json"
    return json.loads(caminho.read_text(encoding="utf-8"))["casos"]


@pytest.mark.parametrize("caso", _casos_compartilhados(), ids=lambda c: f"{c['partido']}-{c['esperado']}")
def test_casos_compartilhados_com_a_api(caso):
    assert bancada_do_partido(caso["partido"], caso["bancadas"]) == caso["esperado"]
