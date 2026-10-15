"""IBGE — a população estimada de cada município, para o mapa por habitante.

## ENTRADA

| | |
|---|---|
| Fonte | API do SIDRA, tabela 6579 (estimativas de população), variável 9324 |
| Recorte | Todos os municípios (`n6/all`), o ano mais recente publicado |
| Periodicidade | Anual: o IBGE publica a estimativa de 1º de julho em agosto |

DECISÃO: Uma requisição só, com a tabela inteira: são 5.570 linhas de JSON. O arquivo vai para
o cache e entra na procedência como qualquer outra carga.
"""

import json
from pathlib import Path

import requests

URL = "https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/last%201"

CABECALHOS = {"User-Agent": "poligraph-etl/1.0 (TCC; dados abertos)"}


def baixar(destino: Path) -> Path:
    """Baixa a tabela para `destino` e devolve o caminho."""
    resposta = requests.get(URL, headers=CABECALHOS, timeout=120)
    resposta.raise_for_status()
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(resposta.content)
    return destino


def ler(arquivo: Path) -> list[dict]:
    """`[{codigo_ibge, populacao, ano}]` a partir do JSON do SIDRA.

    A primeira linha do SIDRA é o cabeçalho, com os nomes das colunas no lugar dos valores, e
    sai. Valor que não é número ("-", "...") também sai: o IBGE marca assim o que não estimou.
    """
    linhas = json.loads(arquivo.read_text(encoding="utf-8"))
    saida = []
    for linha in linhas[1:]:
        valor = (linha.get("V") or "").strip()
        codigo = (linha.get("D1C") or "").strip()
        if not valor.isdigit() or len(codigo) != 7:
            continue
        saida.append({"codigo_ibge": codigo, "populacao": int(valor), "ano": int(linha["D3C"])})
    return saida
