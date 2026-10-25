"""Redes sociais, patrimônio declarado e o CNPJ do convenente."""

import io
import zipfile

import pytest

from poligraph_etl.emendas import convenentes
from poligraph_etl.eleicoes import patrimonio, redes
from poligraph_etl.nucleo.normalizacao import hash_de_cpf


def _zip(tmp_path, nome, arquivos: dict[str, str]):
    caminho = tmp_path / nome
    with zipfile.ZipFile(caminho, "w") as zf:
        for membro, conteudo in arquivos.items():
            zf.writestr(membro, conteudo.encode("latin-1"))
    return caminho


# ═══════════════════════════════════════════════════════════════════
# Redes sociais
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("https://www.instagram.com/fulano", "https://www.instagram.com/fulano"),
        ("instagram.com/fulano", "https://instagram.com/fulano"),
        ("  https://x.com/fulano  ", "https://x.com/fulano"),
        pytest.param("HTTPS://YOUTUBE.COM/RogerioCarvalho13", "https://youtube.com/RogerioCarvalho13", id="O TSE publica em caixa alta; o caminho diferencia maiúsculas e fica como veio."),
        pytest.param("javascript:alert(1)", None, id="RISCO: Outro esquema vira link que executa script: recusado."),
        ("fulano no instagram", None),
        ("@pedroluis.longo", None),
        ("https://@fulano", None),
        ("", None),
        (None, None),
    ],
)
def test_normalizar_so_aceita_http(bruto, esperado):
    assert redes.normalizar(bruto) == esperado


@pytest.mark.parametrize(
    ("url", "tipo"),
    [
        ("https://www.instagram.com/a", "INSTAGRAM"),
        ("https://m.facebook.com/a", "FACEBOOK"),
        ("https://twitter.com/a", "X"),
        ("https://x.com/a", "X"),
        pytest.param("https://max.com/a", "OUTRA", id="ATENÇÃO: Domínio inteiro: 'max.com' termina em 'x.com', mas não é o X."),
        ("https://youtu.be/a", "YOUTUBE"),
        ("https://fulano.com.br", "OUTRA"),
    ],
)
def test_tipo_pelo_dominio(url, tipo):
    assert redes.tipo(url) == tipo


def test_para_linhas_sem_repetir_e_sem_invalido():
    linhas = redes.para_linhas(7, ["https://x.com/a", "HTTPS://X.COM/A", "javascript:x", "instagram.com/a"], "CAMARA")

    assert [(l["url"], l["rede"]) for l in linhas] == [("https://x.com/a", "X"), ("https://instagram.com/a", "INSTAGRAM")]
    assert {l["pessoa_id"] for l in linhas} == {7}


@pytest.mark.parametrize(
    "urls, fica",
    [
        (["https://www.instagram.com/albertopmourao/", "https://www.instagram.com/albertopmourao"], "https://www.instagram.com/albertopmourao/"),
        (["https://instagram.com/helio.leite?igshid=YmM=", "https://www.instagram.com/helio.leite"], "https://www.instagram.com/helio.leite"),
        (["https://twitter.com/albertomourao", "https://x.com/albertomourao?t=aVkc&s=09"], "https://twitter.com/albertomourao"),
        (["https://m.facebook.com/fulano/", "https://www.facebook.com/Fulano"], "https://m.facebook.com/fulano/"),
    ],
)
def test_o_mesmo_perfil_escrito_de_outro_jeito_fica_uma_vez(urls, fica):
    assert [l["url"] for l in redes.para_linhas(7, urls, "TSE")] == [fica]


def test_perfis_diferentes_da_mesma_rede_ficam_os_dois():
    urls = [
        "https://www.facebook.com/CarmenZanottoLages",
        "https://www.facebook.com/CarmenZanottoSC",
        "https://www.facebook.com/profile.php?id=1",
        "https://www.facebook.com/profile.php?id=2",
    ]

    assert len(redes.para_linhas(7, urls, "TSE")) == 4


def test_coluna_do_endereco_muda_de_nome_entre_arquivos():
    assert redes.url_da_linha({"SQ_CANDIDATO": "1", "DS_URL": "https://a.com"}) == "https://a.com"
    assert redes.url_da_linha({"SQ_CANDIDATO": "1", "URL_REDE": "https://b.com"}) == "https://b.com"


# ═══════════════════════════════════════════════════════════════════
# Patrimônio
# ═══════════════════════════════════════════════════════════════════

CPF = "52998224725"


def test_candidatura_liga_pelo_hash_do_cpf_e_so_do_congresso(tmp_path):
    arquivo = _zip(tmp_path, "cand.zip", {
        "consulta_cand_2022_SP.csv":
            "SG_UE;SQ_CANDIDATO;CD_CARGO;NR_CPF_CANDIDATO\n"
            f"SP;111;6;{CPF}\n"
            f"SP;222;3;{CPF}\n"
            "SP;333;6;11144477735\n",
    })

    ligadas = patrimonio.candidaturas(arquivo, {hash_de_cpf(CPF): 42})

    assert ligadas == {("SP", "111"): 42}


def test_bens_somam_por_tipo_e_nunca_leem_a_descricao():
    """RISCO: Nenhum pedaço da descrição chega à linha gravada.
    """
    linhas = [
        {"SG_UE": "SP", "SQ_CANDIDATO": "111", "DS_TIPO_BEM_CANDIDATO": "Casa", "VR_BEM_CANDIDATO": "300.000,00",
         "DS_BEM_CANDIDATO": "CASA NA RUA DAS FLORES, 10"},
        {"SG_UE": "SP", "SQ_CANDIDATO": "111", "DS_TIPO_BEM_CANDIDATO": "Casa", "VR_BEM_CANDIDATO": "200.000,00",
         "DS_BEM_CANDIDATO": "CASA NA PRAIA"},
        {"SG_UE": "SP", "SQ_CANDIDATO": "111", "DS_TIPO_BEM_CANDIDATO": "Veículo", "VR_BEM_CANDIDATO": "50.000,00",
         "DS_BEM_CANDIDATO": "CARRO PLACA ABC1234"},
        {"SG_UE": "SP", "SQ_CANDIDATO": "999", "DS_TIPO_BEM_CANDIDATO": "Casa", "VR_BEM_CANDIDATO": "1,00", "DS_BEM_CANDIDATO": "X"},
    ]

    saida = patrimonio.bens_para_linhas(linhas, {("SP", "111"): 42}, 2022)

    assert sorted((l["tipo_bem"], l["valor"], l["quantidade"]) for l in saida) == [
        ("Casa", 500_000.0, 2), ("Veículo", 50_000.0, 1)]
    assert not any("RUA" in str(v) or "PLACA" in str(v) for l in saida for v in l.values())


def test_com_arquivo_brasil_le_so_ele(tmp_path):
    """Somar o BRASIL e os de UF contaria cada bem duas vezes."""
    cabecalho = "SG_UE;SQ_CANDIDATO;DS_TIPO_BEM_CANDIDATO;VR_BEM_CANDIDATO\n"
    arquivo = _zip(tmp_path, "bens.zip", {
        "bem_candidato_2022_SP.csv": cabecalho + "SP;111;Casa;100,00\n",
        "bem_candidato_2022_BRASIL.csv": cabecalho + "SP;111;Casa;100,00\n",
    })

    saida = patrimonio.bens_para_linhas(patrimonio.linhas_do_zip(arquivo), {("SP", "111"): 42}, 2022)

    assert [(l["valor"], l["quantidade"]) for l in saida] == [(100.0, 1)]


# ═══════════════════════════════════════════════════════════════════
# Convenentes
# ═══════════════════════════════════════════════════════════════════


def test_convenente_so_dos_convenios_que_temos_e_cnpj_com_14_digitos(tmp_path):
    cabecalho = "NÚMERO CONVÊNIO;SITUAÇÃO CONVÊNIO;CÓDIGO CONVENENTE;VALOR LIBERADO\n"
    arquivo = _zip(tmp_path, "c.zip", {
        "20260918_Convenios.csv": cabecalho
        + "1AAQKR;EM EXECUÇÃO;46522959000198;1.000,50\n"
        + "999999;CONCLUÍDO;11222333000144;5,00\n"
        + "77;CONCLUÍDO;123;0,00\n",
        "20260918_Convenios_OrdensBancarias.csv": "x\n",
    })

    linhas = convenentes.ler(arquivo, {"1AAQKR", "77"})

    assert linhas == [
        {"numero": "1AAQKR", "cnpj_convenente": "46522959000198", "situacao": "EM EXECUÇÃO", "valor_liberado": 1000.5},
        {"numero": "77", "cnpj_convenente": None, "situacao": "CONCLUÍDO", "valor_liberado": 0.0},
    ]


def test_numero_repetido_no_arquivo_vira_uma_linha(tmp_path):
    cabecalho = "NÚMERO CONVÊNIO;SITUAÇÃO CONVÊNIO;CÓDIGO CONVENENTE;VALOR LIBERADO\n"
    arquivo = _zip(tmp_path, "c.zip", {
        "20260918_Convenios.csv": cabecalho + "1AAQKR;EM EXECUÇÃO;46522959000198;1,00\n1AAQKR;CONCLUÍDO;46522959000198;2,00\n",
    })

    linhas = convenentes.ler(arquivo, {"1AAQKR"})

    assert [(l["situacao"], l["valor_liberado"]) for l in linhas] == [("CONCLUÍDO", 2.0)]
