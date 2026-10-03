"""BrasilAPI — a sede de um CNPJ pelo código IBGE do município (Pendência 71).

## ENTRADA

| | |
|---|---|
| Fonte | `brasilapi.com.br/api/cnpj/v1/{cnpj}` |
| Origem do dado | O cadastro aberto de CNPJ da Receita Federal, que a BrasilAPI repassa |
| Formato | JSON, uma requisição por CNPJ |

RISCO: É projeto comunitário, sem garantia de disponibilidade nem de atualização. A fonte
citada continua sendo a Receita; a BrasilAPI é o caminho até ela, e a URL da carga diz isso.

RISCO: A resposta traz 48 campos, entre eles o quadro de sócios (`qsa`), com nome e parte do
CPF de pessoas. Este módulo devolve só quatro campos: o resto nunca sai daqui, nem para o
arquivo guardado. O sócio é dado pessoal e não serve ao trabalho.
"""

import logging
import time

import requests

BASE = "https://brasilapi.com.br/api/cnpj/v1"

TENTATIVAS_COM_LIMITE = 3
ESPERA_NO_LIMITE = 10.0

log = logging.getLogger("poligraph")


def sede(cnpj: str, *, esperar=time.sleep) -> dict | None:
    """`{cnpj, codigo_ibge, municipio, uf}`, ou `None` quando não há resposta útil.

    429 (limite de requisições) espera e tenta de novo; 404 e as outras falhas devolvem
    `None`, e o CNPJ fica para a próxima execução.
    """
    for _ in range(TENTATIVAS_COM_LIMITE):
        try:
            resposta = requests.get(f"{BASE}/{cnpj}", timeout=30)
        except requests.RequestException:
            return None
        if resposta.status_code == 429:
            esperar(ESPERA_NO_LIMITE)
            continue
        if resposta.status_code != 200:
            return None
        try:
            dados = resposta.json()
        except ValueError:
            return None
        return _quatro_campos(cnpj, dados)
    return None


def _quatro_campos(cnpj: str, dados: dict) -> dict | None:
    """Só o que a sede precisa. O código vem como número e às vezes falta."""
    codigo = dados.get("codigo_municipio_ibge")
    if not codigo:
        return None
    return {
        "cnpj": cnpj,
        "codigo_ibge": str(codigo).zfill(7),
        "municipio": dados.get("municipio"),
        "uf": dados.get("uf"),
    }
