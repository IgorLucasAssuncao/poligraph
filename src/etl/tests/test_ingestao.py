"""Testes da transformação CSV → linhas do banco."""

import pandas as pd
import pytest

from poligraph_etl import ingestao

from poligraph_etl.ingestao import (
    deputados_para_linhas,
    votacoes_para_linhas,
    votos_para_linhas,
)

# ═══════════════════════════════════════════════════════════════════
# Votações — só as nominais entram
# ═══════════════════════════════════════════════════════════════════


def _votacao_bruta(**extra) -> dict:
    base = {
        "id": "2358548-89",
        "data": "2025-12-09",
        "siglaOrgao": "PLEN",
        "descricao": "Aprovado o Projeto de Lei nº 2.162, de 2023",
        "votosSim": "291",
        "votosNao": "148",
        "votosOutros": "0",
        "ultimaApresentacaoProposicao_idProposicao": "2162",
    }
    return {**base, **extra}


def test_votacao_nominal_vira_linha():
    df = pd.DataFrame([_votacao_bruta()])
    linhas = votacoes_para_linhas(df)

    assert len(linhas) == 1
    assert linhas[0]["id"] == "2358548-89"
    assert linhas[0]["categoria"] == "SUBSTANTIVA"
    assert linhas[0]["plenario"] is True


def test_votacao_simbolica_e_descartada():
    """⚠️ Sem contagem não há registro individual — não serve para medir afinidade."""
    df = pd.DataFrame([_votacao_bruta(votosSim="0", votosNao="0", votosOutros="0")])

    assert votacoes_para_linhas(df) == []


def test_votacao_de_comissao_nao_e_plenario():
    df = pd.DataFrame([_votacao_bruta(siglaOrgao="CCJC")])
    linhas = votacoes_para_linhas(df)

    assert linhas[0]["plenario"] is False


def test_requerimento_e_classificado_como_procedimental():
    """⭐ Peso 0 na matriz: mede obstrução, não posição."""
    df = pd.DataFrame([_votacao_bruta(descricao="Aprovado o Requerimento de urgência")])
    linhas = votacoes_para_linhas(df)

    assert linhas[0]["categoria"] == "PROCEDIMENTAL"


# ═══════════════════════════════════════════════════════════════════
# Votos
# ═══════════════════════════════════════════════════════════════════


def _voto_bruto(**extra) -> dict:
    base = {
        "idVotacao": "2358548-89",
        "deputado_id": "204528",
        "voto": "Sim",
        "deputado_siglaPartido": "PARTIDO-A",
        "deputado_siglaUf": "SP",
    }
    return {**base, **extra}


def test_voto_vira_linha_com_id_sintetico():
    """RF-11 — o ID da Câmara é traduzido para o ID próprio do projeto."""
    df = pd.DataFrame([_voto_bruto()])
    linhas = votos_para_linhas(df, {"204528": 42})

    assert linhas[0]["pessoa_id"] == 42
    assert linhas[0]["valor"] == 1


def test_obstrucao_vira_nulo_e_nao_zero():
    """🔴 Obstrução é manobra de bancada, não abstenção — sai do cálculo."""
    df = pd.DataFrame([_voto_bruto(voto="Obstrução")])
    linhas = votos_para_linhas(df, {"204528": 42})

    assert linhas[0]["valor"] is None


def test_voto_de_pessoa_fora_do_mapa_e_descartado():
    """⚠️ Descartado, nunca inventado. Volume alto aqui = falha na carga de deputados."""
    df = pd.DataFrame([_voto_bruto(deputado_id="999999")])

    assert votos_para_linhas(df, {"204528": 42}) == []


def test_uf_e_truncada_em_dois_caracteres():
    """A coluna é CHAR(2); dado sujo estouraria o INSERT."""
    df = pd.DataFrame([_voto_bruto(deputado_siglaUf="SPX")])
    linhas = votos_para_linhas(df, {"204528": 42})

    assert linhas[0]["uf_no_voto"] == "SP"


# ═══════════════════════════════════════════════════════════════════
# 🔴 Deputados — o achado #20
# ═══════════════════════════════════════════════════════════════════


def test_deputado_repetido_por_partido_entra_uma_vez_so():
    """🔴 Achado #20: o CSV traz 878 linhas para 647 pessoas.

    É produto cartesiano de nome × partido — quem trocou de legenda aparece
    várias vezes. Sem a deduplicação, a mesma pessoa viraria vários nós do grafo.
    """
    df = pd.DataFrame(
        [
            {"id": "204528", "nome": "Ana Ribeiro", "nomeCivil": "Ana Ribeiro"},
            {"id": "204528", "nome": "Ana Ribeiro", "nomeCivil": "Ana Ribeiro"},
            {"id": "204529", "nome": "Bruno Tavares", "nomeCivil": "Bruno Tavares"},
        ]
    )

    linhas = deputados_para_linhas(df)

    assert len(linhas) == 2
    assert {l["id_externo"] for l in linhas} == {"204528", "204529"}


def test_cpf_hash_fica_nulo_porque_o_csv_nao_traz_cpf():
    """⚠️ Medido: 0 de 7.889 CPFs preenchidos no CSV. Só a API REST tem.

    Este teste existe para que ninguém "conserte" o campo lendo a coluna vazia e
    ache que conciliou com o TSE.
    """
    df = pd.DataFrame([{"id": "204528", "nome": "Ana", "nomeCivil": "Ana", "cpf": ""}])
    linhas = deputados_para_linhas(df)

    assert linhas[0]["cpf_hash"] is None


def test_deputado_sem_id_e_descartado():
    df = pd.DataFrame([{"id": "", "nome": "Sem Id", "nomeCivil": "Sem Id"}])

    assert deputados_para_linhas(df) == []


# ═══════════════════════════════════════════════════════════════════
# 🔴 O id do deputado — descoberto na primeira ingestão real
# ═══════════════════════════════════════════════════════════════════


def test_id_do_deputado_sai_da_uri():
    """🔴 `deputados.csv` NÃO tem coluna `id` — tem `uri`, com o id no fim.

    ⚠️ Ler `id` devolvia vazio para toda linha e o ETL registrava
    `0 deputados no arquivo` em INFO, sem erro. Sem a tabela de-para, os 13.825 votos
    de 2025 também não casavam e o log dizia `0 votos`. Dois zeros plausíveis.
    """
    linha = {"uri": "https://dadosabertos.camara.leg.br/api/v2/deputados/220593"}

    assert ingestao.id_do_deputado(linha) == "220593"


def test_id_do_deputado_prefere_a_coluna_id_se_existir():
    # ⭐ Se a Câmara passar a publicar a coluna, funciona sem mudança.
    linha = {"id": "204554", "uri": ".../deputados/220593"}

    assert ingestao.id_do_deputado(linha) == "204554"


def test_id_do_deputado_sem_uri_nem_id_devolve_vazio():
    assert ingestao.id_do_deputado({}) == ""
    assert ingestao.id_do_deputado({"uri": ""}) == ""


def test_deputados_do_formato_real_da_camara_viram_linhas():
    """⭐ Colunas copiadas do cabeçalho real de `deputados.csv`, não inventadas."""
    df = pd.DataFrame(
        [
            {
                "uri": "https://dadosabertos.camara.leg.br/api/v2/deputados/220593",
                "nome": "Abilio Brunini",
                "nomeCivil": "ABILIO BRUNINI PEIXOTO",
                "cpf": "",
                "siglaSexo": "M",
            }
        ]
    )

    linhas = ingestao.deputados_para_linhas(df)

    assert len(linhas) == 1
    assert linhas[0]["id_externo"] == "220593"
    assert linhas[0]["nome_exibicao"] == "Abilio Brunini"
    # ⚠️ A coluna `cpf` do CSV vem vazia — medido: 0 de 7.889 preenchidos.
    assert linhas[0]["cpf_hash"] is None


# ═══════════════════════════════════════════════════════════════════
# 🔴 A legislatura sai da DATA — descoberto pela pergunta "e quando virar?"
# ═══════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("data", "esperada"),
    [
        ("2023-02-01", 57),   # primeiro dia da 57ª
        ("2025-07-16", 57),
        ("2026-12-31", 57),
        ("2027-01-31", 57),   # ⚠️ janeiro de 2027 ainda é a 57ª
        ("2027-02-01", 58),   # 🔴 a posse é em 1º de FEVEREIRO
        ("2030-12-01", 58),
        ("2031-02-01", 59),
        ("2019-02-01", 56),   # retroage também
    ],
)
def test_legislatura_sai_da_data(data: str, esperada: int):
    """🔴 Era um `57` chumbado no código.

    ⚠️ Ingerir 2027 gravaria as votações da 58ª COMO SE FOSSEM DA 57ª — sem erro, e a
    matriz de similaridade passaria a misturar duas Câmaras diferentes.
    """
    assert ingestao.legislatura_da_data(data) == esperada


def test_votacao_recebe_a_legislatura_da_propria_data():
    df = pd.DataFrame([
        _votacao_bruta(id="X-1", data="2026-05-10"),
        _votacao_bruta(id="Y-1", data="2027-05-10"),
    ])

    linhas = {l["id"]: l["legislatura"] for l in ingestao.votacoes_para_linhas(df)}

    assert linhas["X-1"] == 57
    assert linhas["Y-1"] == 58


def test_url_da_foto_e_deterministica():
    """⭐ Não precisa de requisição: a URL se monta a partir do id.

    ⚠️ O CSV de deputados NÃO traz a foto — só `urlRedeSocial` e `urlWebsite`. Ela existe
    em `ultimoStatus.urlFoto` na API REST, um deputado por chamada: 7.889 requisições
    para obter algo que sai de uma f-string.
    """
    assert ingestao.url_da_foto("220593").endswith("/bandep/220593.jpg")
    assert ingestao.url_da_foto("") is None


def test_deputado_ingerido_ja_vem_com_foto():
    df = pd.DataFrame([{
        "uri": "https://dadosabertos.camara.leg.br/api/v2/deputados/220593",
        "nome": "Abilio Brunini", "nomeCivil": "ABILIO BRUNINI PEIXOTO",
    }])

    linha = ingestao.deputados_para_linhas(df)[0]

    assert "220593.jpg" in linha["url_foto"]
