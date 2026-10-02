"""Cota parlamentar.

RISCO: O ponto mais sensível deste módulo não é o parsing — é o CPF. O campo `txtCNPJCPF`
mistura CNPJ de empresa com **CPF em claro** de fornecedor pessoa física, e a RNF-13
proíbe o segundo no banco.
"""

import pytest

from poligraph_etl import cota
from poligraph_etl.fontes import camara, senado

MAPA = {"62881": 7, "204554": 8}


def registro(**campos):
    """DECISÃO: Colunas copiadas do arquivo REAL de 2025, não inventadas."""
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
# RISCO: CPF — RNF-13
# ═══════════════════════════════════════════════════════════════════


def test_cpf_de_fornecedor_e_hasheado():
    """RISCO: RNF-13: CPF nunca em claro no banco.

    ATENÇÃO: Fornecedor pessoa física traz CPF no MESMO campo que a empresa traz CNPJ. Gravar
    sem distinguir colocaria milhares de CPFs em claro numa tabela pública.

    `assert len(linha["cnpj_ou_hash"]) == 64`: sha256 em hex
    """
    linha = cota.para_linhas([registro(txtCNPJCPF="123.456.789-09")], MAPA)[0]

    assert linha["fornecedor_eh_pessoa_fisica"] is True
    assert linha["cnpj_ou_hash"] != "12345678909"
    assert len(linha["cnpj_ou_hash"]) == 64


def test_cnpj_fica_legivel():
    """DECISÃO: CNPJ é dado público de empresa e PRECISA ficar em claro.

    ATENÇÃO: Hashear os dois por segurança aparente destruiria a análise que interessa —
    cruzar o mesmo fornecedor entre parlamentares.
    """
    linha = cota.para_linhas([registro()], MAPA)[0]

    assert linha["fornecedor_eh_pessoa_fisica"] is False
    assert linha["cnpj_ou_hash"] == "63356042000180"


def test_o_hash_e_estavel():
    """ATENÇÃO: Mesmo CPF, mesmo hash — senão não dá para cruzar nem contar distintos."""
    um = cota.para_linhas([registro(txtCNPJCPF="111.444.777-35")], MAPA)[0]
    outro = cota.para_linhas([registro(txtCNPJCPF="11144477735")], MAPA)[0]

    assert um["cnpj_ou_hash"] == outro["cnpj_ou_hash"]


# ═══════════════════════════════════════════════════════════════════
# O que entra e o que é descartado
# ═══════════════════════════════════════════════════════════════════


def test_sem_ideCadastro_e_descartado():
    """ATENÇÃO: São lideranças e órgãos — 0,4% em 2025. Não são pessoas, não têm ficha."""
    assert cota.para_linhas([registro(ideCadastro="")], MAPA) == []


def test_deputado_fora_do_de_para_e_descartado():
    assert cota.para_linhas([registro(ideCadastro="999999")], MAPA) == []


def test_valor_zero_e_descartado():
    assert cota.para_linhas([registro(vlrLiquido="0")], MAPA) == []


def test_estorno_e_mantido():
    """DECISÃO: Valor negativo é estorno, e somá-lo importa para o total do deputado."""
    linha = cota.para_linhas([registro(vlrLiquido="-250.00")], MAPA)[0]

    assert linha["valor_liquido"] == -250.0


def test_separador_decimal_e_ponto():
    """ATENÇÃO: Conferido no arquivo real: `104.58`, não `104,58`."""
    assert cota.para_linhas([registro(vlrLiquido="1234.56")], MAPA)[0]["valor_liquido"] == 1234.56


def test_data_perde_a_hora():
    linha = cota.para_linhas([registro()], MAPA)[0]

    assert linha["data_emissao"] == "2025-02-28"


def test_categoria_vazia_vira_rotulo():
    """ATENÇÃO: `NOT NULL` no banco — sem isto a linha inteira seria rejeitada."""
    linha = cota.para_linhas([registro(txtDescricao="")], MAPA)[0]

    assert linha["categoria"] == "SEM CATEGORIA"


# ═══════════════════════════════════════════════════════════════════
# Canário
# ═══════════════════════════════════════════════════════════════════


def test_arquivo_pequeno_demais_estoura():
    """DECISÃO: Medido: 209.176 linhas em 2025. Encolher muito significa layout mudado.

    ATENÇÃO: Sem o canário, um arquivo truncado entraria em silêncio e a ficha mostraria
    gasto a menos — sem nada acusar.
    """
    with pytest.raises(RuntimeError, match="layout"):
        camara.conferir_volume_de_cota([registro()], 2025)


def test_volume_normal_passa():
    camara.conferir_volume_de_cota([registro()] * 60_000, 2025)


# ═══════════════════════════════════════════════════════════════════
# RISCO: CEAPS — a cota do Senado, na mesma tabela
# ═══════════════════════════════════════════════════════════════════

POR_NOME = {"ALAN RICK": 7}


def ceaps(**campos) -> dict:
    base = {
        "ANO": "2025",
        "MES": "1",
        "SENADOR": "ALAN RICK",
        "TIPO_DESPESA": "Aluguel de imóveis para escritório político",
        "CNPJ_CPF": "66.970.229/0132-26",
        "FORNECEDOR": "CLARO NXT TELECOMUNICAÇÕES S.A",
        "DATA": "18/01/2025",
        "VALOR_REEMBOLSADO": "399,44",
    }

    return {**base, **campos}


def test_ceaps_casa_pelo_nome_parlamentar():
    linha = cota.para_linhas_do_senado([ceaps()], POR_NOME)[0]

    assert linha["pessoa_id"] == 7
    assert linha["valor_liquido"] == 399.44


def test_ceaps_normaliza_acento_e_caixa_do_nome():
    """A CEAPS manda caixa alta; `pessoas.nome_exibicao` guarda com acento e caixa mista."""
    linhas = cota.para_linhas_do_senado(
        [ceaps(SENADOR="Alan Rick")], {"ALAN RICK": 7}
    )

    assert linhas[0]["pessoa_id"] == 7


def test_ceaps_de_quem_nao_esta_no_de_para_e_descartada():
    """Não Atribuir por semelhança de nome seria inventar dono."""
    assert cota.para_linhas_do_senado([ceaps(SENADOR="FULANO")], POR_NOME) == []


def test_ceaps_converte_a_data_para_iso():
    linha = cota.para_linhas_do_senado([ceaps(DATA="03/12/2025")], POR_NOME)[0]

    assert linha["data_emissao"] == "2025-12-03"


def test_ceaps_data_vazia_nao_derruba_a_linha():
    linha = cota.para_linhas_do_senado([ceaps(DATA="")], POR_NOME)[0]

    assert linha["data_emissao"] is None


def test_ceaps_valor_sem_centavos():
    """ATENÇÃO: O TSE manda `4000`, sem vírgula, na mesma coluna que manda `399,44`."""
    linha = cota.para_linhas_do_senado([ceaps(VALOR_REEMBOLSADO="4000")], POR_NOME)[0]

    assert linha["valor_liquido"] == 4000


def test_ceaps_valor_zero_sai():
    assert cota.para_linhas_do_senado([ceaps(VALOR_REEMBOLSADO="0")], POR_NOME) == []


def test_ceaps_nao_tem_url_de_documento():
    """A CEAPS publica o número do documento, não o link da imagem."""
    assert cota.para_linhas_do_senado([ceaps()], POR_NOME)[0]["url_documento"] is None


def test_ler_ceaps_pula_a_linha_de_metadado(tmp_path):
    """RISCO: A armadilha do arquivo: a PRIMEIRA linha não é o cabeçalho.

    Ela é `"ULTIMA ATUALIZACAO";"07/09/2026 02:02"`. Um `DictReader` direto tomaria isso
    como cabeçalho, nenhuma coluna casaria, e a leitura devolveria zero despesa — com
    log de sucesso.
    """
    caminho = tmp_path / "ceaps.csv"
    caminho.write_text(
        '"ULTIMA ATUALIZACAO";"07/09/2026 02:02"' + chr(10)
        + '"ANO";"MES";"SENADOR";"VALOR_REEMBOLSADO"' + chr(10)
        + '"2025";"1";"ALAN RICK";"399,44"' + chr(10),
        encoding="latin-1",
    )

    linhas = senado.ler_ceaps(caminho)

    assert len(linhas) == 1
    assert linhas[0]["SENADOR"] == "ALAN RICK"


def test_ler_ceaps_sem_a_linha_de_metadado_ainda_funciona(tmp_path):
    """Se o Senado tirar a linha de metadado, o leitor não pode perder o cabeçalho."""
    caminho = tmp_path / "ceaps.csv"
    caminho.write_text(
        '"ANO";"MES";"SENADOR";"VALOR_REEMBOLSADO"' + chr(10)
        + '"2025";"1";"ALAN RICK";"399,44"' + chr(10),
        encoding="latin-1",
    )

    assert senado.ler_ceaps(caminho)[0]["SENADOR"] == "ALAN RICK"
