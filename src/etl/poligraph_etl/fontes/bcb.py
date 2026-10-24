"""O SGS do Banco Central: séries temporais em JSON, sem chave."""

import time

import requests

SERIE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json&dataInicial=01/01/{desde}"


def url(codigo: int, desde: int) -> str:
    return SERIE.format(codigo=codigo, desde=desde)


def baixar_serie(codigo: int, desde: int, tentativas: int = 4) -> list[dict]:
    """As observações da série desde 1º de janeiro de `desde`. O SGS às vezes demora; tenta de novo antes de desistir."""
    for tentativa in range(tentativas):
        try:
            resposta = requests.get(url(codigo, desde), timeout=60)
            resposta.raise_for_status()
            return resposta.json()
        except requests.RequestException:
            if tentativa == tentativas - 1:
                raise
            time.sleep(2 ** tentativa)
    return []
