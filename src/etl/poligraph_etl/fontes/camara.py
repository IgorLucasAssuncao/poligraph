"""Leitura dos arquivos abertos da Câmara dos Deputados.

🔴 O ponto mais perigoso deste módulo são os PARÂMETROS de leitura, não a lógica.
Os CSVs da Câmara têm quebra de linha DENTRO de campos entre aspas. Ler por linha
infla a contagem entre 15% e 26%, dependendo do ano — e o erro não dá exceção:
produz linhas quebradas que viram registros inválidos silenciosamente.
"""

from pathlib import Path

import pandas as pd
import requests

BASE = "https://dadosabertos.camara.leg.br/arquivos"

# Medido em 2026-08-26 com parser RFC 4180 próprio (infra/analise/csv.awk).
# Serve de canário: se a leitura devolver muito mais que isto, os parâmetros
# de parsing regrediram.
REGISTROS_ESPERADOS = {2023: 10_832, 2024: 10_371, 2025: 13_825}

TOLERANCIA = 0.05


def ler_csv(caminho: Path | str) -> pd.DataFrame:
    """Lê um CSV da Câmara com os três parâmetros que evitam as armadilhas medidas.

    ⚠️ Nenhum deles é opcional:

    - `sep=';'`        — o separador é ponto e vírgula, não vírgula
    - `encoding='utf-8-sig'` — os arquivos têm BOM; sem isso a PRIMEIRA coluna vem
      com `\\ufeff` grudado no nome e o acesso por nome falha
    - `dtype=str`      — 🔴 sem isto o pandas infere número e o CPF `01234567890`
      vira `1234567890`, perdendo o zero à esquerda. O join com o TSE falha em
      silêncio, sem erro nenhum
    - `quotechar='"'`  — é o que faz a quebra de linha dentro do campo ser tratada
      como conteúdo, e não como novo registro
    """
    return pd.read_csv(
        caminho,
        sep=";",
        encoding="utf-8-sig",
        quotechar='"',
        dtype=str,
        na_values=["", "#NULO#", "#NE#"],
        keep_default_na=False,
    )


def baixar(recurso: str, ano: int, destino: Path) -> Path:
    """Baixa um arquivo anual da Câmara.

    ⚠️ Os arquivos são reconstruídos toda madrugada, TODOS os anos — inclusive os
    fechados (achado #19). Não dá para supor que o de 2023 nunca muda.
    """
    destino.parent.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/{recurso}/csv/{recurso}-{ano}.csv"

    resposta = requests.get(url, timeout=120)
    resposta.raise_for_status()
    destino.write_bytes(resposta.content)

    return destino


def conferir_volume(df: pd.DataFrame, ano: int) -> None:
    """Canário contra regressão de parsing.

    ⭐ Se alguém remover `quotechar` ou trocar o encoding, a contagem estoura e o
    ETL para aqui — em vez de gravar milhares de linhas quebradas no banco.
    """
    esperado = REGISTROS_ESPERADOS.get(ano)
    if esperado is None:
        return

    desvio = abs(len(df) - esperado) / esperado
    if desvio > TOLERANCIA:
        raise ValueError(
            f"votacoes-{ano}: {len(df)} registros, esperado ~{esperado} "
            f"(desvio de {desvio:.1%}). "
            "Parsing regrediu, ou a Câmara mudou o arquivo — confira antes de ingerir."
        )
