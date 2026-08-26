"""Testes da leitura dos CSVs da Câmara.

🔴 Estes testes existem por causa de um erro real cometido no discovery: contar
registros por linha inflou 2025 em 26%, e o número errado circulou como se fosse
medição. Cada teste aqui trava uma das armadilhas.
"""

import pandas as pd
import pytest

from poligraph_etl.fontes.camara import (
    REGISTROS_ESPERADOS,
    conferir_volume,
    ler_csv,
)

# ═══════════════════════════════════════════════════════════════════
# 🔴 A armadilha principal: quebra de linha DENTRO do campo
# ═══════════════════════════════════════════════════════════════════

CSV_COM_QUEBRA_NO_CAMPO = (
    '\ufeff"id";"descricao";"cpf"\n'
    '"1";"Aprovado o Projeto";"01234567890"\n'
    '"2";"Aprovada a Emenda,\n'
    'com a seguinte redação:\n'
    'texto em três linhas";"09876543210"\n'
    '"3";"Rejeitado o Requerimento";"11122233344"\n'
)


def test_quebra_de_linha_dentro_do_campo_nao_vira_registro(tmp_path):
    """🔴 O arquivo tem 5 linhas de texto, mas só 3 registros.

    Contar por linha daria 4 (5 menos o cabeçalho) — 33% a mais. Foi exatamente
    esse tipo de erro que inflou 2025 em 26% no discovery.
    """
    caminho = tmp_path / "votacoes.csv"
    caminho.write_text(CSV_COM_QUEBRA_NO_CAMPO, encoding="utf-8")

    linhas_do_arquivo = len(caminho.read_text(encoding="utf-8").splitlines())
    df = ler_csv(caminho)

    assert linhas_do_arquivo == 6      # cabeçalho + 5
    assert len(df) == 3                # ⭐ registros de verdade


def test_conteudo_multilinha_e_preservado_inteiro(tmp_path):
    caminho = tmp_path / "votacoes.csv"
    caminho.write_text(CSV_COM_QUEBRA_NO_CAMPO, encoding="utf-8")

    df = ler_csv(caminho)
    descricao = df.loc[1, "descricao"]

    assert "três linhas" in descricao
    assert descricao.count("\n") == 2   # as quebras viram conteúdo, não separador


# ═══════════════════════════════════════════════════════════════════
# 🔴 CPF: o zero à esquerda
# ═══════════════════════════════════════════════════════════════════


def test_cpf_mantem_o_zero_a_esquerda(tmp_path):
    """⚠️ Sem `dtype=str` o pandas infere número e some com o zero.

    O join com o TSE então falha em silêncio: nenhuma exceção, só menos pessoas
    conciliadas — e o erro só apareceria como um número de cobertura estranho.
    """
    caminho = tmp_path / "votacoes.csv"
    caminho.write_text(CSV_COM_QUEBRA_NO_CAMPO, encoding="utf-8")

    df = ler_csv(caminho)

    assert df.loc[0, "cpf"] == "01234567890"
    assert len(df.loc[0, "cpf"]) == 11


def test_sem_dtype_str_o_cpf_seria_corrompido(tmp_path):
    """Prova negativa: mostra o que acontece SEM o parâmetro.

    ⭐ Este teste documenta o motivo do `dtype=str` melhor que um comentário — se
    alguém remover o parâmetro, o teste acima falha e este explica por quê.
    """
    caminho = tmp_path / "votacoes.csv"
    caminho.write_text(CSV_COM_QUEBRA_NO_CAMPO, encoding="utf-8")

    ingenuo = pd.read_csv(caminho, sep=";", encoding="utf-8-sig")   # sem dtype=str

    assert str(ingenuo.loc[0, "cpf"]) != "01234567890"


# ═══════════════════════════════════════════════════════════════════
# BOM
# ═══════════════════════════════════════════════════════════════════


def test_bom_nao_gruda_no_nome_da_primeira_coluna(tmp_path):
    """⚠️ Sem `encoding='utf-8-sig'`, a primeira coluna vira '\\ufeffid'."""
    caminho = tmp_path / "votacoes.csv"
    caminho.write_text(CSV_COM_QUEBRA_NO_CAMPO, encoding="utf-8")

    df = ler_csv(caminho)

    assert "id" in df.columns
    assert not any(c.startswith("\ufeff") for c in df.columns)


# ═══════════════════════════════════════════════════════════════════
# Canário de volume
# ═══════════════════════════════════════════════════════════════════


def test_volume_dentro_do_esperado_passa():
    df = pd.DataFrame({"id": range(REGISTROS_ESPERADOS[2025])})
    conferir_volume(df, 2025)   # não pode lançar


def test_volume_inflado_para_o_etl():
    """⭐ O canário: parsing por linha daria ~26% a mais em 2025, e o ETL para.

    Sem isto, milhares de linhas quebradas entrariam no banco como registros.
    """
    inflado = int(REGISTROS_ESPERADOS[2025] * 1.26)
    df = pd.DataFrame({"id": range(inflado)})

    with pytest.raises(ValueError, match="Parsing regrediu"):
        conferir_volume(df, 2025)


def test_ano_sem_referencia_nao_e_conferido():
    """Ano novo ainda não medido: não bloqueia o ETL."""
    conferir_volume(pd.DataFrame({"id": range(99)}), 2099)
