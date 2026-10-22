"""Tesouro Nacional — a Declaração de Contas Anuais (DCA) de cada município, pela API do Siconfi (Pendência 90, fase 5).

## ENTRADA

| | |
|---|---|
| Fonte | `apidatalake.tesouro.gov.br/ords/siconfi/tt/dca`, anexos I-C (receitas) e I-D (despesas) |
| Recorte | Um município e um ano por requisição: sem `id_ente` a API responde vazio (MEDIDO em 2026-10-22) |
| Periodicidade | Anual: o município declara o ano até 30 de abril do seguinte |

RISCO: são 5.570 municípios por anexo e por ano. MEDIDO em 2026-10-22: cerca de 0,3 s por requisição.
"""

import time

import requests

URL = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt/dca"
ANEXO_DE_RECEITAS = "DCA-Anexo I-C"
ANEXO_DE_DESPESAS = "DCA-Anexo I-D"

CABECALHOS = {"User-Agent": "poligraph-etl/1.0 (TCC; dados abertos)"}

_SESSAO = requests.Session()
"""Uma conexão reaproveitada para todas as consultas. MEDIDO em 2026-10-22: 0,77 s por consulta, contra 0,95 s abrindo uma conexão TLS nova a cada uma."""
_SESSAO.headers.update(CABECALHOS)

RECUSAS: dict[int, int] = {}
"""Quantas respostas de recusa (429 e 5xx) o Tesouro deu, por código HTTP: a carga as conta e escreve no log de progresso."""
TENTATIVAS = 8
"""Com espera de 2, 4, 8... até 256 s. MEDIDO em 2026-10-22: quatro consultas em paralelo levaram 429 em menos de 3 minutos."""


def consultar(ano: int, anexo: str, codigo_ibge: str) -> list[dict]:
    """As linhas da DCA de um município num ano e anexo. Lista vazia quando ele não declarou.

    O Tesouro limita o ritmo com 429 e às vezes cai com 5xx: tenta de novo com espera crescente
    antes de desistir, como `portal.baixar_publicado`.
    """
    parametros = {"an_exercicio": ano, "no_anexo": anexo, "id_ente": codigo_ibge}
    for tentativa in range(TENTATIVAS):
        resposta = _SESSAO.get(URL, params=parametros, timeout=60)
        if resposta.status_code == 429 or resposta.status_code >= 500:
            RECUSAS[resposta.status_code] = RECUSAS.get(resposta.status_code, 0) + 1
            time.sleep(2 ** tentativa)
            continue
        resposta.raise_for_status()
        return resposta.json().get("items", [])
    resposta.raise_for_status()
    return []
