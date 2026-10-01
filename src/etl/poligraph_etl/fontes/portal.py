"""ENTRADA — downloads de dados abertos do Portal da Transparência.

Os arquivos em bloco do Portal são públicos: ⛔ não pedem a chave pessoal que a API de
dados exige. O que se faz com o conteúdo fica em [`emendas.py`](../emendas.py) e
[`orcamento.py`](../orcamento.py).

| Recurso | Conteúdo | Atualização |
|---|---|---|
| `emendas-parlamentares/UNICO` | Três CSVs: emendas, favorecidos, convênios | Diária — o arquivo inteiro é regerado |
| `orcamento-despesa/{ano}` | Dotação, empenhado e pago por ação e elemento | Diária no ano corrente |

🔴 **O servidor responde 405 depois de ~18 downloads seguidos**, e o 405 ⛔ não é erro
do pedido: é limite de taxa sem o código certo. Medido em 2026-09-24 — com pausa de
20 s e nova tentativa, os 45 arquivos de transferências baixaram. Por isso `baixar`
tenta de novo antes de desistir.

⚠️ Os CSVs vêm em **Latin-1**, ⛔ não UTF-8. Ler como UTF-8 estoura no primeiro "ç".
"""

import io
import logging
import time
import zipfile
from datetime import date
from pathlib import Path

import pandas as pd
import requests

log = logging.getLogger("poligraph")

BASE = "https://portaldatransparencia.gov.br/download-de-dados"

CABECALHOS = {"User-Agent": "Mozilla/5.0 (poligraph; TCC)"}

TENTATIVAS = 4
ESPERA_ENTRE_TENTATIVAS = 20


def url(recurso: str) -> str:
    """`emendas-parlamentares/UNICO` → a URL de download, que redireciona para o CDN."""
    return f"{BASE}/{recurso}"


def baixar(recurso: str, destino: Path, *, esperar=time.sleep) -> Path:
    """Baixa em fluxo, com nova tentativa quando o servidor limita a taxa.

    ⚠️ Só renomeia no fim: download interrompido ⛔ não pode virar cache válido.
    """
    if destino.exists() and destino.stat().st_size > 0:
        log.info("  já em cache: %s (%.0f MB)", destino.name, destino.stat().st_size / 1e6)
        return destino

    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")

    for tentativa in range(1, TENTATIVAS + 1):
        log.info("  baixando %s (tentativa %d)", url(recurso), tentativa)
        with requests.get(url(recurso), headers=CABECALHOS, stream=True, timeout=600) as resposta:
            if resposta.status_code in (405, 429, 502, 503) and tentativa < TENTATIVAS:
                log.warning("  %d do servidor; nova tentativa em %d s",
                            resposta.status_code, ESPERA_ENTRE_TENTATIVAS * tentativa)
                esperar(ESPERA_ENTRE_TENTATIVAS * tentativa)
                continue
            resposta.raise_for_status()

            with parcial.open("wb") as saida:
                for bloco in resposta.iter_content(chunk_size=1 << 20):
                    saida.write(bloco)
            break

    parcial.replace(destino)
    log.info("  %s — %.0f MB", destino.name, destino.stat().st_size / 1e6)

    return destino


def ler_csv(arquivo_zip: Path, membro: str, colunas: list[str] | None = None) -> pd.DataFrame:
    """Lê um CSV de dentro do ZIP, tudo como texto.

    ⚠️ `dtype=str` pelo mesmo motivo dos CSVs da Câmara: código com zero à esquerda
    (`"03101"`, `"00SJ"`) viraria número e perderia o zero.

    ⭐ `colunas` limita a leitura: o arquivo mensal de execução tem 80 MB e 47 colunas, e
    o que se usa dele são quatro.
    """
    with zipfile.ZipFile(arquivo_zip) as zf:
        with zf.open(membro) as bruto:
            return pd.read_csv(
                io.TextIOWrapper(bruto, encoding="latin-1"),
                sep=";",
                quotechar='"',
                dtype=str,
                keep_default_na=False,
                usecols=colunas,
            )


def gerado_em(arquivo_zip: Path, membro: str) -> date:
    """A data em que o Portal gerou o CSV, lida do próprio ZIP.

    ⭐ É ela, ⛔ não a data do download, que diz até onde vai o dado do ano corrente.
    """
    with zipfile.ZipFile(arquivo_zip) as zf:
        ano, mes, dia, *_ = zf.getinfo(membro).date_time
    return date(ano, mes, dia)


def membros(arquivo_zip: Path) -> list[str]:
    with zipfile.ZipFile(arquivo_zip) as zf:
        return zf.namelist()
