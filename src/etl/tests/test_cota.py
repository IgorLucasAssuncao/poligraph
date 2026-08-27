"""Cota parlamentar.

🔴 O ponto mais sensível deste módulo não é o parsing — é o CPF. O campo `txtCNPJCPF`
mistura CNPJ de empresa com **CPF em claro** de fornecedor pessoa física, e a RNF-13
proíbe o segundo no banco.
"""

import pytest

from poligraph_etl import cota

MAPA = {"62881": 7, "204554": 8}


def registro(**campos):
    """⭐ Colunas copiadas do arquivo REAL de 2025, não inventadas."""
    base = {
        "ideCadastro": "62881",
        "numAno": "2025",
        "numMes": "2",
        "txtDescricao": "MANUTENÇÃO DE ESCRITÓRIO DE APOIO",
        "txtFornecedor": "ALARES",
        "txtCNPJCPF": "633.560.420/0018-0",
        "vlrLiquido": "104.58",
        "datEmissao": "2025-02-28T00:00:00",
        "urlDocumento": "https://www.camara.leg.br/cota-parlamentar/documento",
    }

    return {**base, **campos}


# ═══════════════════════════════════════════════════════════════════
# 🔴 CPF — RNF-13
# ═══════════════════════════════════════════════════════════════════


def test_cpf_de_fornecedor_e_hasheado():
    """🔴 RNF-13: CPF ⛔ nunca em claro no banco.

    ⚠️ Fornecedor pessoa física traz CPF no MESMO campo que a empresa traz CNPJ. Gravar
    sem distinguir colocaria milhares de CPFs em claro numa tabela pública.
    """
    linha = cota.para_linhas([registro(txtCNPJCPF="123.456.789-09")], MAPA)[0]

    assert linha["fornecedor_eh_pessoa_fisica"] is True
    assert linha["cnpj_ou_hash"] != "12345678909"
    assert len(linha["cnpj_ou_hash"]) == 64        # sha256 em hex


def test_cnpj_fica_legivel():
    """⭐ CNPJ é dado público de empresa e PRECISA ficar em claro.

    ⚠️ Hashear os dois por segurança aparente destruiria a análise que interessa —
    cruzar o mesmo fornecedor entre parlamentares.
    """
    linha = cota.para_linhas([registro()], MAPA)[0]

    assert linha["fornecedor_eh_pessoa_fisica"] is False
    assert linha["cnpj_ou_hash"] == "63356042000180"


def test_o_hash_e_estavel():
    """⚠️ Mesmo CPF, mesmo hash — senão não dá para cruzar nem contar distintos."""
    um = cota.para_linhas([registro(txtCNPJCPF="111.444.777-35")], MAPA)[0]
    outro = cota.para_linhas([registro(txtCNPJCPF="11144477735")], MAPA)[0]

    assert um["cnpj_ou_hash"] == outro["cnpj_ou_hash"]


# ═══════════════════════════════════════════════════════════════════
# O que entra e o que é descartado
# ═══════════════════════════════════════════════════════════════════


def test_sem_ideCadastro_e_descartado():
    """⚠️ São lideranças e órgãos — 0,4% em 2025. ⛔ Não são pessoas, não têm ficha."""
    assert cota.para_linhas([registro(ideCadastro="")], MAPA) == []


def test_deputado_fora_do_de_para_e_descartado():
    assert cota.para_linhas([registro(ideCadastro="999999")], MAPA) == []


def test_valor_zero_e_descartado():
    assert cota.para_linhas([registro(vlrLiquido="0")], MAPA) == []


def test_estorno_e_mantido():
    """⭐ Valor negativo é estorno, e somá-lo importa para o total do deputado."""
    linha = cota.para_linhas([registro(vlrLiquido="-250.00")], MAPA)[0]

    assert linha["valor_liquido"] == -250.0


def test_separador_decimal_e_ponto():
    """⚠️ Conferido no arquivo real: `104.58`, ⛔ não `104,58`."""
    assert cota.para_linhas([registro(vlrLiquido="1234.56")], MAPA)[0]["valor_liquido"] == 1234.56


def test_data_perde_a_hora():
    linha = cota.para_linhas([registro()], MAPA)[0]

    assert linha["data_emissao"] == "2025-02-28"


def test_categoria_vazia_vira_rotulo():
    """⚠️ `NOT NULL` no banco — sem isto a linha inteira seria rejeitada."""
    linha = cota.para_linhas([registro(txtDescricao="")], MAPA)[0]

    assert linha["categoria"] == "SEM CATEGORIA"


# ═══════════════════════════════════════════════════════════════════
# Canário
# ═══════════════════════════════════════════════════════════════════


def test_arquivo_pequeno_demais_estoura():
    """⭐ Medido: 209.176 linhas em 2025. Encolher muito significa layout mudado.

    ⚠️ Sem o canário, um arquivo truncado entraria em silêncio e a ficha mostraria
    gasto a menos — sem nada acusar.
    """
    with pytest.raises(RuntimeError, match="layout"):
        cota.conferir_volume([registro()], 2025)


def test_volume_normal_passa():
    cota.conferir_volume([registro()] * 60_000, 2025)
