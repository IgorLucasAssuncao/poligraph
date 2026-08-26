"""Transformação do CSV bruto para as linhas que vão ao banco.

⚠️ A camada bronze é o CSV como veio; esta é a silver. Nada aqui inventa dado — só
normaliza, classifica e descarta o que não entra na matriz.
"""

from datetime import date

import pandas as pd

from .normalizacao import classificar_categoria, normalizar_voto

LEGISLATURA_57_INICIO = date(2023, 2, 1)


def votacoes_para_linhas(df: pd.DataFrame, legislatura: int = 57) -> list[dict]:
    """Converte o CSV de votações nas linhas da tabela `votacao`.

    ⚠️ Só entram votações NOMINAIS — as que têm contagem de votos. Votação simbólica
    não registra quem votou o quê, então não serve para medir afinidade.
    """
    linhas: list[dict] = []

    for _, r in df.iterrows():
        sim, nao, outros = _inteiro(r.get("votosSim")), _inteiro(r.get("votosNao")), _inteiro(r.get("votosOutros"))
        if sim + nao + outros == 0:
            continue                       # simbólica: sem registro individual

        descricao = r.get("descricao") or ""
        linhas.append(
            {
                "id": r["id"],
                "casa": "CAMARA",
                "legislatura": legislatura,
                "data": r["data"],
                "orgao": r.get("siglaOrgao"),
                "descricao": descricao,
                "proposicao_id": _inteiro_ou_nulo(
                    r.get("ultimaApresentacaoProposicao_idProposicao")
                ),
                "categoria": classificar_categoria(descricao),
                "secreta": False,          # ⚠️ a Câmara não marca; o Senado sim
                "plenario": r.get("siglaOrgao") == "PLEN",
                "votos_sim": sim,
                "votos_nao": nao,
            }
        )

    return linhas


def votos_para_linhas(df: pd.DataFrame, mapa_pessoas: dict[str, int]) -> list[dict]:
    """Converte o CSV de votos nas linhas da tabela `voto`.

    `mapa_pessoas` liga o ID da Câmara ao ID sintético do projeto (RF-11).

    ⚠️ Votos de pessoas fora do mapa são DESCARTADOS, não inventados. Se isso
    acontecer em volume, o problema está na ingestão de deputados — e o resumo
    devolve a contagem para que dê para perceber.
    """
    linhas: list[dict] = []

    for _, r in df.iterrows():
        id_camara = str(r.get("deputado_id") or "")
        pessoa_id = mapa_pessoas.get(id_camara)
        if pessoa_id is None:
            continue

        linhas.append(
            {
                "votacao_id": r["idVotacao"],
                "pessoa_id": pessoa_id,
                "valor": normalizar_voto(r.get("voto")),
                "partido_no_voto": r.get("deputado_siglaPartido") or "",
                "uf_no_voto": (r.get("deputado_siglaUf") or "")[:2],
            }
        )

    return linhas


def deputados_para_linhas(df: pd.DataFrame) -> list[dict]:
    """Converte o CSV de deputados nas linhas de `pessoa` + `pessoa_fonte_id`.

    ⚠️ A coluna `cpf` do CSV vem VAZIA (medido: 0 de 7.889 preenchidos). O CPF só
    existe na API REST, uma chamada por deputado. Por isso `cpf_hash` fica nulo aqui
    e a conciliação com o TSE é feita em passo separado.
    """
    linhas: list[dict] = []
    vistos: set[str] = set()

    for _, r in df.iterrows():
        id_externo = id_do_deputado(r)
        if not id_externo or id_externo in vistos:
            continue                       # ⚠️ o CSV repete a pessoa por partido (achado #20)
        vistos.add(id_externo)

        nome = r.get("nomeCivil") or r.get("nome") or ""
        linhas.append(
            {
                "nome_civil": nome,
                "nome_exibicao": r.get("nome") or nome,
                "cpf_hash": None,
                "fonte": "CAMARA",
                "id_externo": id_externo,
                "metodo": "MANUAL",
                "confianca": 1.0,
            }
        )

    return linhas


# ═══════════════════════════════════════════════════════════════════


def id_do_deputado(linha) -> str:
    """Extrai o id da Câmara da linha de `deputados.csv`.

    🔴 O arquivo **não tem coluna `id`.** Tem `uri`, e o id é o último segmento:

        https://dadosabertos.camara.leg.br/api/v2/deputados/220593  →  220593

    ⚠️ Ler `r.get("id")` devolvia vazio para toda linha, o laço pulava todas, e o ETL
    registrava `0 deputados no arquivo, 0 novos` — em **INFO**, sem erro. Como a tabela
    de-para ficava vazia, os 13.825 votos de 2025 também não casavam com ninguém e o
    log dizia `0 votos`. Dois zeros plausíveis, nenhuma exceção.

    ⭐ Aceita `id` se existir: se a Câmara passar a publicar a coluna, funciona sem
    mudança.
    """
    direto = str(linha.get("id") or "").strip()
    if direto:
        return direto

    uri = str(linha.get("uri") or "").strip().rstrip("/")

    return uri.rsplit("/", 1)[-1] if "/" in uri else ""


def _inteiro(valor) -> int:
    try:
        return int(float(valor))
    except (TypeError, ValueError):
        return 0


def _inteiro_ou_nulo(valor) -> int | None:
    resultado = _inteiro(valor)
    return resultado or None
