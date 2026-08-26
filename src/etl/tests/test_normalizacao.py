"""Testes da normalização — o equivalente Python do API3.

⚠️ Cada caso aqui vem de uma MEDIÇÃO do discovery, não de suposição.
"""

import pytest

from poligraph_etl.normalizacao import (
    classificar_categoria,
    inferir_polaridade,
    normalizar_cpf,
    normalizar_voto,
)

# ═══════════════════════════════════════════════════════════════════
# RN-03 — voto
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "bruto,esperado",
    [
        ("Sim", 1),
        ("sim", 1),
        ("  SIM  ", 1),
        ("Não", -1),
        ("Nao", -1),
        ("Abstenção", 0),
    ],
)
def test_voto_no_dominio_fechado(bruto, esperado):
    assert normalizar_voto(bruto) == esperado


@pytest.mark.parametrize("bruto", ["Obstrução", "Artigo 17", "Branco", "", None, "xyz"])
def test_voto_fora_do_calculo_vira_none(bruto):
    """⚠️ None = fora do cálculo. NÃO é discordância, e NÃO é abstenção."""
    assert normalizar_voto(bruto) is None


def test_obstrucao_nao_e_abstencao():
    """🔴 Em 2023 obstrução foi 2,50% dos votos — medir só 2025 (0,2%) enganaria.

    É manobra de bancada: o parlamentar está presente e se recusa a votar.
    Contá-la como abstenção poria uma decisão de bancada dentro da matriz.
    """
    assert normalizar_voto("Obstrução") is None
    assert normalizar_voto("Abstenção") == 0
    assert normalizar_voto("Obstrução") != normalizar_voto("Abstenção")


# ═══════════════════════════════════════════════════════════════════
# RF-15 — categoria
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "descricao,esperado",
    [
        ("Aprovado o Requerimento de urgência", "PROCEDIMENTAL"),
        ("Rejeitado o adiamento da discussão", "PROCEDIMENTAL"),
        ("Aprovada a Preferência", "PROCEDIMENTAL"),
        ("Aprovada a Emenda de Plenário nº 7", "DESTAQUE"),
        ("Mantido o texto. Sim: 249; Não: 154.", "DESTAQUE"),
        ("Suprimido o texto", "DESTAQUE"),
        ("Aprovado o Projeto de Lei nº 2.162, de 2023", "SUBSTANTIVA"),
        ("Aprovada a Redação Final", "SUBSTANTIVA"),
        ("Aprovada a indicação do embaixador", "AUTORIDADE"),
        (None, "SUBSTANTIVA"),
        ("", "SUBSTANTIVA"),
    ],
)
def test_categoria(descricao, esperado):
    assert classificar_categoria(descricao) == esperado


def test_urgencia_de_projeto_e_procedimental_nao_substantiva():
    """⚠️ A ordem das regex importa: a descrição contém as duas palavras.

    Se SUBSTANTIVA casasse primeiro, requerimentos entrariam na matriz com peso
    1,0 — e a similaridade passaria a medir obstrução, não posição.
    """
    assert classificar_categoria(
        "Aprovado o Requerimento de urgência para o Projeto de Lei nº 1.234"
    ) == "PROCEDIMENTAL"


# ═══════════════════════════════════════════════════════════════════
# 🔴 Achado #12 — polaridade
# ═══════════════════════════════════════════════════════════════════


def test_mantido_o_texto_inverte_a_polaridade():
    """🔴 "Mantido o texto" = o destaque supressivo foi rejeitado.

    Quem votou Sim quis MANTER o texto — votou CONTRA a supressão proposta.
    """
    assert inferir_polaridade("Mantido o texto. Sim: 249; Não: 154.") == -1


@pytest.mark.parametrize(
    "descricao",
    [
        "Aprovado o Projeto de Lei nº 2.162, de 2023",
        "Aprovada a Redação Final",
        "Rejeitado o Projeto",
        None,
    ],
)
def test_texto_principal_tem_polaridade_positiva(descricao):
    assert inferir_polaridade(descricao) == 1


# ═══════════════════════════════════════════════════════════════════
# CPF — zero à esquerda
# ═══════════════════════════════════════════════════════════════════


def test_cpf_preserva_zero_a_esquerda():
    """⚠️ O erro clássico: ler CPF como número perde o zero e o join falha em silêncio."""
    assert normalizar_cpf("01234567890") == "01234567890"
    assert normalizar_cpf(1234567890) == "01234567890"


@pytest.mark.parametrize(
    "bruto,esperado",
    [
        ("123.456.789-00", "12345678900"),
        ("  12345678900  ", "12345678900"),
        (None, None),
        ("", None),
        ("abc", None),
        ("123456789012", None),   # 12 dígitos: não é CPF
    ],
)
def test_cpf(bruto, esperado):
    assert normalizar_cpf(bruto) == esperado


# ═══════════════════════════════════════════════════════════════════
# 🔴 O que o pandas realmente entrega — descoberto na ingestão real
# ═══════════════════════════════════════════════════════════════════


def test_voto_vazio_do_pandas_vira_nulo():
    """🔴 Célula vazia no CSV vira `float('nan')`, não `None` nem `""`.

    ⚠️ O `dtype=str` do `read_csv` não alcança o que o `na_values` já transformou em
    nulo. A ingestão de 2025 morreu aqui com
    `'float' object has no attribute 'strip'`.
    """
    assert normalizar_voto(float("nan")) is None


def test_voto_de_tipo_inesperado_nao_estoura():
    # ⚠️ Fora do cálculo, ⛔ nunca discordância — ausência não é "votou contra".
    for entrada in (None, 0, 1.5, [], {}):
        assert normalizar_voto(entrada) is None
