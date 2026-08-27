"""Financiamento de campanha — o fundão (FEFC) e o resto.

🔴 Três pontos sensíveis, e nenhum deles falha com exceção:

1. O join é por **hash de CPF**. Se as duas pontas hashearem diferente, nada casa — e
   o sintoma é uma ficha vazia, ⛔ não um erro
2. **`FUNDO ESPECIAL` ⛔ ≠ `FUNDO PARTIDARIO`.** Somar os dois muda o número que o TCC
   vai citar
3. O CSV é **Latin-1** e usa `#NULO` como texto — lido como UTF-8 ou como vazio, ambos
   corrompem em silêncio
"""

import io
import zipfile
from pathlib import Path

import pytest

from poligraph_etl import receitas
from poligraph_etl.normalizacao import hash_de_cpf

CPF_ELEITO = "01234567890"
CPF_PERDEDOR = "98765432100"

# ⚠️ Cabeçalho e valores copiados do layout REAL do TSE, ⛔ não inventados.
COLUNAS = [
    "DS_CARGO", "NR_CPF_CANDIDATO", "NM_CANDIDATO", "DS_FONTE_RECEITA",
    "DS_ORIGEM_RECEITA", "NM_DOADOR", "NR_CPF_CNPJ_DOADOR", "VR_RECEITA",
]


def linha(**campos) -> dict:
    base = {
        "DS_CARGO": "DEPUTADO FEDERAL",
        "NR_CPF_CANDIDATO": CPF_ELEITO,
        "NM_CANDIDATO": "FULANO DE TAL",
        "DS_FONTE_RECEITA": "FUNDO ESPECIAL",
        "DS_ORIGEM_RECEITA": "Recursos de partido político",
        "NM_DOADOR": "PARTIDO EXEMPLO",
        "NR_CPF_CNPJ_DOADOR": "12345678000199",
        "VR_RECEITA": "3170000,00",
    }

    return {**base, **campos}


@pytest.fixture
def conhecidos() -> dict[str, int]:
    """O de-para como ele sai do banco: **hash** → id. ⛔ Nunca CPF em claro."""
    return {hash_de_cpf(CPF_ELEITO): 42}


# ═══════════════════════════════════════════════════════════════════
# 🔴 O join por hash de CPF
# ═══════════════════════════════════════════════════════════════════


def test_casa_o_candidato_pelo_hash_do_cpf(conhecidos):
    """⭐ O CPF em claro entra pelo CSV e ⛔ não sai do laço — o que casa é o hash."""
    linhas = receitas.para_linhas([linha()], conhecidos, 2022)

    assert len(linhas) == 1
    assert linhas[0]["pessoa_id"] == 42


def test_cpf_formatado_casa_igual(conhecidos):
    """🔴 O TSE formata com pontos em alguns arquivos.

    ⚠️ Sem normalizar antes de hashear, `012.345.678-90` ⛔ nunca casaria com o hash
    gravado pela Câmara — e o sintoma seria "este deputado não recebeu nada".
    """
    linhas = receitas.para_linhas(
        [linha(NR_CPF_CANDIDATO="012.345.678-90")], conhecidos, 2022
    )

    assert len(linhas) == 1


def test_zero_a_esquerda_nao_se_perde(conhecidos):
    """⚠️ CPF lido como número perderia o zero e o join morreria calado."""
    linhas = receitas.para_linhas(
        [linha(NR_CPF_CANDIDATO=" 1234567890 ")], conhecidos, 2022
    )

    assert len(linhas) == 1


def test_quem_nao_esta_no_de_para_fica_de_fora(conhecidos):
    """⭐ Candidato que ⛔ não se elegeu ⛔ não tem dono em `pessoas`."""
    assert receitas.para_linhas([linha(NR_CPF_CANDIDATO=CPF_PERDEDOR)], conhecidos, 2022) == []


def test_outro_cargo_fica_de_fora(conhecidos):
    """⚠️ Vereador e senador ⛔ não estão em `pessoas` — e um homônimo de CPF ⛔ não
    existe, mas o filtro de cargo evita depender disso."""
    assert receitas.para_linhas([linha(DS_CARGO="VEREADOR")], conhecidos, 2022) == []


def test_de_para_vazio_descarta_tudo(conhecidos):
    """🔴 A falha silenciosa que o comando precisa impedir ANTES de ler 377 MB.

    ⚠️ Com `cpf` não executado, o de-para sai vazio e o resultado correto da função é
    **nada** — por isso quem barra é `_fundo`, com erro claro, ⛔ não este módulo.
    """
    assert receitas.para_linhas([linha()], {}, 2022) == []


# ═══════════════════════════════════════════════════════════════════
# 🔴 Fundo Especial ⛔ ≠ Fundo Partidário
# ═══════════════════════════════════════════════════════════════════


def test_os_dois_fundos_nao_se_misturam(conhecidos):
    """🔴 São fundos DIFERENTES, e o resumo os separa.

    ⚠️ O FEFC ("fundão") é de 2017 e é eleitoral; o Fundo Partidário é permanente.
    Somá-los como "dinheiro público de campanha" é defensável — mas tem de ser dito, e
    quem soma é quem analisa, ⛔ não o ETL.
    """
    linhas = receitas.para_linhas(
        [
            linha(DS_FONTE_RECEITA="FUNDO ESPECIAL", VR_RECEITA="1000,00"),
            linha(DS_FONTE_RECEITA="FUNDO PARTIDARIO", VR_RECEITA="500,00"),
            linha(DS_FONTE_RECEITA="OUTROS RECURSOS", VR_RECEITA="250,00"),
        ],
        conhecidos,
        2022,
    )
    resumo = receitas.resumir(linhas)

    assert resumo["fundo_especial"] == pytest.approx(1000.00)
    assert resumo["total"] == pytest.approx(1750.00)
    assert resumo["parlamentares"] == 1


def test_a_fonte_e_normalizada_para_caixa_alta(conhecidos):
    """⚠️ Sem isto, `Fundo Especial` e `FUNDO ESPECIAL` seriam duas fontes distintas —
    e o total do fundão sairia pela metade."""
    linhas = receitas.para_linhas(
        [linha(DS_FONTE_RECEITA="Fundo Especial")], conhecidos, 2022
    )

    assert linhas[0]["fonte_receita"] == "FUNDO ESPECIAL"
    assert receitas.resumir(linhas)["fundo_especial"] == pytest.approx(3170000.00)


# ═══════════════════════════════════════════════════════════════════
# 🔴 RNF-13 — o doador pessoa física
# ═══════════════════════════════════════════════════════════════════


def test_cnpj_do_doador_fica_legivel(conhecidos):
    """⭐ CNPJ é dado público de empresa, e ⛔ não pode ser hasheado.

    🔴 É ele que permite cruzar **quem financiou a campanha** com **quem recebeu verba
    de gabinete depois** — a pergunta que justifica ingerir isto.
    """
    linhas = receitas.para_linhas([linha()], conhecidos, 2022)

    assert linhas[0]["doador_cnpj_ou_hash"] == "12345678000199"
    assert linhas[0]["doador_eh_pessoa_fisica"] is False


def test_cpf_do_doador_vira_hash(conhecidos):
    """🔴 RNF-13 — e o **mesmo** hash da cota, para que os dois lados se comparem."""
    from poligraph_etl.cota import _identificar_fornecedor

    linhas = receitas.para_linhas(
        [linha(NR_CPF_CNPJ_DOADOR="012.345.678-90")], conhecidos, 2022
    )

    assert linhas[0]["doador_eh_pessoa_fisica"] is True
    assert linhas[0]["doador_cnpj_ou_hash"] == hash_de_cpf(CPF_ELEITO)
    assert linhas[0]["doador_cnpj_ou_hash"] == _identificar_fornecedor(CPF_ELEITO)[0]

    # ⛔ E o CPF em claro ⛔ não sobrou em canto nenhum da linha
    assert CPF_ELEITO not in str(linhas[0])


def test_doador_zerado_vira_nulo(conhecidos):
    """⚠️ O TSE usa `00000000000` para doação sem doador identificado.

    🔴 Hasheá-lo daria um valor CONSTANTE gravado em milhares de linhas — que casaria
    todas entre si e inventaria um doador comum que ⛔ não existe.
    """
    linhas = receitas.para_linhas(
        [linha(NR_CPF_CNPJ_DOADOR="00000000000")], conhecidos, 2022
    )

    assert linhas[0]["doador_cnpj_ou_hash"] is None
    assert linhas[0]["doador_eh_pessoa_fisica"] is False


# ═══════════════════════════════════════════════════════════════════
# Sentinelas e valor
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize("nulo", ["#NULO", "#NULO#", "#NE", "-1", "  "])
def test_sentinela_do_tse_nao_vira_texto(conhecidos, nulo):
    """⚠️ `#NULO` chega como TEXTO. Sem tratar, viraria o nome do doador na ficha."""
    linhas = receitas.para_linhas([linha(NM_DOADOR=nulo)], conhecidos, 2022)

    assert linhas[0]["doador"] is None


def test_fonte_ausente_nao_fica_vazia(conhecidos):
    """⚠️ `fonte_receita` é `required` no EF — string vazia passaria e viraria uma
    categoria fantasma na ficha."""
    linhas = receitas.para_linhas([linha(DS_FONTE_RECEITA="#NULO")], conhecidos, 2022)

    assert linhas[0]["fonte_receita"] == "NAO INFORMADA"


def test_valor_zero_e_descartado(conhecidos):
    """🔴 `ck_receita_valor` exige `valor <> 0`.

    ⚠️ Sem o descarte, **o lote inteiro** seria recusado pelo banco por causa de uma
    linha — o `executemany` é atômico.
    """
    assert receitas.para_linhas([linha(VR_RECEITA="0,00")], conhecidos, 2022) == []
    assert receitas.para_linhas([linha(VR_RECEITA="#NULO")], conhecidos, 2022) == []


def test_valor_usa_a_convencao_pt_br(conhecidos):
    """⚠️ `3170000,00` — vírgula decimal. Ler com ponto decimal daria 3170000 vezes
    menos... ou um erro. Aqui daria erro; em `1.000,00` daria **1,0** calado."""
    linhas = receitas.para_linhas(
        [linha(VR_RECEITA="1.000,00")], conhecidos, 2022
    )

    assert linhas[0]["valor"] == pytest.approx(1000.00)


def test_ano_de_eleicao_e_o_passado_nao_o_do_registro(conhecidos):
    """⚠️ ⛔ Não há coluna de ano no CSV de receita — ele é do arquivo inteiro."""
    linhas = receitas.para_linhas([linha()], conhecidos, 2018)

    assert linhas[0]["ano_eleicao"] == 2018


# ═══════════════════════════════════════════════════════════════════
# O ZIP — quais arquivos entram
# ═══════════════════════════════════════════════════════════════════


@pytest.fixture
def zip_do_tse(tmp_path: Path) -> Path:
    """Um ZIP com a mesma FORMA do real: 5 tipos de arquivo dividindo o mesmo pacote."""
    caminho = tmp_path / "prestacao.zip"

    conteudo = ";".join(COLUNAS) + "\n" + ";".join(
        [
            "DEPUTADO FEDERAL", CPF_ELEITO, "JOSÉ AÇÃÍ", "FUNDO ESPECIAL",
            "Recursos de partido político", "PARTIDO EXEMPLO", "12345678000199",
            "3170000,00",
        ]
    ) + "\n"

    with zipfile.ZipFile(caminho, "w") as zipe:
        zipe.writestr("receitas_candidatos_2022_AP.csv", conteudo.encode("latin-1"))
        zipe.writestr("receitas_candidatos_2022_SP.csv", conteudo.encode("latin-1"))
        zipe.writestr("receitas_candidatos_2022_BRASIL.csv", conteudo.encode("latin-1"))

        # ⚠️ **As duas grafias plausíveis do doador originário.** A documentação do TSE
        #    lista o tipo como `receitas_candidatos_doador_originario_2022`, mas a
        #    posição do ano no nome do arquivo estadual ⛔ não foi medida no ZIP real.
        #    A segunda grafia CASA com o prefixo — é ela que torna `IGNORAR` necessário.
        zipe.writestr("receitas_candidatos_doador_originario_2022_AP.csv", "x")
        zipe.writestr("receitas_candidatos_2022_doador_originario_AP.csv", "x")
        zipe.writestr("despesas_pagas_candidatos_2022_AP.csv", "x")
        zipe.writestr("leiame.pdf", "x")

    return caminho


def test_so_os_estaduais_de_receita_entram(zip_do_tse):
    """⚠️ Três exclusões, cada uma por um motivo diferente:

    | Fora | Por quê |
    |---|---|
    | `_BRASIL` | É o consolidado de 1,3 GB — ler junto DUPLICARIA tudo |
    | `doador_originario` | Rastreia intermediário; ⛔ não é a receita |
    | `despesas_*`, `leiame` | Outro assunto |
    """
    nomes = receitas.nomes_de_receita(zip_do_tse, 2022)

    assert nomes == [
        "receitas_candidatos_2022_AP.csv",
        "receitas_candidatos_2022_SP.csv",
    ]


def test_le_latin1_sem_corromper(zip_do_tse, conhecidos):
    """🔴 O TSE é **Latin-1** — a única fonte do projeto assim.

    ⚠️ Lido como UTF-8, `JOSÉ AÇÃÍ` estouraria em `UnicodeDecodeError` na primeira linha
    acentuada de um arquivo de 377 MB.
    """
    registros = list(receitas.ler_receitas(zip_do_tse, "receitas_candidatos_2022_AP.csv"))

    assert len(registros) == 1
    assert registros[0]["NM_CANDIDATO"] == "JOSÉ AÇÃÍ"

    linhas = receitas.para_linhas(registros, conhecidos, 2022)
    assert linhas[0]["valor"] == pytest.approx(3170000.00)


def test_ano_diferente_nao_acha_nada(zip_do_tse):
    """⚠️ Pedir 2018 num ZIP de 2022 devolve **vazio**, e o comando trata isso como
    erro — ⛔ não como "essa eleição não teve receita"."""
    assert receitas.nomes_de_receita(zip_do_tse, 2018) == []
