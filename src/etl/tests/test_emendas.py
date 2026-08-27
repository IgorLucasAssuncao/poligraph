"""Emendas parlamentares.

🔴 Dois pontos sensíveis: a extração do **código do autor** — que é a chave — e a
conversão de valor em **formato brasileiro**, onde três armadilhas convivem no mesmo
campo.
"""

import pytest

from poligraph_etl import emendas


def emenda(**campos):
    """⭐ Campos copiados do retorno REAL do Portal, não inventados."""
    base = {
        "codigoEmenda": "202541840004",
        "ano": 2025,
        "tipoEmenda": "Emenda Individual - Transferências com Finalidade Definida",
        "autor": "LUIS CARLOS HEINZE",
        "nomeAutor": "LUIS CARLOS HEINZE",
        "numeroEmenda": "0004",
        "localidadeDoGasto": "Nacional",
        "funcao": "Defesa nacional",
        "subfuncao": "Defesa naval",
        "valorEmpenhado": "- 26.002,00",
        "valorLiquidado": "12.599,10",
        "valorPago": "12.599,10",
        "valorRestoPago": "211.398,90",
    }

    return {**base, **campos}


# ═══════════════════════════════════════════════════════════════════
# 🔴 O código do autor — a chave
# ═══════════════════════════════════════════════════════════════════


def test_extrai_o_codigo_do_autor():
    """202541840004 = 2025 + 4184 + 0004."""
    assert emendas.codigo_do_autor(emenda()) == "4184"


def test_numero_de_tamanho_diferente_nao_quebra():
    """🔴 O corte usa o `numeroEmenda` do registro, ⛔ não posição fixa.

    ⚠️ Recortar por índice erraria em SILÊNCIO quando o número tivesse outro tamanho —
    e o código extraído seria de outro autor.
    """
    assert emendas.codigo_do_autor(emenda(codigoEmenda="2025418412", numeroEmenda="12")) == "4184"


def test_codigo_incoerente_devolve_nada():
    """⚠️ Se o código ⛔ não termina com o número, algo mudou na fonte."""
    assert emendas.codigo_do_autor(emenda(codigoEmenda="202541840004", numeroEmenda="9999")) is None
    assert emendas.codigo_do_autor(emenda(codigoEmenda="")) is None


# ═══════════════════════════════════════════════════════════════════
# 🔴 Valor em formato brasileiro
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("12.599,10", 12599.10),        # ponto é MILHAR
        ("- 26.002,00", -26002.00),     # negativo separado do número
        ("211.398,90", 211398.90),
        ("0,00", 0.0),
        ("1.234.567,89", 1234567.89),
        ("", 0.0),
        ("#NULO", 0.0),
        (None, 0.0),
    ],
)
def test_valor_brasileiro(bruto, esperado):
    assert emendas.valor_brasileiro(bruto) == pytest.approx(esperado)


def test_float_direto_quebraria():
    """🔴 A razão de a função existir.

    ⚠️ `float("12.599,10")` estoura, e `float("12.599")` daria **12,599** — três ordens
    de grandeza abaixo, sem erro nenhum.
    """
    with pytest.raises(ValueError):
        float("12.599,10")

    assert emendas.valor_brasileiro("12.599,10") == 12599.10


def test_empenho_negativo_e_mantido():
    """⭐ Empenho negativo é CANCELAMENTO — caso normal, ⛔ não erro."""
    linhas, _ = emendas.para_linhas([emenda()])

    assert linhas[0]["valor_empenhado"] == -26002.00


# ═══════════════════════════════════════════════════════════════════
# Nada é descartado por falta de dono
# ═══════════════════════════════════════════════════════════════════


def test_emenda_de_bancada_entra_igual():
    """⭐ A decisão do autor: ingerir tudo, resolver o vínculo depois.

    ⚠️ Perder o registro por não saber ligar seria pior — a reconciliação futura ⛔ não
    teria o que reconciliar.
    """
    linhas, autores = emendas.para_linhas([
        emenda(nomeAutor="BANCADA DO RIO DE JANEIRO", codigoEmenda="202599990001",
               numeroEmenda="0001"),
    ])

    assert len(linhas) == 1
    assert linhas[0]["codigo_autor"] == "9999"
    assert autores["9999"] == "BANCADA DO RIO DE JANEIRO"


def test_o_mapa_de_autores_junta_por_codigo():
    """⚠️ Duas emendas do mesmo autor dão UMA entrada no mapa."""
    _, autores = emendas.para_linhas([
        emenda(numeroEmenda="0004", codigoEmenda="202541840004"),
        emenda(numeroEmenda="0007", codigoEmenda="202541840007"),
    ])

    assert autores == {"4184": "LUIS CARLOS HEINZE"}


def test_chave_ausente_e_erro_claro():
    """⚠️ Sem chave, a mensagem diz ONDE obtê-la — ⛔ não só que faltou."""
    import os

    anterior = os.environ.pop("PORTAL_TRANSPARENCIA_CHAVE", None)
    try:
        with pytest.raises(RuntimeError, match="cadastrar-email"):
            emendas.chave()
    finally:
        if anterior:
            os.environ["PORTAL_TRANSPARENCIA_CHAVE"] = anterior


# ═══════════════════════════════════════════════════════════════════
# A forma canônica do nome — usada só na reconciliação inicial
# ═══════════════════════════════════════════════════════════════════

from poligraph_etl.normalizacao import sem_acento_maiusculo


@pytest.mark.parametrize(
    ("camara", "portal"),
    [
        ("Sóstenes Cavalcante", "SOSTENES CAVALCANTE"),
        ("José  Guimarães", "JOSE GUIMARAES"),
        (" Célia Xakriabá ", "CELIA XAKRIABA"),
    ],
)
def test_grafias_diferentes_convergem(camara: str, portal: str):
    """⚠️ A Câmara guarda com acento e caixa mista; o Portal manda CAIXA ALTA sem acento.

    ⭐ Isto roda UMA vez, para descobrir de quem é o código. Depois o vínculo vive no
    código e a grafia deixa de importar.
    """
    assert sem_acento_maiusculo(camara) == sem_acento_maiusculo(portal)


def test_nomes_diferentes_nao_convergem():
    assert sem_acento_maiusculo("Ana Silva") != sem_acento_maiusculo("Ana Silveira")
